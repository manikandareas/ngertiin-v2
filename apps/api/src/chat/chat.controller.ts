import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  type ChatPagination,
  chatMessagesResponseSchema,
  chatPaginationSchema,
  chatRunParamsSchema,
  chatRunResponseSchema,
  chatSendResponseSchema,
  chatThreadParamsSchema,
  chatThreadResponseSchema,
  chatThreadsResponseSchema,
  createChatThreadSchema,
  moduleParamsSchema,
  patchChatThreadSchema,
  type SendChatMessage,
  sendChatMessageSchema,
} from "@ngertiin/contracts/api";
import { z } from "zod";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { IdempotencyKeyPipe } from "../http/idempotency-key.pipe.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import { ChatService } from "./chat.service.js";
import { type ChatEventResponse, streamChatSnapshots } from "./chat.stream.js";

type ThreadParams = { moduleId: string; threadId: string };
type RunParams = ThreadParams & { runId: string };
@Controller("modules/:moduleId/chat")
@UseGuards(ClerkAuthGuard)
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}
  @Post("threads")
  async create(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(moduleParamsSchema)) p: { moduleId: string },
    @Body(new ZodValidationPipe(createChatThreadSchema)) body: { title?: string },
  ) {
    return chatThreadResponseSchema.parse({
      data: await this.chat.createThread(getLocalUserId(req), p.moduleId, body.title),
    });
  }
  @Get("threads")
  async list(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(moduleParamsSchema)) p: { moduleId: string },
    @Query(new ZodValidationPipe(chatPaginationSchema)) query: ChatPagination,
  ) {
    return chatThreadsResponseSchema.parse(
      await this.chat.listThreads(getLocalUserId(req), p.moduleId, query),
    );
  }
  @Get("threads/:threadId")
  async get(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatThreadParamsSchema)) p: ThreadParams,
  ) {
    return chatThreadResponseSchema.parse({
      data: await this.chat.getThread(getLocalUserId(req), p.moduleId, p.threadId),
    });
  }
  @Patch("threads/:threadId")
  async rename(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatThreadParamsSchema)) p: ThreadParams,
    @Body(new ZodValidationPipe(patchChatThreadSchema)) body: { title: string },
  ) {
    return chatThreadResponseSchema.parse({
      data: await this.chat.renameThread(getLocalUserId(req), p.moduleId, p.threadId, body.title),
    });
  }
  @Delete("threads/:threadId")
  @HttpCode(204)
  async remove(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatThreadParamsSchema)) p: ThreadParams,
  ) {
    await this.chat.deleteThread(getLocalUserId(req), p.moduleId, p.threadId);
  }
  @Get("threads/:threadId/messages")
  async messages(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatThreadParamsSchema)) p: ThreadParams,
    @Query(new ZodValidationPipe(chatPaginationSchema)) query: ChatPagination,
  ) {
    return chatMessagesResponseSchema.parse(
      await this.chat.listMessages(getLocalUserId(req), p.moduleId, p.threadId, query),
    );
  }
  @Post("threads/:threadId/messages")
  @HttpCode(202)
  async send(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatThreadParamsSchema)) p: ThreadParams,
    @Headers("idempotency-key") key: unknown,
    @Body(new ZodValidationPipe(sendChatMessageSchema)) body: SendChatMessage,
  ) {
    return chatSendResponseSchema.parse(
      await this.chat.send(
        getLocalUserId(req),
        p.moduleId,
        p.threadId,
        new IdempotencyKeyPipe().transform(key),
        body,
      ),
    );
  }
  @Get("threads/:threadId/runs/:runId")
  async run(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatRunParamsSchema)) p: RunParams,
  ) {
    return chatRunResponseSchema.parse({
      data: await this.chat.getRun(getLocalUserId(req), p.moduleId, p.threadId, p.runId),
    });
  }
  @Post("threads/:threadId/runs/:runId/cancel")
  @HttpCode(200)
  async cancel(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatRunParamsSchema)) p: RunParams,
    @Body(new ZodValidationPipe(z.object({}).strict())) _body: Record<string, never>,
  ) {
    return chatRunResponseSchema.parse({
      data: await this.chat.cancel(getLocalUserId(req), p.moduleId, p.threadId, p.runId),
    });
  }
  @Get("threads/:threadId/runs/:runId/events")
  async events(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatRunParamsSchema)) p: RunParams,
    @Res() res: ChatEventResponse,
  ) {
    const userId = getLocalUserId(req);
    const read = () => this.chat.streamSnapshot(userId, p.moduleId, p.threadId, p.runId);
    await streamChatSnapshots(res, read);
  }
}
