import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { type GetLeaderboardResponse, getLeaderboardResponseSchema } from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { LeaderboardService } from "./leaderboard.service.js";

@Controller("leaderboard")
@UseGuards(ClerkAuthGuard)
export class LeaderboardController {
  constructor(@Inject(LeaderboardService) private readonly leaderboard: LeaderboardService) {}

  @Get()
  async getLeaderboard(@Req() request: ProductRequest): Promise<GetLeaderboardResponse> {
    const leaderboard = await this.leaderboard.getLeaderboard(getLocalUserId(request));
    return getLeaderboardResponseSchema.parse({ data: leaderboard });
  }
}
