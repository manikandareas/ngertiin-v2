import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { usageResponseSchema } from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { UsageService } from "./usage.service.js";

@Controller("me/usage")
@UseGuards(ClerkAuthGuard)
export class UsageController {
  constructor(@Inject(UsageService) private readonly usage: UsageService) {}

  @Get()
  async get(@Req() request: ProductRequest) {
    return usageResponseSchema.parse({ data: await this.usage.read(getLocalUserId(request)) });
  }
}
