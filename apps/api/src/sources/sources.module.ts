import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyModule } from "../idempotency/idempotency.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { UsageModule } from "../usage/usage.module.js";
import { SourcesController } from "./sources.controller.js";
import { SourcesService } from "./sources.service.js";

@Module({
  imports: [UsageModule, AuthModule, IdempotencyModule, InfrastructureModule],
  controllers: [SourcesController],
  providers: [SourcesService],
})
export class SourcesModule {}
