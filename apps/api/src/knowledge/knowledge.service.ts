import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  ChatCitationSnapshot,
  ChatContextReference,
  ChatMaterialTarget,
} from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { knowledge_index_versions } from "@ngertiin/database";
import {
  KNOWLEDGE_NORMALIZER,
  MATERIAL_EXCERPT_PADDING,
  materialRevision,
  normalizeMaterial,
} from "@ngertiin/shared/knowledge";
import { eq, sql } from "drizzle-orm";
import { AiService } from "../ai/ai.service.js";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { ModulesService } from "../modules/modules.service.js";

type SearchResult = {
  status: "INDEX_NOT_READY" | "ready";
  degraded: boolean;
  snapshots: ChatCitationSnapshot[];
};

type SearchDocument = Awaited<ReturnType<ModulesService["chatSearchDocuments"]>>[number];

function materialTarget(document: SearchDocument): ChatMaterialTarget | null {
  if (document.source_content_id && document.source_id) {
    return {
      kind: "source",
      sourceId: document.source_id,
      sourceContentId: document.source_content_id,
    };
  }
  if (document.node_id && document.activity_id) {
    return { kind: "activity", nodeId: document.node_id, activityId: document.activity_id };
  }
  return null;
}

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(ModulesService) private readonly modules: ModulesService,
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(API_ENV) private readonly env: ApiEnvironment,
  ) {}
  private async material(userId: string, moduleId: string, target: ChatMaterialTarget) {
    const material = await this.modules.readChatMaterial(userId, moduleId, target);
    const text = normalizeMaterial(material.text);
    return {
      ...material,
      text,
      contentRevision: materialRevision(text),
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
    const startCodePoint = Math.max(0, reference.startCodePoint - MATERIAL_EXCERPT_PADDING);
    const end = Math.min(points.length, reference.endCodePoint + MATERIAL_EXCERPT_PADDING);
    return {
      moduleId,
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
  async search(
    userId: string,
    moduleId: string,
    query: string,
    maxCodePoints: number,
    nodeId?: string,
  ): Promise<SearchResult> {
    await this.modules.validateChatScope(userId, moduleId, nodeId);
    const unavailable: SearchResult = {
      status: "INDEX_NOT_READY",
      degraded: false,
      snapshots: [],
    };
    const db = this.infrastructure.database.db;
    const [version] = await db
      .select()
      .from(knowledge_index_versions)
      .where(eq(knowledge_index_versions.status, "active"));
    if (
      !version ||
      version.normalizer_version !== KNOWLEDGE_NORMALIZER ||
      version.dimensions !== 1536
    )
      return unavailable;
    const documents = (await this.modules.chatSearchDocuments(userId, moduleId)).filter(
      (document) => !nodeId || document.node_id === nodeId,
    );
    const documentsById = new Map(documents.map((document) => [document.id, document]));
    const documentIds = documents.flatMap((document) => (document.id ? [document.id] : []));
    const ids = documents.flatMap((item) =>
      item.id && item.current_content_revision ? [item.id] : [],
    );
    if (!ids.length) return unavailable;
    let embedding: number[] | undefined;
    try {
      embedding = (
        await this.ai.embedMaterials([query], version.embedding_model, version.dimensions)
      )[0];
    } catch {
      /* A query-provider failure preserves the lexical path. */
    }
    const eligible = sql`select c.id, c.document_revision_id, c.location_json, c.search_vector, c.embedding, r.document_id, r.content_revision
      from knowledge_chunks c join knowledge_document_revisions r on r.id = c.document_revision_id
      join knowledge_documents d on d.id = r.document_id
      where d.id = any(${`{${ids.join(",")}}`}::uuid[]) and d.deleted_at is null and r.status = 'ready'
      and r.index_version_id = ${version.id} and r.content_revision = d.current_content_revision`;
    type Hit = {
      id: string;
      document_id: string;
      content_revision: string;
      location_json: { startCodePoint: number; endCodePoint: number };
    };
    const lexical =
      await db.execute<Hit>(sql`with eligible as (${eligible}) select id, document_id, content_revision, location_json from eligible
      where search_vector @@ plainto_tsquery('simple', ${query})
      order by ts_rank_cd(search_vector, plainto_tsquery('simple', ${query})) desc, id limit ${this.env.KNOWLEDGE_SEARCH_CANDIDATES}`);
    const vector = embedding
      ? await db.execute<Hit>(
          sql`with eligible as (${eligible}) select id, document_id, content_revision, location_json from eligible order by embedding <=> ${JSON.stringify(embedding)}::vector, id limit ${this.env.KNOWLEDGE_SEARCH_CANDIDATES}`,
        )
      : [];
    const scores = new Map<string, { hit: Hit; score: number }>();
    for (const path of [lexical, vector])
      path.forEach((hit, index) => {
        const previous = scores.get(hit.id);
        scores.set(hit.id, {
          hit,
          score: (previous?.score ?? 0) + 1 / (this.env.KNOWLEDGE_RRF_K + index + 1),
        });
      });
    const snapshots: ChatCitationSnapshot[] = [];
    const ranges = new Map<string, { start: number; end: number }[]>();
    let remaining = maxCodePoints;
    for (const { hit } of [...scores.values()].sort(
      (a, b) => b.score - a.score || a.hit.id.localeCompare(b.hit.id),
    )) {
      if (
        snapshots.length >= this.env.KNOWLEDGE_SEARCH_TOP_K ||
        remaining <= 2 * MATERIAL_EXCERPT_PADDING
      )
        break;
      const document = documentsById.get(hit.document_id);
      if (!document) continue;
      const target = materialTarget(document);
      if (!target) continue;
      const startCodePoint = hit.location_json.startCodePoint;
      const endCodePoint = Math.min(
        hit.location_json.endCodePoint,
        startCodePoint + remaining - 2 * MATERIAL_EXCERPT_PADDING,
      );
      if (
        !Number.isSafeInteger(startCodePoint) ||
        !Number.isSafeInteger(endCodePoint) ||
        startCodePoint < 0 ||
        endCodePoint <= startCodePoint
      )
        continue;
      // Deduplicate overlap from the same document before consuming evidence budget.
      if (
        ranges
          .get(hit.document_id)
          ?.some((range) => range.start < endCodePoint && range.end > startCodePoint)
      )
        continue;
      try {
        const snapshot = await this.readExcerpt(
          userId,
          moduleId,
          { ...target, contentRevision: hit.content_revision, startCodePoint, endCodePoint },
          remaining,
        );
        remaining -= [...snapshot.text].length;
        snapshots.push(snapshot);
        ranges.set(hit.document_id, [
          ...(ranges.get(hit.document_id) ?? []),
          { start: startCodePoint, end: endCodePoint },
        ]);
      } catch (error) {
        if (!(error instanceof ProductError)) throw error;
      }
    }
    const [coverage] = await db.execute<{ missing: number }>(
      sql`select count(*)::int as missing from knowledge_documents d where d.id = any(${`{${documentIds.join(",")}}`}::uuid[]) and not exists (select 1 from knowledge_document_revisions r where r.document_id = d.id and r.index_version_id = ${version.id} and r.content_revision = d.current_content_revision and r.status = 'ready')`,
    );
    return {
      status: coverage?.missing || documents.some((item) => !item.id) ? "INDEX_NOT_READY" : "ready",
      degraded: !embedding,
      snapshots,
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
