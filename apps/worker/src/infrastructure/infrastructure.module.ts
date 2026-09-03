import { Module } from "@nestjs/common";
import { InfrastructureService } from "./infrastructure.service.js";

@Module({
  providers: [InfrastructureService],
})
export class InfrastructureModule {}
