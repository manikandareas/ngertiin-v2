import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AuthService } from "./auth.service.js";
import { ClerkAuthGuard } from "./clerk-auth.guard.js";

@Module({
  imports: [InfrastructureModule],
  providers: [ClerkAuthGuard, AuthService],
  exports: [ClerkAuthGuard, AuthService],
})
export class AuthModule {}
