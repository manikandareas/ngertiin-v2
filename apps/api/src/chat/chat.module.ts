import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyModule } from "../idempotency/idempotency.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { ModulesModule } from "../modules/modules.module.js";
import { ChatController } from "./chat.controller.js";
import { ChatService } from "./chat.service.js";
import { ChatAttachmentsController } from "./chat-attachments.controller.js";
import { ChatAttachmentsService } from "./chat-attachments.service.js";
import { ChatMaterialsController } from "./chat-materials.controller.js";
@Module({
  imports: [
    KnowledgeModule,
    AiModule,
    AuthModule,
    IdempotencyModule,
    InfrastructureModule,
    ModulesModule,
  ],
  controllers: [ChatAttachmentsController, ChatController, ChatMaterialsController],
  providers: [ChatAttachmentsService, ChatService],
})
export class ChatModule {}
