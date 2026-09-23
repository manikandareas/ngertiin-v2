import "reflect-metadata";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import type { AiService } from "../ai/ai.service.js";
import type { LessonImagesService } from "./lesson-images.service.js";
import type { ConceptMap, CurriculumPlan, NodeActivities } from "./modules.schemas.js";
import type { ModulesService } from "./modules.service.js";
import { ModulesWorkflow } from "./modules.workflow.js";

const databaseUrl = process.env.MODULE_WORKFLOW_TEST_DATABASE_URL;
const curriculum: CurriculumPlan = {
  title: "Recovery fixture",
  description: null,
  difficulty: "beginner",
  estimatedMinutes: 10,
  nodes: Array.from({ length: 7 }, (_, i) => ({
    key: `node_${i}`,
    title: `Node ${i}`,
    description: null,
    type: "lesson",
    concepts: [{ conceptKey: "concept", relation: "teach", weight: 1 }],
  })),
};
const conceptMap: ConceptMap = {
  concepts: [
    {
      key: "concept",
      name: "Concept",
      description: null,
      importance: 1,
      prerequisites: [],
      evidenceChunkIds: ["chunk"],
    },
  ],
};
const context = {
  instruction: null,
  generationSettings: null,
  chunks: [
    {
      id: "chunk",
      sourceId: "source",
      sourceTitle: "Source",
      role: "primary" as const,
      priority: 1,
      start: 0,
      end: 8,
      content: "Evidence",
    },
  ],
};
function output(key: string): NodeActivities {
  return {
    activities: [
      {
        type: "lesson",
        content: { format: "markdown", title: key, body: key, images: [] },
      },
    ],
  };
}

// Reproduce the old replacement reducer and the old next-node name, without
// importing the new graph's state definition.
async function legacyCheckpoint(
  saver: PostgresSaver,
  payload: {
    generationRunId: string;
    moduleId: string;
    generationRequestId: string;
  },
  activityIndex = 1,
) {
  const state = Annotation.Root({
    generationRunId: Annotation<string>(),
    moduleId: Annotation<string>(),
    generationRequestId: Annotation<string>(),
    conceptMap: Annotation<ConceptMap>(),
    curriculum: Annotation<CurriculumPlan>(),
    activities: Annotation<Record<string, NodeActivities>>({
      reducer: (_current, next) => next,
      default: () => ({}),
    }),
    activityIndex: Annotation<number>({ reducer: (_current, next) => next, default: () => 0 }),
  });
  const graph = new StateGraph(state)
    .addNode("create_curriculum", async () => ({
      curriculum,
      conceptMap,
      activities: { node_0: output("node_0") },
      activityIndex,
    }))
    .addNode("generate_activity", async () => ({}))
    .addEdge(START, "create_curriculum")
    .addEdge("create_curriculum", "generate_activity")
    .addEdge("generate_activity", END)
    .compile({ checkpointer: saver, interruptBefore: ["generate_activity"] });
  await graph.invoke(payload, {
    configurable: { thread_id: payload.generationRunId },
    durability: "sync",
  });
}

for (const [failedKeys, legacyIndex] of [
  [[], 1],
  [[], 7],
  [["node_2"], 1],
  [["node_1", "node_2"], 1],
] as const) {
  test(`Postgres: serial checkpoint, parallel slots, restart with ${failedKeys.length} failures and cursor ${legacyIndex}`, {
    skip: !databaseUrl,
  }, async () => {
    const environment = { DATABASE_URL: databaseUrl } as WorkerEnvironment;
    const payload = {
      generationRunId: randomUUID(),
      moduleId: randomUUID(),
      generationRequestId: randomUUID(),
    };
    assert.ok(databaseUrl);
    const saver = PostgresSaver.fromConnString(databaseUrl, { schema: "langgraph" });
    await saver.setup();
    const calls: string[] = [];
    const finished: string[] = [];
    const progress: number[] = [];
    let active = 0;
    let peak = 0;
    let shouldFail = true;
    let finalized = 0;
    const ai = {
      async generateObject(request: { prompt: string }) {
        const nodeJson = request.prompt.split("NODE:\n\n")[1]?.split("\n\nCONCEPTS:")[0];
        assert.ok(nodeJson);
        const node = JSON.parse(nodeJson);
        calls.push(node.key);
        if (node.key === "node_5" && !failedKeys.length) {
          assert.ok(!finished.includes("node_1"), "refill while a slow sibling is still enriching");
        }
        peak = Math.max(peak, ++active);
        await delay(node.key === "node_1" ? 5 : 15);
        return output(node.key);
      },
    } as unknown as AiService;
    const images = {
      async enrich(value: NodeActivities, _run: string, key: string) {
        await delay(
          shouldFail && failedKeys.some((failedKey) => failedKey === key)
            ? 80
            : key === "node_1"
              ? failedKeys.length
                ? 35
                : 150
              : 5,
        );
        active--;
        if (shouldFail && failedKeys.some((failedKey) => failedKey === key))
          throw new Error(`injected ${key}`);
        finished.push(key);
        return value;
      },
    } as unknown as LessonImagesService;
    const modules = {
      async beginStep() {},
      async completeStep(_run: string, step: string) {
        if (step === "generate_activities") assert.equal(new Set(["node_0", ...finished]).size, 7);
      },
      async updateActivityProgress(_run: string, completed: number) {
        progress.push(completed);
        if (completed === 2 && !failedKeys.length) {
          assert.ok(!finished.includes("node_1"), "publish progress while a sibling is enriching");
        }
      },
      async finalizeModule(
        _payload: unknown,
        _concepts: unknown,
        plan: CurriculumPlan,
        results: Record<string, NodeActivities>,
      ) {
        finalized++;
        assert.deepEqual(Object.keys(results).sort(), plan.nodes.map((node) => node.key).sort());
        assert.deepEqual(
          plan.nodes.map((node) => results[node.key]),
          curriculum.nodes.map((node) => output(node.key)),
        );
      },
    } as unknown as ModulesService;
    let workflow = new ModulesWorkflow(environment, images, ai, modules);
    try {
      await legacyCheckpoint(saver, payload, legacyIndex);
      if (failedKeys.length) {
        await assert.rejects(workflow.run(payload, context));
        assert.equal(finalized, 0);
        const tuple = await saver.getTuple({
          configurable: { thread_id: payload.generationRunId },
        });
        assert.ok(
          tuple?.pendingWrites?.some(([, channel]) => channel === "activities"),
          "successful sibling writes must be durable before restart",
        );
        await workflow.onApplicationShutdown();
        shouldFail = false;
        workflow = new ModulesWorkflow(environment, images, ai, modules);
      }
      await workflow.run(payload, context);
      assert.equal(active, 0);
      assert.equal(peak, 4);
      if (!failedKeys.length)
        assert.notDeepEqual(
          finished,
          curriculum.nodes.slice(1).map((node) => node.key),
        );
      assert.equal(finalized, 1);
      assert.ok(!calls.includes("node_0"), "legacy completed node must be reused");
      for (const node of curriculum.nodes.slice(1)) {
        assert.equal(
          calls.filter((key) => key === node.key).length,
          failedKeys.some((failedKey) => failedKey === node.key) ? 2 : 1,
          "only failed siblings may repeat",
        );
      }
      assert.deepEqual(
        progress,
        [...progress].sort((a, b) => a - b),
      );
      assert.ok(progress.includes(2), "progress must include an individual node completion");
      assert.equal(progress.at(-1), 7);
      await workflow.run(payload, context);
      assert.equal(finalized, 1, "completed checkpoint must not finalize twice");
    } finally {
      await workflow.onApplicationShutdown();
      await saver.deleteThread(payload.generationRunId);
      await saver.end();
    }
  });
}

test("Postgres: SIGKILL and a new process reuse durable sibling writes", {
  skip: !databaseUrl,
  timeout: 15000,
}, async () => {
  const payload = {
    generationRunId: randomUUID(),
    moduleId: randomUUID(),
    generationRequestId: randomUUID(),
  };
  assert.ok(databaseUrl);
  const saver = PostgresSaver.fromConnString(databaseUrl, { schema: "langgraph" });
  const directory = await mkdtemp(join(tmpdir(), "module-recovery-"));
  const logPath = join(directory, "calls.jsonl");
  const script = String.raw`
      import { appendFileSync } from "node:fs";
      import { ModulesWorkflow } from ${JSON.stringify(new URL("./modules.workflow.ts", import.meta.url).pathname)};
      const record = (value) => appendFileSync(process.env.RECOVERY_LOG, JSON.stringify(value) + "\n");
      const ai = { async generateObject(request) {
        const node = JSON.parse(request.prompt.split("NODE:\n\n")[1].split("\n\nCONCEPTS:")[0]);
        record({call: node.key});
        return {activities: [{type: "lesson", content: {
          format: "markdown", title: node.key, body: node.key, images: []
        }}]};
      }};
      const images = {async enrich(value, run, key) {
        if (process.env.RECOVERY_HANG === "yes" && key === "node_3") {
          await new Promise(() => { setInterval(() => {}, 1000); });
        }
        return value;
      }};
      const modules = {
        async beginStep() {}, async completeStep() {}, async updateActivityProgress() {},
        async finalizeModule(payload, concepts, curriculum, results) {
          record({finalized: curriculum.nodes.map(node => results[node.key].activities[0].content.title)});
        }
      };
      const workflow = new ModulesWorkflow({DATABASE_URL: process.env.MODULE_WORKFLOW_TEST_DATABASE_URL},
        images, ai, modules);
      await workflow.run(${JSON.stringify(payload)}, ${JSON.stringify(context)});
      await workflow.onApplicationShutdown();
    `;
  let child: ReturnType<typeof spawn> | undefined;
  try {
    await saver.setup();
    await legacyCheckpoint(saver, payload);
    child = spawn(process.execPath, ["--eval", script], {
      env: { ...process.env, RECOVERY_LOG: logPath, RECOVERY_HANG: "yes" },
      stdio: ["ignore", "ignore", "inherit"],
    });
    const exited = new Promise((resolve) => child?.once("exit", resolve));
    const deadline = Date.now() + 7000;
    let durable = false;
    while (Date.now() < deadline) {
      const tuple = await saver.getTuple({ configurable: { thread_id: payload.generationRunId } });
      if (
        (tuple?.pendingWrites?.filter(([, channel]) => channel === "activities").length ?? 0) >= 2
      ) {
        durable = true;
        break;
      }
      await delay(25);
    }
    assert.ok(durable, "two siblings must reach PostgreSQL before killing the worker");
    child.kill("SIGKILL");
    await exited;
    child = spawn(process.execPath, ["--eval", script], {
      env: { ...process.env, RECOVERY_LOG: logPath, RECOVERY_HANG: "no" },
      stdio: ["ignore", "ignore", "inherit"],
    });
    const code = await new Promise((resolve) => child?.once("exit", resolve));
    assert.equal(code, 0);
    const records = (await readFile(logPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    for (const key of ["node_1", "node_2"]) {
      assert.equal(records.filter((record) => record.call === key).length, 1);
    }
    assert.equal(records.filter((record) => record.call === "node_3").length, 2);
    assert.deepEqual(
      records.filter((record) => record.finalized).map((record) => record.finalized),
      [curriculum.nodes.map((node) => node.key)],
    );
  } finally {
    child?.kill("SIGKILL");
    await saver.deleteThread(payload.generationRunId);
    await saver.end();
    await rm(directory, { recursive: true, force: true });
  }
});
