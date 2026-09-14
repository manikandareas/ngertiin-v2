import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { type KnowledgeIndexingJob, knowledgeJobId } from "@ngertiin/contracts/jobs";
import {
  knowledge_chunks as chunks,
  type DatabaseTransaction,
  knowledge_documents as documents,
  knowledge_document_revisions as revisions,
  knowledge_index_versions as versions,
} from "@ngertiin/database";
import {
  chunkMaterial,
  KNOWLEDGE_NORMALIZER,
  learningMaterialText,
  materialRevision,
  normalizeMaterial,
} from "@ngertiin/shared/knowledge";
import { and, eq, sql } from "drizzle-orm";
import { AiService } from "../ai/ai.service.js";
import { WORKER_ENV } from "../config.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

type Material = {
  moduleId: string;
  sourceContentId: string | null;
  activityId: string | null;
  nodeId: string | null;
  text: string | null;
};
@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(WORKER_ENV) private readonly env: WorkerEnvironment,
  ) {}
  private get db() {
    return this.infrastructure.database.db;
  }
  private chunkerVersion(): string {
    return `paragraph-utf8-v1-${this.env.KNOWLEDGE_CHUNK_TOKENS}-${this.env.KNOWLEDGE_CHUNK_OVERLAP_TOKENS}`;
  }

  private async materials(
    tx: DatabaseTransaction,
    moduleId: string,
    target?: { source_content_id: string | null; activity_id: string | null },
  ): Promise<Material[]> {
    const sources = await tx.execute<{ id: string; text: string }>(sql`
      select sc.id, sc.content as text from source_contents sc
      join sources s on s.id = sc.source_id and s.status = 'ready'
      join generation_request_sources grs on grs.source_id = s.id
      join modules m on m.generation_request_id = grs.generation_request_id and m.owner_id = s.user_id
      where m.id = ${moduleId} and m.status in ('ready','archived') ${target ? sql`and sc.id = ${target.source_content_id}` : sql``} order by sc.id`);
    const activities = await tx.execute<{
      id: string;
      node_id: string;
      type: string;
      content: unknown;
    }>(sql`
      select a.id, a.node_id, a.type, a.content from activities a
      join module_nodes n on n.id = a.node_id join modules m on m.id = n.module_id
      where m.id = ${moduleId} and m.status in ('ready','archived') and a.type in ('lesson','flashcard') ${target ? sql`and a.id = ${target.activity_id}` : sql``} order by a.id`);
    return [
      ...sources.map((row) => ({
        moduleId,
        sourceContentId: row.id,
        activityId: null,
        nodeId: null,
        text: normalizeMaterial(row.text),
      })),
      ...activities.map((row) => ({
        moduleId,
        sourceContentId: null,
        activityId: row.id,
        nodeId: row.node_id,
        text: (() => {
          try {
            return normalizeMaterial(learningMaterialText(row.type, row.content));
          } catch {
            return null;
          }
        })(),
      })),
    ];
  }

  /** A serialized scan closes missing-event gaps and gates cutover against concurrent content writes. No provider calls under this lock. */
  async reconcile(): Promise<void> {
    const jobs = await this.db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '2s'`);
      await tx.execute(sql`set local statement_timeout = '30s'`);
      const [lock] = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(724019) as locked`,
      );
      if (!lock?.locked) return [];
      await tx.execute(
        sql`lock table modules, module_nodes, activities, sources, source_contents, generation_request_sources in share mode`,
      );
      await tx
        .insert(versions)
        .values({
          id: this.env.KNOWLEDGE_INDEX_VERSION,
          embedding_model: this.env.OPENAI_EMBEDDING_MODEL,
          dimensions: this.env.OPENAI_EMBEDDING_DIMENSIONS,
          normalizer_version: KNOWLEDGE_NORMALIZER,
          chunker_version: this.chunkerVersion(),
        })
        .onConflictDoNothing();
      const [version] = await tx
        .select()
        .from(versions)
        .where(eq(versions.id, this.env.KNOWLEDGE_INDEX_VERSION));
      if (
        !version ||
        version.embedding_model !== this.env.OPENAI_EMBEDDING_MODEL ||
        version.dimensions !== this.env.OPENAI_EMBEDDING_DIMENSIONS ||
        version.normalizer_version !== KNOWLEDGE_NORMALIZER ||
        version.chunker_version !== this.chunkerVersion()
      )
        throw new Error("KNOWLEDGE_VERSION_MISMATCH");
      if (version.status === "retired") throw new Error("KNOWLEDGE_VERSION_RETIRED");
      const targets = await tx
        .select()
        .from(versions)
        .where(sql`${versions.status} in ('building','active')`);
      const pending: KnowledgeIndexingJob[] = [];
      let after = "00000000-0000-0000-0000-000000000000";
      for (;;) {
        const page = await tx.execute<{ id: string }>(
          sql`select id from modules where id > ${after} order by id limit 100`,
        );
        if (!page.length) break;
        for (const module of page) {
          const material = await this.materials(tx, module.id);
          const seen: string[] = [];
          for (const item of material) {
            const revision = materialRevision(item.text ?? "KNOWLEDGE_INVALID_PROJECTION");
            const [document] = await tx
              .insert(documents)
              .values({
                module_id: module.id,
                origin: item.sourceContentId ? "original_source" : "generated_material",
                source_content_id: item.sourceContentId,
                activity_id: item.activityId,
                node_id: item.nodeId,
                current_content_revision: revision,
              })
              .onConflictDoUpdate({
                target: item.sourceContentId
                  ? [documents.module_id, documents.source_content_id]
                  : [documents.module_id, documents.activity_id],
                set: { current_content_revision: revision, node_id: item.nodeId, deleted_at: null },
              })
              .returning();
            if (!document) throw new Error("KNOWLEDGE_DOCUMENT_MISSING");
            seen.push(document.id);
            for (const target of targets) {
              await tx
                .insert(revisions)
                .values({
                  document_id: document.id,
                  index_version_id: target.id,
                  content_revision: revision,
                  ...(item.text === null
                    ? { status: "failed", error_code: "MATERIAL_INVALID" }
                    : {}),
                })
                .onConflictDoNothing();
              const [row] = await tx
                .select()
                .from(revisions)
                .where(
                  and(
                    eq(revisions.document_id, document.id),
                    eq(revisions.index_version_id, target.id),
                    eq(revisions.content_revision, revision),
                  ),
                );
              if (item.text !== null && row?.status !== "ready")
                pending.push({
                  documentId: document.id,
                  indexVersionId: target.id,
                  contentRevision: revision,
                });
            }
          }
          await tx.execute(
            sql`update knowledge_documents set deleted_at = coalesce(deleted_at, now()), current_content_revision = null where module_id = ${module.id} and not (id = any(${`{${seen.join(",")}}`}::uuid[]))`,
          );
        }
        const last = page.at(-1);
        if (!last) break;
        after = last.id;
      }
      // Obsolete revisions are inaccessible immediately; timestamp starts the cleanup grace.
      await tx.execute(
        sql`update knowledge_document_revisions r set status = 'obsolete', activated_at = now() from knowledge_documents d, knowledge_index_versions v where r.document_id = d.id and v.id = r.index_version_id and r.status <> 'obsolete' and (d.deleted_at is not null or d.current_content_revision is distinct from r.content_revision or v.status = 'retired')`,
      );
      const [coverage] = await tx.execute<{
        eligible: number;
        ready: number;
        failed: number;
        missing: number;
      }>(
        sql`select count(*)::int as eligible, count(*) filter (where r.status = 'ready')::int as ready, count(*) filter (where r.status = 'failed')::int as failed, count(*) filter (where r.status is distinct from 'ready')::int as missing from knowledge_documents d left join knowledge_document_revisions r on r.document_id = d.id and r.index_version_id = ${version.id} and r.content_revision = d.current_content_revision where d.deleted_at is null`,
      );
      if (version.status === "building" && coverage?.missing === 0) {
        await tx.update(versions).set({ status: "retired" }).where(eq(versions.status, "active"));
        await tx.update(versions).set({ status: "active" }).where(eq(versions.id, version.id));
      }
      await tx.execute(
        sql`delete from knowledge_document_revisions where status = 'obsolete' and activated_at < now() - (${this.env.KNOWLEDGE_OBSOLETE_RETENTION_HOURS} * interval '1 hour')`,
      );
      console.log(
        JSON.stringify({
          event: "knowledge.coverage",
          indexVersion: version.id,
          ...coverage,
          jobs: pending.length,
        }),
      );
      return pending;
    });
    for (const job of jobs)
      await this.infrastructure.ensureJob({
        queue: this.infrastructure.knowledgeIndexingQueue,
        name: "index",
        data: job,
        jobId: knowledgeJobId(job),
        options: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      });
  }

  async index(job: KnowledgeIndexingJob): Promise<void> {
    // A database advisory lock also protects against duplicate delivery across separate queue installations.
    try {
      await this.db.transaction(async (tx) => {
        const [lock] = await tx.execute<{ locked: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtextextended(${knowledgeJobId(job)}, 0)) as locked`,
        );
        if (!lock?.locked) return;
        const [document] = await tx
          .select()
          .from(documents)
          .where(eq(documents.id, job.documentId));
        const [version] = await tx
          .select()
          .from(versions)
          .where(eq(versions.id, job.indexVersionId));
        const [revision] = await tx
          .select()
          .from(revisions)
          .where(
            and(
              eq(revisions.document_id, job.documentId),
              eq(revisions.index_version_id, job.indexVersionId),
              eq(revisions.content_revision, job.contentRevision),
            ),
          );
        if (
          !document ||
          !version ||
          !revision ||
          document.deleted_at ||
          document.current_content_revision !== job.contentRevision ||
          version.status === "retired" ||
          revision.status === "ready"
        )
          return;
        if (
          version.normalizer_version !== KNOWLEDGE_NORMALIZER ||
          !/^paragraph-utf8-v1-\d+-\d+$/.test(version.chunker_version)
        )
          throw new Error("KNOWLEDGE_VERSION_UNSUPPORTED");
        const settings = version.chunker_version.split("-").slice(-2).map(Number);
        const current = (await this.materials(tx, document.module_id, document)).find((item) =>
          document.activity_id
            ? item.activityId === document.activity_id
            : item.sourceContentId === document.source_content_id,
        );
        if (
          !current ||
          current.text === null ||
          materialRevision(current.text) !== job.contentRevision
        )
          return;
        await tx
          .update(revisions)
          .set({ status: "indexing", error_code: null })
          .where(eq(revisions.id, revision.id));
        const [tokens, overlap] = settings;
        if (!tokens || overlap === undefined || overlap >= tokens)
          throw new Error("KNOWLEDGE_CHUNK_SETTINGS_INVALID");
        const pieces = chunkMaterial(current.text, tokens, overlap);
        const vectors: number[][] = [];
        for (let i = 0; i < pieces.length; i += this.env.KNOWLEDGE_EMBEDDING_BATCH_SIZE) {
          const batch = pieces.slice(i, i + this.env.KNOWLEDGE_EMBEDDING_BATCH_SIZE);
          vectors.push(
            ...(await this.ai.embedMaterials(
              batch.map((piece) => piece.text),
              version.embedding_model,
              version.dimensions,
            )),
          );
        }
        // Prevent update/insert/delete cutover races while verifying the post-provider source.
        await tx.execute(
          sql`lock table modules, module_nodes, activities, sources, source_contents, generation_request_sources in share mode`,
        );
        const latest = (await this.materials(tx, document.module_id, document)).find((item) =>
          document.activity_id
            ? item.activityId === document.activity_id
            : item.sourceContentId === document.source_content_id,
        );
        if (
          !latest ||
          latest.text === null ||
          materialRevision(latest.text) !== job.contentRevision
        ) {
          await tx
            .update(revisions)
            .set({ status: "obsolete", activated_at: sql`now()` })
            .where(eq(revisions.id, revision.id));
          return;
        }
        await tx.delete(chunks).where(eq(chunks.document_revision_id, revision.id));
        for (let i = 0; i < pieces.length; i++) {
          const piece = pieces[i];
          const embedding = vectors[i];
          if (!piece || !embedding) throw new Error("KNOWLEDGE_EMBEDDING_MISSING");
          await tx.insert(chunks).values({
            document_revision_id: revision.id,
            ordinal: i,
            text: piece.text,
            location_json: {
              startCodePoint: piece.startCodePoint,
              endCodePoint: piece.endCodePoint,
            },
            content_hash: createHash("sha256").update(piece.text).digest("hex"),
            embedding,
          });
        }
        await tx
          .update(revisions)
          .set({ status: "ready", error_code: null, activated_at: sql`now()` })
          .where(eq(revisions.id, revision.id));
        console.log(
          JSON.stringify({
            event: "knowledge.index_ready",
            documentId: document.id,
            indexVersion: version.id,
            chunks: pieces.length,
            dimensions: version.dimensions,
          }),
        );
      });
    } catch {
      await this.db
        .update(revisions)
        .set({ status: "failed", error_code: "INDEXING_FAILED" })
        .where(
          and(
            eq(revisions.document_id, job.documentId),
            eq(revisions.index_version_id, job.indexVersionId),
            eq(revisions.content_revision, job.contentRevision),
            sql`${revisions.status} not in ('ready','obsolete')`,
          ),
        );
      throw new Error("INDEXING_FAILED");
    }
  }
}
