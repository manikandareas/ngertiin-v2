import { Annotation, END, Send, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { GenerationSettings } from "@ngertiin/contracts/api";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import type { ModuleGenerationJob } from "@ngertiin/contracts/jobs";
import { AiService } from "../ai/ai.service.js";
import { WORKER_ENV } from "../config.js";
import type { ChunkDescriptor, SourceChunk } from "../source/source.service.js";
import { LessonImagesService } from "./lesson-images.service.js";
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
  CurriculumNode,
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
    reducer: (current, next) => ({ ...current, ...next }),
    default: () => ({}),
  }),
  activityIndex: Annotation<number>({
    reducer: (_current, next) => next,
    default: () => 0,
  }),
});

const WorkflowContext = Annotation.Root({
  instruction: Annotation<string | null>(),
  generationSettings: Annotation<GenerationSettings | null>(),
  chunks: Annotation<SourceChunk[]>(),
});

const ChunkWorkerState = Annotation.Root({
  generationRunId: Annotation<string>(),
  chunk: Annotation<SourceChunk>(),
});

const ActivityWorkerState = Annotation.Root({
  generationRunId: Annotation<string>(),
  node: Annotation<CurriculumNode>(),
  conceptMap: Annotation<ConceptMap>(),
});

@Injectable()
export class ModulesWorkflow implements OnModuleInit, OnApplicationShutdown {
  private readonly checkpointer: PostgresSaver;
  private readonly graph: ReturnType<ModulesWorkflow["buildGraph"]>;

  constructor(
    @Inject(WORKER_ENV) environment: WorkerEnvironment,
    @Inject(LessonImagesService) private readonly lessonImages: LessonImagesService,
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
    context: {
      instruction: string | null;
      chunks: SourceChunk[];
      generationSettings: GenerationSettings | null;
    },
  ): Promise<void> {
    const config = {
      configurable: { thread_id: payload.generationRunId },
      context,
      durability: "sync" as const,
      maxConcurrency: 4,
      recursionLimit: 64,
    };
    const checkpoint = await this.checkpointer.getTuple(config);
    // Track streamed completions per invocation, including cached sibling updates
    // replayed on resume. LangGraph remains the owner of durable activity results.
    const completed = new Set<string>();
    for (const [, channel, value] of checkpoint?.pendingWrites ?? []) {
      if (channel === "activities" && value && typeof value === "object") {
        for (const key of Object.keys(value)) completed.add(key);
      }
    }
    let curriculumKeys = new Set<string>();
    const stream = await this.graph.stream(checkpoint ? null : payload, {
      ...config,
      streamMode: ["values", "updates"],
    });
    for await (const [mode, value] of stream) {
      if (mode === "values") {
        curriculumKeys = new Set(value.curriculum?.nodes.map((node) => node.key));
        for (const key of Object.keys(value.activities)) completed.add(key);
      } else if (value.generate_activity_node?.activities) {
        for (const key of Object.keys(value.generate_activity_node.activities)) completed.add(key);
        await this.modules.updateActivityProgress(
          payload.generationRunId,
          [...completed].filter((key) => curriculumKeys.has(key)).length,
          curriculumKeys.size,
        );
      }
    }
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
              buildChunkAnalysisRequest(
                state.chunk,
                runtime.context?.instruction ?? null,
                runtime.context?.generationSettings ?? null,
              ),
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
            runtime.context?.generationSettings ?? null,
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
          buildConceptMapRequest(
            state.materialAnalysis,
            runtime.context?.instruction ?? null,
            runtime.context?.generationSettings ?? null,
          ),
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
            runtime.context?.generationSettings ?? null,
          ),
        );
        await this.modules.completeStep(state.generationRunId, "create_curriculum", {
          nodeCount: curriculum.nodes.length,
        });
        return { curriculum };
      })
      .addNode("generate_activity", async (state) => {
        // Keep this coordinator and activityIndex readable by serial checkpoints.
        // Activities, rather than the legacy cursor, are the source of truth.
        if (!state.conceptMap || !state.curriculum?.nodes.length) {
          invalidContext("generate_activities");
        }
        await this.modules.beginStep(state.generationRunId, "generate_activities");
        const completed = new Set(
          state.curriculum.nodes
            .filter((node) => state.activities[node.key])
            .map((node) => node.key),
        ).size;
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
        return { activityIndex: completed };
      })
      .addNode(
        "generate_activity_node",
        async (state, runtime) => {
          const chunks = runtime.context?.chunks;
          if (!chunks?.length) invalidContext("generate_activities");
          const output = await this.ai.generateObject(
            buildActivityGenerationRequest(
              state.node,
              state.conceptMap,
              chunks,
              runtime.context?.instruction ?? null,
              runtime.context?.generationSettings ?? null,
            ),
          );
          const enriched = await this.lessonImages.enrich(
            output,
            state.generationRunId,
            state.node.key,
          );
          return { activities: { [state.node.key]: enriched } };
        },
        { input: ActivityWorkerState },
      )
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
      .addConditionalEdges("generate_activity", (state) => {
        if (!state.curriculum || !state.conceptMap) invalidContext("generate_activities");
        const pending = state.curriculum.nodes.filter((node) => !state.activities[node.key]);
        if (!pending.length) return "validate_module";
        // The runner refills free slots immediately, retaining each task's pending
        // writes for recovery without waiting for a fixed batch boundary.
        return pending.map(
          (node) =>
            new Send("generate_activity_node", {
              generationRunId: state.generationRunId,
              node,
              conceptMap: state.conceptMap,
            }),
        );
      })
      .addEdge("generate_activity_node", "generate_activity")
      .addEdge("validate_module", END)
      .compile({ checkpointer: this.checkpointer, name: "module-generation" });
  }
}
