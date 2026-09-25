import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { PracticeController } from "./practice.controller.js";
import { PracticeService } from "./practice.service.js";

@Module({
  imports: [AuthModule, InfrastructureModule],
  controllers: [PracticeController],
  providers: [PracticeService],
  exports: [PracticeService],
})
export class PracticeModule {}
