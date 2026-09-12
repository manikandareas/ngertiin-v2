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
  chatCitationResponseSchema,
  chatMessagesResponseSchema,
  chatPaginationSchema,
  chatRunParamsSchema,
  chatRunResponseSchema,
  chatSendResponseSchema,
  chatThreadParamsSchema,
  chatThreadResponseSchema,
  chatThreadsResponseSchema,
  createChatThreadSchema,
  patchChatThreadSchema,
  type SendChatMessage,
  sendChatMessageSchema,
  uuidSchema,
} from "@ngertiin/contracts/api";
import { z } from "zod";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { IdempotencyKeyPipe } from "../http/idempotency-key.pipe.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import { ChatService } from "./chat.service.js";
import type { ChatEventResponse } from "./chat.stream.js";

const chatScopeParamsSchema = chatThreadParamsSchema.pick({ moduleId: true });
const chatThreadsQuerySchema = chatPaginationSchema.extend({ moduleId: uuidSchema.optional() });
type ThreadParams = z.infer<typeof chatThreadParamsSchema>;
type RunParams = z.infer<typeof chatRunParamsSchema>;
@Controller(["chat", "modules/:moduleId/chat"])
@UseGuards(ClerkAuthGuard)
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}
  @Get("threads/:threadId/messages/:messageId/citations/:citationId")
  async citation(
    @Req() req: ProductRequest,
    @Param(
      new ZodValidationPipe(
        chatThreadParamsSchema.extend({ messageId: uuidSchema, citationId: uuidSchema }),
      ),
    )
    p: ThreadParams & { messageId: string; citationId: string },
  ) {
    return chatCitationResponseSchema.parse({
      data: await this.chat.getCitation(
        getLocalUserId(req),
        await this.chat.resolveThreadModuleId(getLocalUserId(req), p.threadId, p.moduleId),
        p.threadId,
        p.messageId,
        p.citationId,
      ),
    });
  }
  @Post("threads")
  async create(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatScopeParamsSchema)) p: {
      moduleId?: string;
    },
    @Body(new ZodValidationPipe(createChatThreadSchema)) body: z.infer<
      typeof createChatThreadSchema
    >,
  ) {
    // The legacy route owns its module; the canonical route accepts an optional module.
    return chatThreadResponseSchema.parse({
      data: await this.chat.createThread(
        getLocalUserId(req),
        p.moduleId ?? body.moduleId ?? null,
        body.title,
      ),
    });
  }
  @Get("threads")
  async list(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatScopeParamsSchema)) p: {
      moduleId?: string;
    },
    @Query(new ZodValidationPipe(chatThreadsQuerySchema))
    query: z.infer<typeof chatThreadsQuerySchema>,
  ) {
    return chatThreadsResponseSchema.parse(
      await this.chat.listThreads(
        getLocalUserId(req),
        p.moduleId ?? query.moduleId,
        query,
        !p.moduleId,
      ),
    );
  }
  @Get("threads/:threadId")
  async get(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatThreadParamsSchema)) p: ThreadParams,
  ) {
    return chatThreadResponseSchema.parse({
      data: await this.chat.getThread(
        getLocalUserId(req),
        await this.chat.resolveThreadModuleId(getLocalUserId(req), p.threadId, p.moduleId),
        p.threadId,
      ),
    });
  }
  @Patch("threads/:threadId")
  async rename(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatThreadParamsSchema)) p: ThreadParams,
    @Body(new ZodValidationPipe(patchChatThreadSchema)) body: { title: string },
  ) {
    return chatThreadResponseSchema.parse({
      data: await this.chat.renameThread(
        getLocalUserId(req),
        await this.chat.resolveThreadModuleId(getLocalUserId(req), p.threadId, p.moduleId),
        p.threadId,
        body.title,
      ),
    });
  }
  @Delete("threads/:threadId")
  @HttpCode(204)
  async remove(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatThreadParamsSchema)) p: ThreadParams,
  ) {
    await this.chat.deleteThread(
      getLocalUserId(req),
      await this.chat.resolveThreadModuleId(getLocalUserId(req), p.threadId, p.moduleId),
      p.threadId,
    );
  }
  @Get("threads/:threadId/messages")
  async messages(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatThreadParamsSchema)) p: ThreadParams,
    @Query(new ZodValidationPipe(chatPaginationSchema)) query: ChatPagination,
  ) {
    return chatMessagesResponseSchema.parse(
      await this.chat.listMessages(
        getLocalUserId(req),
        await this.chat.resolveThreadModuleId(getLocalUserId(req), p.threadId, p.moduleId),
        p.threadId,
        query,
      ),
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
    const response = chatSendResponseSchema.parse(
      await this.chat.send(
        getLocalUserId(req),
        await this.chat.resolveThreadModuleId(getLocalUserId(req), p.threadId, p.moduleId),
        p.threadId,
        new IdempotencyKeyPipe().transform(key),
        body,
      ),
    );
    const route = p.moduleId ? `/modules/${p.moduleId}/chat` : "/chat";
    return chatSendResponseSchema.parse({
      ...response,
      data: {
        ...response.data,
        eventsUrl: `/api/v1${route}/threads/${p.threadId}/runs/${response.data.runId}/events`,
      },
    });
  }
  @Get("threads/:threadId/runs/:runId")
  async run(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatRunParamsSchema)) p: RunParams,
  ) {
    return chatRunResponseSchema.parse({
      data: await this.chat.getRun(
        getLocalUserId(req),
        await this.chat.resolveThreadModuleId(getLocalUserId(req), p.threadId, p.moduleId),
        p.threadId,
        p.runId,
      ),
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
      data: await this.chat.cancel(
        getLocalUserId(req),
        await this.chat.resolveThreadModuleId(getLocalUserId(req), p.threadId, p.moduleId),
        p.threadId,
        p.runId,
      ),
    });
  }
  @Get("threads/:threadId/runs/:runId/events")
  async events(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(chatRunParamsSchema)) p: RunParams,
    @Res() res: ChatEventResponse,
  ) {
    const userId = getLocalUserId(req);
    await this.chat.stream(
      userId,
      await this.chat.resolveThreadModuleId(userId, p.threadId, p.moduleId),
      p.threadId,
      p.runId,
      res,
    );
  }
}
