import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyModule } from "../idempotency/idempotency.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { UsageModule } from "../usage/usage.module.js";
import { ModulesController } from "./modules.controller.js";
import { ModulesService } from "./modules.service.js";

@Module({
  imports: [UsageModule, AuthModule, IdempotencyModule, InfrastructureModule],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
