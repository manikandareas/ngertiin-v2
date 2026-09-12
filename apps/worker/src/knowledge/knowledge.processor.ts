import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { knowledgeIndexingJobSchema } from "@ngertiin/contracts/jobs";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { Worker } from "bullmq";
import { WORKER_ENV } from "../config.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { KnowledgeService } from "./knowledge.service.js";
@Injectable()
export class KnowledgeProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker?: Worker;
  private timer?: ReturnType<typeof setInterval>;
  private scan?: Promise<void>;
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(WORKER_ENV) private readonly env: WorkerEnvironment,
  ) {}
  onApplicationBootstrap(): void {
    this.worker = new Worker(
      QUEUE_NAMES.knowledgeIndexing,
      (job) => this.knowledge.index(knowledgeIndexingJobSchema.parse(job.data)),
      { connection: this.infrastructure.redis, concurrency: this.env.KNOWLEDGE_INDEX_CONCURRENCY },
    );
    this.worker.on("error", () =>
      console.warn(JSON.stringify({ event: "knowledge.worker_error" })),
    );
    this.worker.on("failed", () =>
      console.warn(JSON.stringify({ event: "knowledge.index_failed" })),
    );
    const reconcile = () => {
      if (this.scan) return;
      this.scan = this.knowledge
        .reconcile()
        .catch(() => {
          console.warn(JSON.stringify({ event: "knowledge.reconcile_failed" }));
        })
        .finally(() => {
          this.scan = undefined;
        });
    };
    reconcile();
    this.timer = setInterval(reconcile, this.env.KNOWLEDGE_RECONCILE_INTERVAL_MS);
    this.timer.unref();
  }
  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.scan;
    await this.worker?.close();
  }
}
