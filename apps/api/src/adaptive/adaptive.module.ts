import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyModule } from "../idempotency/idempotency.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AdaptiveController } from "./adaptive.controller.js";
import { AdaptiveService } from "./adaptive.service.js";

@Module({
  imports: [AuthModule, IdempotencyModule, InfrastructureModule],
  controllers: [AdaptiveController],
  providers: [AdaptiveService],
})
export class AdaptiveModule {}
