import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { LeaderboardController } from "./leaderboard.controller.js";
import { LeaderboardService } from "./leaderboard.service.js";

@Module({
  imports: [AuthModule, InfrastructureModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
