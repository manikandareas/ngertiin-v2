import { Module } from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { WORKER_ENV } from "../config.js";
import { AI_MODEL, AiService, createModel } from "./ai.service.js";

@Module({
  providers: [
    {
      provide: AI_MODEL,
      inject: [WORKER_ENV],
      useFactory: (environment: WorkerEnvironment) => createModel(environment),
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
