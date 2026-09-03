import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { ClerkAuthGuard } from "./clerk-auth.guard.js";

@Module({
  imports: [InfrastructureModule],
  providers: [ClerkAuthGuard],
  exports: [ClerkAuthGuard],
})
export class AuthModule {}
