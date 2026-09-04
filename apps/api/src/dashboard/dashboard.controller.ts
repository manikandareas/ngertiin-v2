import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { type GetDashboardResponse, getDashboardResponseSchema } from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
@UseGuards(ClerkAuthGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get()
  async getDashboard(@Req() request: ProductRequest): Promise<GetDashboardResponse> {
    const dashboard = await this.dashboard.getDashboard(getLocalUserId(request));
    return getDashboardResponseSchema.parse({ data: dashboard });
  }
}
