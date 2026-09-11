import { Module } from "@nestjs/common";
import { ModulesModule } from "../modules/modules.module.js";
import { KnowledgeService } from "./knowledge.service.js";
@Module({ imports: [ModulesModule], providers: [KnowledgeService], exports: [KnowledgeService] })
export class KnowledgeModule {}
