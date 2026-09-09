import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
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
import { AvatarService } from "./avatar.service.js";
import { type AvatarUpload, MAX_AVATAR_BYTES } from "./avatar-image.js";
import { UsersService } from "./users.service.js";

@Controller("me")
@UseGuards(ClerkAuthGuard)
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(AvatarService) private readonly avatars: AvatarService,
  ) {}

  @Post("avatar")
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_AVATAR_BYTES, files: 1, fields: 0 } }),
  )
  async uploadAvatar(
    @Req() request: ProductRequest,
    @UploadedFile() file: AvatarUpload | undefined,
  ): Promise<GetCurrentUserResponse> {
    const userId = getLocalUserId(request);
    await this.avatars.upload(userId, file);
    return getCurrentUserResponseSchema.parse({
      data: await this.usersService.getCurrentUser(userId),
    });
  }

  @Delete("avatar")
  async resetAvatar(@Req() request: ProductRequest): Promise<GetCurrentUserResponse> {
    const userId = getLocalUserId(request);
    await this.avatars.replace(userId, null);
    return getCurrentUserResponseSchema.parse({
      data: await this.usersService.getCurrentUser(userId),
    });
  }

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
