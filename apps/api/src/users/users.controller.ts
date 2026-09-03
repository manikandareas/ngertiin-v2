import { Body, Controller, Get, Inject, Patch, Req, UseGuards } from "@nestjs/common";
import {
  type GetCurrentUserResponse,
  getCurrentUserResponseSchema,
  type PatchCurrentUserBody,
  type PatchCurrentUserResponse,
  patchCurrentUserBodySchema,
  patchCurrentUserResponseSchema,
} from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import { UsersService } from "./users.service.js";

@Controller("me")
@UseGuards(ClerkAuthGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  async getCurrentUser(@Req() request: ProductRequest): Promise<GetCurrentUserResponse> {
    const user = await this.usersService.getCurrentUser(getLocalUserId(request));
    return getCurrentUserResponseSchema.parse({ data: user });
  }

  @Patch()
  async updateCurrentUser(
    @Req() request: ProductRequest,
    @Body(new ZodValidationPipe(patchCurrentUserBodySchema)) input: PatchCurrentUserBody,
  ): Promise<PatchCurrentUserResponse> {
    const user = await this.usersService.updateCurrentUser(getLocalUserId(request), input);
    return patchCurrentUserResponseSchema.parse({ data: user });
  }
}
