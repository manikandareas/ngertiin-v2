import { Global, Module } from "@nestjs/common";
import { loadWorkerEnvironment, WORKER_ENV } from "./config.js";

@Global()
@Module({
  providers: [
    {
      provide: WORKER_ENV,
      useFactory: () => loadWorkerEnvironment(process.env),
    },
  ],
  exports: [WORKER_ENV],
})
export class ConfigModule {}
