import { Module } from "@nestjs/common";
import { ClerkVerifierService } from "./clerk-verifier.service.js";

@Module({
  providers: [ClerkVerifierService],
  exports: [ClerkVerifierService],
})
export class AuthModule {}
