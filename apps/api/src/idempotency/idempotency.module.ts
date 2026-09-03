import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { IdempotencyService } from "./idempotency.service.js";

@Module({
  imports: [InfrastructureModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
