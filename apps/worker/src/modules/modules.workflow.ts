import { Annotation, END, Send, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import type { ModuleGenerationJob } from "@ngertiin/contracts/jobs";
import { AiService } from "../ai/ai.service.js";
import { WORKER_ENV } from "../config.js";
import type { ChunkDescriptor, SourceChunk } from "../source/source.service.js";
import { invalidContext } from "./modules.failure.js";
import {
  buildActivityGenerationRequest,
  buildChunkAnalysisRequest,
  buildConceptMapRequest,
  buildCurriculumRequest,
  buildMaterialReductionRequest,
} from "./modules.requests.js";
import type {
  ChunkMapOutput,
  ConceptMap,
  CurriculumPlan,
  MaterialAnalysis,
  NodeActivities,
} from "./modules.schemas.js";
import { ModulesService } from "./modules.service.js";

type ChunkAnalysisUpdate = {
  chunkId: string;
  analysis: ChunkMapOutput;
};

const WorkflowState = Annotation.Root({
  generationRunId: Annotation<string>(),
  moduleId: Annotation<string>(),
  generationRequestId: Annotation<string>(),
  chunks: Annotation<ChunkDescriptor[]>({
    reducer: (_current, next) => next,
    default: () => [],
  }),
  chunkAnalyses: Annotation<Record<string, ChunkMapOutput>, ChunkAnalysisUpdate>({
    reducer: (current, next) => ({ ...current, [next.chunkId]: next.analysis }),
    default: () => ({}),
  }),
  materialAnalysis: Annotation<MaterialAnalysis | undefined>(),
  conceptMap: Annotation<ConceptMap | undefined>(),
  curriculum: Annotation<CurriculumPlan | undefined>(),
  activities: Annotation<Record<string, NodeActivities>>({
    reducer: (_current, next) => next,
    default: () => ({}),
  }),
  activityIndex: Annotation<number>({
    reducer: (_current, next) => next,
    default: () => 0,
  }),
});

const WorkflowContext = Annotation.Root({
  instruction: Annotation<string | null>(),
  chunks: Annotation<SourceChunk[]>(),
});

const ChunkWorkerState = Annotation.Root({
  generationRunId: Annotation<string>(),
  chunk: Annotation<SourceChunk>(),
});

@Injectable()
export class ModulesWorkflow implements OnModuleInit, OnApplicationShutdown {
  private readonly checkpointer: PostgresSaver;
  private readonly graph: ReturnType<ModulesWorkflow["buildGraph"]>;

  constructor(
    @Inject(WORKER_ENV) environment: WorkerEnvironment,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(ModulesService) private readonly modules: ModulesService,
  ) {
    this.checkpointer = PostgresSaver.fromConnString(environment.DATABASE_URL, {
      schema: "langgraph",
    });
    this.graph = this.buildGraph();
  }

  async onModuleInit(): Promise<void> {
    await this.checkpointer.setup();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.checkpointer.end();
  }

  async run(
    payload: ModuleGenerationJob,
    context: { instruction: string | null; chunks: SourceChunk[] },
  ): Promise<void> {
    const config = {
      configurable: { thread_id: payload.generationRunId },
      context,
      durability: "sync" as const,
      maxConcurrency: 3,
      recursionLimit: 64,
    };
    const checkpoint = await this.checkpointer.getTuple(config);
    await this.graph.invoke(checkpoint ? null : payload, config);
  }

  private buildGraph() {
    return new StateGraph(WorkflowState, WorkflowContext)
      .addNode("extract_sources", async (state, runtime) => {
        const chunks = runtime.context?.chunks;
        if (!chunks?.length) invalidContext("extract_sources");
        await this.modules.beginStep(state.generationRunId, "extract_sources");
        const descriptors = chunks.map(({ content: _content, ...descriptor }) => descriptor);
        await this.modules.completeStep(state.generationRunId, "extract_sources", {
          chunkCount: descriptors.length,
        });
        await this.modules.beginStep(state.generationRunId, "analyze_material");
        return { chunks: descriptors };
      })
      .addNode(
        "analyze_chunk",
        async (state, runtime) => ({
          chunkAnalyses: {
            chunkId: state.chunk.id,
            analysis: await this.ai.generateObject(
              buildChunkAnalysisRequest(state.chunk, runtime.context?.instruction ?? null),
            ),
          },
        }),
        { input: ChunkWorkerState },
      )
      .addNode("reduce_material", async (state, runtime) => {
        const chunks = runtime.context?.chunks;
        if (!chunks?.length) invalidContext("analyze_material");
        const analysis = await this.ai.generateObject(
          buildMaterialReductionRequest(
            chunks,
            state.chunkAnalyses,
            runtime.context?.instruction ?? null,
          ),
        );
        await this.modules.completeStep(state.generationRunId, "analyze_material", {
          chunkCount: chunks.length,
        });
        return { materialAnalysis: analysis };
      })
      .addNode("create_concepts", async (state, runtime) => {
        if (!state.materialAnalysis) invalidContext("create_concepts");
        await this.modules.beginStep(state.generationRunId, "create_concepts");
        const conceptMap = await this.ai.generateObject(
          buildConceptMapRequest(state.materialAnalysis, runtime.context?.instruction ?? null),
        );
        await this.modules.completeStep(state.generationRunId, "create_concepts", {
          conceptCount: conceptMap.concepts.length,
        });
        return { conceptMap };
      })
      .addNode("create_curriculum", async (state, runtime) => {
        if (!state.materialAnalysis || !state.conceptMap) {
          invalidContext("create_curriculum");
        }
        await this.modules.beginStep(state.generationRunId, "create_curriculum");
        const curriculum = await this.ai.generateObject(
          buildCurriculumRequest(
            state.materialAnalysis,
            state.conceptMap,
            runtime.context?.instruction ?? null,
          ),
        );
        await this.modules.completeStep(state.generationRunId, "create_curriculum", {
          nodeCount: curriculum.nodes.length,
        });
        return { curriculum };
      })
      .addNode("generate_activity", async (state, runtime) => {
        const chunks = runtime.context?.chunks;
        const node = state.curriculum?.nodes[state.activityIndex];
        if (!chunks?.length || !state.conceptMap || !state.curriculum || !node) {
          invalidContext("generate_activities");
        }
        await this.modules.beginStep(state.generationRunId, "generate_activities");
        const output = await this.ai.generateObject(
          buildActivityGenerationRequest(
            node,
            state.conceptMap,
            chunks,
            runtime.context?.instruction ?? null,
          ),
        );
        const completed = state.activityIndex + 1;
        const activities = { ...state.activities, [node.key]: output };
        await this.modules.updateActivityProgress(
          state.generationRunId,
          completed,
          state.curriculum.nodes.length,
        );
        if (completed === state.curriculum.nodes.length) {
          await this.modules.completeStep(state.generationRunId, "generate_activities", {
            nodeCount: completed,
          });
        }
        return { activities, activityIndex: completed };
      })
      .addNode("validate_module", async (state) => {
        if (!state.conceptMap || !state.curriculum) invalidContext("validate_module");
        await this.modules.beginStep(state.generationRunId, "validate_module");
        await this.modules.finalizeModule(
          {
            generationRunId: state.generationRunId,
            moduleId: state.moduleId,
            generationRequestId: state.generationRequestId,
          },
          state.conceptMap,
          state.curriculum,
          state.activities,
        );
        return {};
      })
      .addEdge(START, "extract_sources")
      .addConditionalEdges("extract_sources", (state, config) => {
        const analyzed = new Set(Object.keys(state.chunkAnalyses));
        const pending = state.chunks.filter((chunk) => !analyzed.has(chunk.id));
        const contentById = new Map(config.context?.chunks.map((chunk) => [chunk.id, chunk]));
        if (pending.length === 0) return "reduce_material";
        return pending.map((descriptor) => {
          const chunk = contentById.get(descriptor.id);
          if (!chunk) invalidContext("analyze_material");
          return new Send("analyze_chunk", {
            generationRunId: state.generationRunId,
            chunk,
          });
        });
      })
      .addEdge("analyze_chunk", "reduce_material")
      .addEdge("reduce_material", "create_concepts")
      .addEdge("create_concepts", "create_curriculum")
      .addEdge("create_curriculum", "generate_activity")
      .addConditionalEdges("generate_activity", (state) =>
        state.curriculum && state.activityIndex < state.curriculum.nodes.length
          ? "generate_activity"
          : "validate_module",
      )
      .addEdge("validate_module", END)
      .compile({ checkpointer: this.checkpointer, name: "module-generation" });
  }
}
