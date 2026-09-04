import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AttemptsController } from "./attempts.controller.js";
import { AttemptsService } from "./attempts.service.js";

@Module({
  imports: [AuthModule, InfrastructureModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
})
export class AttemptsModule {}
