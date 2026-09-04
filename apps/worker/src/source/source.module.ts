import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { SourceService } from "./source.service.js";

@Module({
  imports: [InfrastructureModule],
  providers: [SourceService],
  exports: [SourceService],
})
export class SourceModule {}
