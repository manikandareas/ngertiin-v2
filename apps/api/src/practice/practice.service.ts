import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Inject, Injectable } from "@nestjs/common";
import {
  type CreatePracticeBody,
  type PracticeAttempt,
  type PracticeConfiguration,
  practiceAnswerSchema,
  practiceAttemptSchema,
  practiceConfigurationSchema,
  practiceItemContentSchema,
} from "@ngertiin/contracts/api";
import {
  chat_attachments,
  chat_interactions,
  generation_request_sources,
  modules,
  practice_attempts,
  practice_generation_runs,
  practice_items,
  practice_sets,
  practice_sources,
  source_contents,
  sources,
} from "@ngertiin/database";
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

const fail = (
  status: number,
  code: "NOT_FOUND" | "SUBMISSION_CONFLICT" | "MODULE_NOT_READY" | "GENERATION_RETRY_NOT_ALLOWED",
  detail: string,
): never => {
  throw new ProductError(status, code, detail, detail);
};
const iso = (date: Date | null) => date?.toISOString() ?? null;
const summary = (row: typeof practice_sets.$inferSelect) => {
  const configuration = practiceConfigurationSchema.parse(row.configuration);
  return {
    id: row.id,
    moduleId: row.module_id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    itemCount: configuration.itemCount,
    durationMinutes: configuration.durationMinutes,
    latestAttempt: null,
    archivedAt: iso(row.archived_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
};

@Injectable()
export class PracticeService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}
  private get db() {
    return this.infrastructure.database.db;
  }

  private async owned(userId: string, practiceId: string) {
    const [row] = await this.db
      .select()
      .from(practice_sets)
      .where(and(eq(practice_sets.id, practiceId), eq(practice_sets.owner_id, userId)))
      .limit(1);
    if (!row) fail(404, "NOT_FOUND", "Latihan tidak ditemukan.");
    return row;
  }

  async sourceRevision(userId: string, input: PracticeConfiguration) {
    const configuration = practiceConfigurationSchema.parse(input);
    const hash = createHash("sha256");
    const moduleIds = [
      configuration.destinationModuleId,
      ...configuration.sources.flatMap((source) =>
        source.kind === "module" ? [source.moduleId] : [],
      ),
    ];
    const ownedModules = await this.db
      .select({ id: modules.id, generationRequestId: modules.generation_request_id })
      .from(modules)
      .where(
        and(
          inArray(modules.id, moduleIds),
          eq(modules.owner_id, userId),
          eq(modules.status, "ready"),
        ),
      );
    if (ownedModules.length !== new Set(moduleIds).size)
      fail(404, "NOT_FOUND", "Modul tujuan atau sumber tidak tersedia.");
    for (const selected of configuration.sources) {
      if (selected.kind === "module") {
        const module =
          ownedModules.find((row) => row.id === selected.moduleId) ??
          fail(404, "NOT_FOUND", "Modul sumber tidak tersedia.");
        const contents = await this.db
          .select({
            id: source_contents.id,
            hash: sources.content_hash,
            content: source_contents.content,
          })
          .from(generation_request_sources)
          .innerJoin(sources, eq(sources.id, generation_request_sources.source_id))
          .innerJoin(source_contents, eq(source_contents.source_id, sources.id))
          .where(
            and(
              eq(generation_request_sources.generation_request_id, module.generationRequestId),
              eq(sources.user_id, userId),
              eq(sources.status, "ready"),
            ),
          )
          .orderBy(asc(generation_request_sources.priority), asc(source_contents.position));
        if (!contents.length) fail(409, "MODULE_NOT_READY", "Materi sumber belum siap.");
        hash.update(JSON.stringify([selected.moduleId, contents]));
      } else {
        const [attachment] = await this.db
          .select({ hash: chat_attachments.content_hash })
          .from(chat_attachments)
          .where(
            and(
              eq(chat_attachments.id, selected.attachmentId),
              eq(chat_attachments.user_id, userId),
              isNull(chat_attachments.deleted_at),
            ),
          );
        if (!attachment) fail(404, "NOT_FOUND", "Lampiran tidak tersedia.");
        hash.update(JSON.stringify([selected.attachmentId, attachment.hash]));
      }
    }
    return hash.digest("hex");
  }

  /** The action ID is server-owned and unique across replay, retries and tabs. */
  async createApproved(
    userId: string,
    actionId: string,
    interactionId: string,
    input: PracticeConfiguration,
  ) {
    const configuration = practiceConfigurationSchema.parse(input);
    const [approval] = await this.db
      .select({
        status: chat_interactions.status,
        decision: chat_interactions.decision_json,
        interrupt: chat_interactions.interrupt_json,
      })
      .from(chat_interactions)
      .where(eq(chat_interactions.id, interactionId))
      .limit(1);
    if (
      approval?.status !== "approved" ||
      !isDeepStrictEqual(
        practiceConfigurationSchema.safeParse(approval.decision).data,
        configuration,
      )
    )
      fail(409, "SUBMISSION_CONFLICT", "Persetujuan latihan tidak berlaku lagi.");
    const [existing] = await this.db
      .select()
      .from(practice_sets)
      .where(eq(practice_sets.approval_action_id, actionId))
      .limit(1);
    if (existing) {
      if (existing.owner_id !== userId) fail(404, "NOT_FOUND", "Latihan tidak ditemukan.");
      return summary(existing);
    }
    const approvedRevision =
      approval.interrupt && typeof approval.interrupt === "object"
        ? (approval.interrupt as Record<string, unknown>).sourceRevision
        : null;
    if (approvedRevision !== (await this.sourceRevision(userId, configuration)))
      fail(409, "SUBMISSION_CONFLICT", "Materi sumber berubah. Tinjau usulan latihan baru.");
    return this.create(userId, actionId, interactionId, configuration);
  }

  async createFromForm(userId: string, moduleId: string, body: CreatePracticeBody) {
    const configuration = practiceConfigurationSchema.parse({
      ...body.settings,
      destinationModuleId: moduleId,
      sources: [{ kind: "module", moduleId }],
    });
    // Namespace the client request ID by owner and entry point, separate from chat actions.
    const hash = createHash("sha256")
      .update(`practice-form:${userId}:${body.requestId}`)
      .digest("hex");
    const actionId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    return this.create(userId, actionId, null, configuration);
  }

  private async create(
    userId: string,
    actionId: string,
    interactionId: string | null,
    configuration: PracticeConfiguration,
  ) {
    const checkReplay = (row: typeof practice_sets.$inferSelect) => {
      if (row.owner_id !== userId || !isDeepStrictEqual(row.configuration, configuration))
        fail(409, "SUBMISSION_CONFLICT", "Permintaan ini sudah digunakan untuk pengaturan lain.");
      return row;
    };
    const [existing] = await this.db
      .select()
      .from(practice_sets)
      .where(eq(practice_sets.approval_action_id, actionId))
      .limit(1);
    if (existing) return summary(checkReplay(existing));
    const moduleIds = [
      configuration.destinationModuleId,
      ...configuration.sources.flatMap((source) =>
        source.kind === "module" ? [source.moduleId] : [],
      ),
    ];
    const moduleRows = await this.db
      .select()
      .from(modules)
      .where(
        and(
          inArray(modules.id, moduleIds),
          eq(modules.owner_id, userId),
          eq(modules.status, "ready"),
        ),
      );
    if (moduleRows.length !== new Set(moduleIds).size)
      fail(404, "NOT_FOUND", "Modul tujuan atau sumber tidak tersedia.");
    if (configuration.variationOfId) {
      const original = await this.owned(userId, configuration.variationOfId);
      if (original.module_id !== configuration.destinationModuleId)
        fail(409, "SUBMISSION_CONFLICT", "Variasi harus tersimpan di modul latihan asal.");
    }
    const sourceRows: Array<{
      position: number;
      origin: "module" | "attachment";
      module_id: string | null;
      source_id: string | null;
      source_content_id: string | null;
      attachment_id: string | null;
      content_revision: string | null;
      snapshot_text: string;
      object_key: string | null;
      mime_type: string | null;
    }> = [];
    let position = 1;
    for (const selected of configuration.sources) {
      if (selected.kind === "module") {
        const module =
          moduleRows.find((row) => row.id === selected.moduleId) ??
          fail(404, "NOT_FOUND", "Modul sumber tidak tersedia.");
        const contents = await this.db
          .select({
            id: source_contents.id,
            sourceId: sources.id,
            content: source_contents.content,
            storageKey: sources.storage_key,
            hash: sources.content_hash,
          })
          .from(generation_request_sources)
          .innerJoin(sources, eq(sources.id, generation_request_sources.source_id))
          .innerJoin(source_contents, eq(source_contents.source_id, sources.id))
          .where(
            and(
              eq(generation_request_sources.generation_request_id, module.generation_request_id),
              eq(sources.user_id, userId),
              eq(sources.status, "ready"),
            ),
          )
          .orderBy(asc(generation_request_sources.priority), asc(source_contents.position));
        if (!contents.length)
          fail(409, "MODULE_NOT_READY", "Materi sumber belum siap untuk latihan.");
        for (const content of contents)
          sourceRows.push({
            position: position++,
            origin: "module",
            module_id: selected.moduleId,
            source_id: content.sourceId,
            source_content_id: content.id,
            attachment_id: null,
            content_revision: content.hash,
            snapshot_text: content.content,
            object_key: content.storageKey,
            mime_type: null,
          });
      } else {
        const [attachment] = await this.db
          .select()
          .from(chat_attachments)
          .where(
            and(
              eq(chat_attachments.id, selected.attachmentId),
              eq(chat_attachments.user_id, userId),
              isNull(chat_attachments.deleted_at),
            ),
          )
          .limit(1);
        if (!attachment || attachment.extraction_status === "failed")
          fail(404, "NOT_FOUND", "Lampiran tidak tersedia.");
        sourceRows.push({
          position: position++,
          origin: "attachment",
          module_id: null,
          source_id: null,
          source_content_id: null,
          attachment_id: attachment.id,
          content_revision: attachment.content_hash,
          snapshot_text: attachment.extraction_text ?? "",
          object_key: attachment.object_key,
          mime_type: attachment.mime_type,
        });
      }
    }
    if (
      sourceRows.reduce((sum, row) => sum + row.snapshot_text.length, 0) < 200 &&
      sourceRows.every((row) => !row.object_key)
    )
      fail(409, "MODULE_NOT_READY", "Materi terlalu sedikit. Pilih sumber atau fokus lain.");
    const copied = new Map<string, string>();
    for (const row of sourceRows) {
      if (!row.object_key) continue;
      let key = copied.get(row.object_key);
      if (!key) {
        key = `practice/${actionId}/${copied.size + 1}`;
        await this.infrastructure.storage.put({
          key,
          body: await this.infrastructure.storage.get(row.object_key),
        });
        copied.set(row.object_key, key);
      }
      row.object_key = key;
    }
    const created = await this.db.transaction(async (tx) => {
      const [again] = await tx
        .select()
        .from(practice_sets)
        .where(eq(practice_sets.approval_action_id, actionId))
        .limit(1);
      if (again) return checkReplay(again);
      const [set] = await tx
        .insert(practice_sets)
        .values({
          owner_id: userId,
          module_id: configuration.destinationModuleId,
          kind: configuration.kind,
          title: configuration.title,
          configuration,
          approved_interaction_id: interactionId,
          approval_action_id: actionId,
          variation_of_id: configuration.variationOfId ?? null,
        })
        .onConflictDoNothing({ target: practice_sets.approval_action_id })
        .returning();
      if (!set) {
        const [replayed] = await tx
          .select()
          .from(practice_sets)
          .where(eq(practice_sets.approval_action_id, actionId));
        if (!replayed) throw new Error("Missing idempotent Practice set");
        return checkReplay(replayed);
      }
      await tx
        .insert(practice_sources)
        .values(sourceRows.map((row) => ({ practice_id: set.id, ...row })));
      await tx.insert(practice_generation_runs).values({ practice_id: set.id, status: "queued" });
      return set;
    });
    return summary(created);
  }

  async list(
    userId: string,
    moduleId: string | undefined,
    query: {
      kind?: "flashcard" | "quiz" | "exam";
      status?: "generating" | "ready" | "failed";
      q?: string;
      archived: boolean;
      cursor?: string;
      limit: number;
    },
  ) {
    if (moduleId) {
      const [module] = await this.db
        .select({ id: modules.id })
        .from(modules)
        .where(and(eq(modules.id, moduleId), eq(modules.owner_id, userId)))
        .limit(1);
      if (!module) fail(404, "NOT_FOUND", "Modul tidak ditemukan.");
    }
    const [cursor] = query.cursor
      ? await this.db
          .select({ createdAt: practice_sets.created_at, id: practice_sets.id })
          .from(practice_sets)
          .where(
            and(
              eq(practice_sets.id, query.cursor),
              eq(practice_sets.owner_id, userId),
              moduleId ? eq(practice_sets.module_id, moduleId) : undefined,
            ),
          )
          .limit(1)
      : [];
    if (query.cursor && !cursor) fail(404, "NOT_FOUND", "Cursor tidak ditemukan.");
    const rows = await this.db
      .select()
      .from(practice_sets)
      .where(
        and(
          eq(practice_sets.owner_id, userId),
          moduleId ? eq(practice_sets.module_id, moduleId) : undefined,
          query.kind ? eq(practice_sets.kind, query.kind) : undefined,
          query.status ? eq(practice_sets.status, query.status) : undefined,
          query.q
            ? ilike(practice_sets.title, `%${query.q.replace(/[\\%_]/g, "\\$&")}%`)
            : undefined,
          query.archived
            ? sql`${practice_sets.archived_at} is not null`
            : isNull(practice_sets.archived_at),
          cursor
            ? or(
                lt(practice_sets.created_at, cursor.createdAt),
                and(
                  eq(practice_sets.created_at, cursor.createdAt),
                  lt(practice_sets.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(practice_sets.created_at), desc(practice_sets.id))
      .limit(query.limit + 1);
    const page = rows.slice(0, query.limit);
    const readyIds = page.filter((row) => row.status === "ready").map((row) => row.id);
    const firstItems = readyIds.length
      ? await this.db
          .selectDistinctOn([practice_items.practice_id], {
            practiceId: practice_items.practice_id,
            content: practice_items.content,
          })
          .from(practice_items)
          .where(inArray(practice_items.practice_id, readyIds))
          .orderBy(practice_items.practice_id, asc(practice_items.position))
      : [];
    const previews = new Map(
      firstItems.map((item) => {
        const content = practiceItemContentSchema.parse(item.content);
        return [
          item.practiceId,
          {
            text: (content.type === "flashcard" ? content.front : content.question).slice(0, 300),
            options:
              content.type === "multiple_choice"
                ? content.options.slice(0, 2).map((option) => option.slice(0, 120))
                : content.type === "true_false"
                  ? ["Benar", "Salah"]
                  : [],
          },
        ];
      }),
    );
    const data = await Promise.all(
      page.map(async (row) => {
        const [latest] = await this.db
          .select({
            status: practice_attempts.status,
            answers: practice_attempts.answers,
            score: practice_attempts.score,
          })
          .from(practice_attempts)
          .where(
            and(eq(practice_attempts.practice_id, row.id), eq(practice_attempts.user_id, userId)),
          )
          .orderBy(desc(practice_attempts.started_at))
          .limit(1);
        return {
          ...summary(row),
          preview: previews.get(row.id) ?? null,
          latestAttempt: latest
            ? {
                status: latest.status,
                answeredCount: Object.keys(
                  practiceAttemptSchema.shape.answers.parse(latest.answers),
                ).length,
                score: latest.score === null ? null : Number(latest.score),
              }
            : null,
        };
      }),
    );
    return {
      data,
      pageInfo: {
        hasNextPage: rows.length > query.limit,
        nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
      },
    };
  }

  async detail(userId: string, practiceId: string) {
    const row = await this.owned(userId, practiceId);
    const [run] = await this.db
      .select()
      .from(practice_generation_runs)
      .where(eq(practice_generation_runs.practice_id, row.id))
      .orderBy(desc(practice_generation_runs.created_at))
      .limit(1);
    const items =
      row.status === "ready"
        ? await this.db
            .select({
              id: practice_items.id,
              position: practice_items.position,
              content: practice_items.content,
            })
            .from(practice_items)
            .where(eq(practice_items.practice_id, row.id))
            .orderBy(practice_items.position)
        : [];
    return {
      ...summary(row),
      configuration: practiceConfigurationSchema.parse(row.configuration),
      progress: row.status === "ready" ? 100 : (run?.progress ?? 0),
      failure:
        run?.failure && typeof run.failure === "object" && "message" in run.failure
          ? String(run.failure.message)
          : null,
      items: items.map((item) => ({
        ...item,
        content: practiceItemContentSchema.parse(item.content),
      })),
    };
  }

  async patch(userId: string, practiceId: string, body: { title?: string; archived?: boolean }) {
    await this.owned(userId, practiceId);
    const [updated] = await this.db
      .update(practice_sets)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.archived !== undefined ? { archived_at: body.archived ? new Date() : null } : {}),
        updated_at: new Date(),
      })
      .where(and(eq(practice_sets.id, practiceId), eq(practice_sets.owner_id, userId)))
      .returning();
    if (!updated) fail(404, "NOT_FOUND", "Latihan tidak ditemukan.");
    return summary(updated);
  }

  async retry(userId: string, practiceId: string) {
    const set = await this.owned(userId, practiceId);
    if (set.status !== "failed" || set.archived_at)
      fail(409, "GENERATION_RETRY_NOT_ALLOWED", "Latihan ini tidak dapat dibuat ulang.");
    await this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(practice_sets)
        .where(eq(practice_sets.id, practiceId))
        .for("update");
      if (locked?.status !== "failed")
        fail(409, "GENERATION_RETRY_NOT_ALLOWED", "Latihan ini tidak dapat dibuat ulang.");
      const [previous] = await tx
        .select({ batches: practice_generation_runs.batches_json })
        .from(practice_generation_runs)
        .where(eq(practice_generation_runs.practice_id, practiceId))
        .orderBy(desc(practice_generation_runs.created_at))
        .limit(1);
      await tx
        .update(practice_sets)
        .set({ status: "generating", updated_at: new Date() })
        .where(eq(practice_sets.id, practiceId));
      await tx.insert(practice_generation_runs).values({
        practice_id: practiceId,
        status: "queued",
        batches_json: previous?.batches ?? [],
      });
    });
    return this.detail(userId, practiceId);
  }

  async startAttempt(userId: string, practiceId: string) {
    const row = await this.owned(userId, practiceId);
    if (row.status !== "ready" || row.archived_at)
      fail(409, "MODULE_NOT_READY", "Latihan belum siap atau telah diarsipkan.");
    const attempt = await this.db.transaction(async (tx) => {
      const [set] = await tx
        .select()
        .from(practice_sets)
        .where(eq(practice_sets.id, practiceId))
        .for("update");
      if (set?.status !== "ready" || set.archived_at)
        fail(409, "MODULE_NOT_READY", "Latihan belum siap atau telah diarsipkan.");
      const [active] = await tx
        .select()
        .from(practice_attempts)
        .where(
          and(
            eq(practice_attempts.practice_id, practiceId),
            eq(practice_attempts.user_id, userId),
            eq(practice_attempts.status, "active"),
          ),
        )
        .limit(1);
      if (active) return active;
      const configuration = practiceConfigurationSchema.parse(set.configuration);
      const now = new Date();
      const deadline =
        configuration.kind === "exam" && configuration.durationMinutes
          ? new Date(now.getTime() + configuration.durationMinutes * 60_000)
          : null;
      const [created] = await tx
        .insert(practice_attempts)
        .values({
          practice_id: practiceId,
          user_id: userId,
          started_at: now,
          deadline_at: deadline,
        })
        .returning();
      if (!created) throw new Error("Unable to start practice attempt");
      return created;
    });
    return this.attemptDto(attempt);
  }

  async listAttempts(userId: string, practiceId: string) {
    await this.owned(userId, practiceId);
    const rows = await this.db
      .select()
      .from(practice_attempts)
      .where(
        and(eq(practice_attempts.practice_id, practiceId), eq(practice_attempts.user_id, userId)),
      )
      .orderBy(desc(practice_attempts.started_at))
      .limit(100);
    return {
      data: rows.map((row) => this.attemptDto(row)),
      pageInfo: { nextCursor: null, hasNextPage: false },
    };
  }

  private attemptDto(row: typeof practice_attempts.$inferSelect) {
    return practiceAttemptSchema.parse({
      id: row.id,
      practiceId: row.practice_id,
      status: row.status,
      revision: row.revision,
      answers: row.answers,
      startedAt: row.started_at.toISOString(),
      deadlineAt: iso(row.deadline_at),
      submittedAt: iso(row.submitted_at),
      score: row.score === null ? null : Number(row.score),
      xpAwarded: row.xp_awarded,
      results: row.results,
    });
  }

  async getAttempt(userId: string, attemptId: string): Promise<PracticeAttempt> {
    const [row] = await this.db
      .select()
      .from(practice_attempts)
      .where(and(eq(practice_attempts.id, attemptId), eq(practice_attempts.user_id, userId)))
      .limit(1);
    if (!row) fail(404, "NOT_FOUND", "Sesi latihan tidak ditemukan.");
    if (row.status === "active" && row.deadline_at && row.deadline_at <= new Date()) {
      await this.submit(userId, attemptId);
      return this.getAttempt(userId, attemptId);
    }
    return this.attemptDto(row);
  }

  async save(
    userId: string,
    attemptId: string,
    revision: number,
    answers: Record<string, unknown>,
  ) {
    const [attempt] = await this.db
      .select()
      .from(practice_attempts)
      .where(and(eq(practice_attempts.id, attemptId), eq(practice_attempts.user_id, userId)))
      .limit(1);
    if (!attempt) fail(404, "NOT_FOUND", "Sesi latihan tidak ditemukan.");
    const rows = await this.db
      .select({ id: practice_items.id, content: practice_items.content })
      .from(practice_items)
      .where(eq(practice_items.practice_id, attempt.practice_id));
    const kinds = new Map(
      rows.map((item) => [item.id, practiceItemContentSchema.parse(item.content).type]),
    );
    for (const [id, raw] of Object.entries(answers)) {
      const answer = practiceAnswerSchema.parse(raw);
      if (kinds.get(id) !== answer.type)
        fail(409, "SUBMISSION_CONFLICT", "Jawaban tidak cocok dengan soal.");
    }
    const [updated] = await this.db
      .update(practice_attempts)
      .set({ answers, revision: revision + 1 })
      .where(
        and(
          eq(practice_attempts.id, attemptId),
          eq(practice_attempts.user_id, userId),
          eq(practice_attempts.revision, revision),
          eq(practice_attempts.status, "active"),
          or(
            isNull(practice_attempts.deadline_at),
            sql`${practice_attempts.deadline_at} > clock_timestamp()`,
          ),
        ),
      )
      .returning();
    if (!updated)
      fail(409, "SUBMISSION_CONFLICT", "Jawaban berubah atau waktu telah habis. Muat ulang sesi.");
    return this.attemptDto(updated);
  }

  async submit(userId: string, attemptId: string) {
    await this.db.transaction(async (tx) => {
      const [attempt] = await tx
        .select()
        .from(practice_attempts)
        .where(and(eq(practice_attempts.id, attemptId), eq(practice_attempts.user_id, userId)))
        .for("update")
        .limit(1);
      if (!attempt) fail(404, "NOT_FOUND", "Sesi latihan tidak ditemukan.");
      if (attempt.status !== "active") return attempt;
      const [set] = await tx
        .select()
        .from(practice_sets)
        .where(eq(practice_sets.id, attempt.practice_id))
        .limit(1);
      if (!set) fail(404, "NOT_FOUND", "Latihan tidak ditemukan.");
      const items = await tx
        .select()
        .from(practice_items)
        .where(eq(practice_items.practice_id, set.id))
        .orderBy(practice_items.position);
      const answers = practiceAttemptSchema.shape.answers.parse(attempt.answers);
      const supplied = Object.keys(answers).length;
      if (set.kind !== "exam" && supplied !== items.length)
        fail(409, "SUBMISSION_CONFLICT", "Jawab semua soal sebelum mengirim.");
      if (
        set.kind === "quiz" &&
        Object.values(answers).some(
          (answer) => answer.type === "short_answer" && !answer.text.trim(),
        )
      )
        fail(409, "SUBMISSION_CONFLICT", "Isi semua jawaban esai sebelum mengirim.");
      const now = new Date();
      const [updated] = await tx
        .update(practice_attempts)
        .set({ status: "evaluating", submitted_at: now })
        .where(eq(practice_attempts.id, attemptId))
        .returning();
      if (!updated) throw new Error("Unable to submit practice attempt");
      return updated;
    });
    return this.getAttempt(userId, attemptId);
  }

  async retryEvaluation(userId: string, attemptId: string) {
    const [updated] = await this.db
      .update(practice_attempts)
      .set({ status: "evaluating", failure: null })
      .where(
        and(
          eq(practice_attempts.id, attemptId),
          eq(practice_attempts.user_id, userId),
          eq(practice_attempts.status, "evaluation_failed"),
        ),
      )
      .returning();
    if (!updated) {
      const [existing] = await this.db
        .select()
        .from(practice_attempts)
        .where(and(eq(practice_attempts.id, attemptId), eq(practice_attempts.user_id, userId)));
      if (!existing) fail(404, "NOT_FOUND", "Sesi latihan tidak ditemukan.");
      if (existing.status !== "evaluating" && existing.status !== "completed")
        fail(409, "SUBMISSION_CONFLICT", "Sesi belum dapat dinilai ulang.");
    }
    return this.getAttempt(userId, attemptId);
  }
}
