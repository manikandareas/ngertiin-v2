import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  ChatCitationSnapshot,
  ChatContextReference,
  ChatMaterialTarget,
} from "@ngertiin/contracts/api";
import { ProductError } from "../http/product-error.js";
import { ModulesService } from "../modules/modules.service.js";

@Injectable()
export class KnowledgeService {
  constructor(@Inject(ModulesService) private readonly modules: ModulesService) {}
  private async material(userId: string, moduleId: string, target: ChatMaterialTarget) {
    const material = await this.modules.readChatMaterial(userId, moduleId, target);
    const text = material.text.replace(/\r\n?/g, "\n").normalize("NFC");
    return {
      ...material,
      text,
      contentRevision: createHash("sha256").update(`chat-material-v1\n${text}`).digest("hex"),
    };
  }
  async preview(
    userId: string,
    moduleId: string,
    target: ChatMaterialTarget,
    startCodePoint: number,
  ) {
    const material = await this.material(userId, moduleId, target);
    const points = [...material.text];
    if (startCodePoint >= points.length) this.invalidRange();
    const endCodePoint = Math.min(points.length, startCodePoint + 12000);
    return {
      target,
      title: material.title,
      pageNumber: material.pageNumber,
      sectionTitle: material.sectionTitle,
      text: points.slice(startCodePoint, endCodePoint).join(""),
      totalCodePoints: points.length,
      reference: {
        ...target,
        contentRevision: material.contentRevision,
        startCodePoint,
        endCodePoint,
      },
    };
  }
  async readExcerpt(
    userId: string,
    moduleId: string,
    reference: ChatContextReference,
    maxCodePoints: number,
  ): Promise<ChatCitationSnapshot> {
    const material = await this.material(userId, moduleId, reference);
    if (reference.contentRevision !== material.contentRevision)
      throw new ProductError(
        409,
        "CONTEXT_STALE",
        "Context changed",
        "Materi berubah. Pilih kembali kutipannya.",
      );
    const points = [...material.text];
    if (
      reference.endCodePoint > points.length ||
      reference.endCodePoint - reference.startCodePoint > maxCodePoints
    )
      this.invalidRange();
    // Keep the exact model-visible context, including a bounded amount around the highlight.
    const startCodePoint = Math.max(0, reference.startCodePoint - 400);
    const end = Math.min(points.length, reference.endCodePoint + 400);
    return {
      citation: {
        id: randomUUID(),
        origin: reference.kind === "source" ? "original_source" : "generated_material",
        title: material.title,
        reference,
        excerpt: points.slice(reference.startCodePoint, reference.endCodePoint).join(""),
        pageNumber: material.pageNumber,
        sectionTitle: material.sectionTitle,
      },
      text: points.slice(startCodePoint, end).join(""),
      startCodePoint,
      capturedAt: new Date().toISOString(),
    };
  }
  private invalidRange(): never {
    throw new ProductError(
      422,
      "VALIDATION_ERROR",
      "Invalid range",
      "Rentang kutipan tidak valid atau terlalu panjang.",
    );
  }
}
