import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type ChatMaterialTarget,
  chatMaterialPreviewInputSchema,
  chatMaterialPreviewResponseSchema,
  chatMaterialsQuerySchema,
  chatMaterialsResponseSchema,
  moduleParamsSchema,
} from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import { ChatService } from "./chat.service.js";

@Controller("modules/:moduleId/chat")
@UseGuards(ClerkAuthGuard)
export class ChatMaterialsController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}
  @Get("materials")
  async materials(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(moduleParamsSchema)) p: { moduleId: string },
    @Query(new ZodValidationPipe(chatMaterialsQuerySchema)) query: {
      nodeId?: string;
      after?: string;
    },
  ) {
    return chatMaterialsResponseSchema.parse({
      data: await this.chat.listMaterials(getLocalUserId(req), p.moduleId, query),
    });
  }
  @Post("materials/preview")
  @HttpCode(200)
  async preview(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(moduleParamsSchema)) p: { moduleId: string },
    @Body(new ZodValidationPipe(chatMaterialPreviewInputSchema)) body: {
      target: ChatMaterialTarget;
      startCodePoint: number;
    },
  ) {
    return chatMaterialPreviewResponseSchema.parse({
      data: await this.chat.previewMaterial(
        getLocalUserId(req),
        p.moduleId,
        body.target,
        body.startCodePoint,
      ),
    });
  }
}
