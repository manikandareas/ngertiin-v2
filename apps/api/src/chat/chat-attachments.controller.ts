import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  CHAT_ATTACHMENT_MAX_BYTES,
  chatAttachmentDownloadSchema,
  chatAttachmentResponseSchema,
  uuidSchema,
} from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import type { AttachmentUpload } from "./chat-attachment-validation.js";
import { attachmentDto, ChatAttachmentsService } from "./chat-attachments.service.js";
@Controller("chat/attachments")
@UseGuards(ClerkAuthGuard)
export class ChatAttachmentsController {
  constructor(
    @Inject(ChatAttachmentsService) private readonly attachments: ChatAttachmentsService,
  ) {}
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      // Busboy emits its limit event at equality; the public maximum is inclusive.
      // Validation still rejects anything above MAX_BYTES before storage.
      limits: { fileSize: CHAT_ATTACHMENT_MAX_BYTES + 1, files: 1, fields: 0 },
    }),
  )
  async upload(@Req() req: ProductRequest, @UploadedFile() file?: AttachmentUpload) {
    return chatAttachmentResponseSchema.parse({
      data: await this.attachments.upload(getLocalUserId(req), file),
    });
  }
  @Get(":id")
  @Header("Cache-Control", "no-store")
  async metadata(
    @Req() req: ProductRequest,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
  ) {
    return chatAttachmentResponseSchema.parse({
      data: attachmentDto(await this.attachments.owned(getLocalUserId(req), id)),
    });
  }
  @Get(":id/download")
  @Header("Cache-Control", "no-store")
  async download(
    @Req() req: ProductRequest,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
  ) {
    return chatAttachmentDownloadSchema.parse({
      data: await this.attachments.download(getLocalUserId(req), id),
    });
  }
  @Delete(":id")
  @HttpCode(204)
  async remove(
    @Req() req: ProductRequest,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
  ) {
    await this.attachments.remove(getLocalUserId(req), id);
  }
}
