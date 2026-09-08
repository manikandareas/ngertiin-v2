import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  type CreatePdfSourceFields,
  type CreatePdfSourceResponse,
  type CreateTextSourceBody,
  type CreateTextSourceResponse,
  type CreateUrlSourceBody,
  type CreateUrlSourceResponse,
  type ListSourcesQuery,
  type ListSourcesResponse,
  type PatchSourceBody,
  type RetrySourceResponse,
  type Source,
  type SourceFailure,
  type SourceFileResponse,
  type SourcePreviewResponse,
  sourceFailureSchema,
  timestampSchema,
  uuidSchema,
} from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import {
  type DatabaseTransaction,
  source_contents,
  source_processing_runs,
  sources,
} from "@ngertiin/database";
import { assertPublicHttpUrl, PublicUrlError } from "@ngertiin/shared";
import { and, asc, desc, eq, ilike, isNotNull, isNull, lt, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { UsageService } from "../usage/usage.service.js";
import { retriesRemaining, sourceRunCount } from "../usage/usage-policy.js";

const sourceCursorSchema = z
  .object({
    createdAt: timestampSchema,
    id: uuidSchema,
  })
  .strict();

const sourceMetadataSchema = z
  .object({
    size_bytes: z.number().int().nonnegative().optional(),
    page_count: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const sourceFields = {
  id: sources.id,
  type: sources.type,
  title: sources.title,
  status: sources.status,
  originalFilename: sources.original_filename,
  originalUrl: sources.original_url,
  metadata: sources.metadata,
  failure: sources.failure,
  archivedAt: sources.archived_at,
  createdAt: sources.created_at,
  updatedAt: sources.updated_at,
};

type SourceRow = {
  id: string;
  type: "pdf" | "url" | "text";
  title: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  originalFilename: string | null;
  originalUrl: string | null;
  metadata: unknown;
  failure: unknown;
  runCount?: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type UploadedPdf = {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
};

const fallbackSourceFailure: SourceFailure = {
  code: "SOURCE_PROCESSING_FAILED",
  message: "Source processing could not be completed.",
  retryable: false,
};

function readSourceFailure(value: unknown): SourceFailure {
  const result = sourceFailureSchema.safeParse(value);
  return result.success ? result.data : fallbackSourceFailure;
}

function sourceFromRow(row: SourceRow): Source {
  const metadata = sourceMetadataSchema.safeParse(row.metadata);
  const sizeBytes = metadata.success ? metadata.data.size_bytes : undefined;
  const pageCount = metadata.success ? metadata.data.page_count : undefined;
  return {
    archivedAt: row.archivedAt?.toISOString() ?? null,
    retriesRemaining: row.type === "text" ? 0 : retriesRemaining(row.runCount ?? 1),
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    ...(row.originalFilename ? { originalFilename: row.originalFilename } : {}),
    ...(row.originalUrl ? { originalUrl: row.originalUrl } : {}),
    ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    ...(pageCount !== undefined ? { pageCount } : {}),
    ...(row.status === "failed" ? { failure: readSourceFailure(row.failure) } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class SourcesService {
  constructor(
    @Inject(UsageService) private readonly usage: UsageService,
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(API_ENV) private readonly environment: ApiEnvironment,
  ) {}

  async createTextSource(
    userId: string,
    key: string,
    input: CreateTextSourceBody,
  ): Promise<{ status: number; body: CreateTextSourceResponse }> {
    return this.idempotency.execute(
      {
        userId,
        method: "POST",
        route: "/api/v1/sources/text",
        key,
        payloadHash: createHash("sha256")
          .update(JSON.stringify({ title: input.title, text: input.text }))
          .digest("hex"),
      },
      async (transaction) => {
        await this.usage.lock(transaction, userId);
        const now = await this.usage.assertQuota(transaction, userId, "sources");
        const [row] = await transaction
          .insert(sources)
          .values({
            user_id: userId,
            type: "text",
            title: input.title,
            text_content: input.text,
            content_hash: createHash("sha256").update(input.text).digest("hex"),
            status: "ready",
            created_at: now,
            updated_at: now,
          })
          .returning(sourceFields);

        if (!row) {
          throw new Error("Text Source insert did not return a row");
        }

        return {
          status: 201,
          body: {
            data: sourceFromRow(row),
          },
        };
      },
    );
  }

  async createUrlSource(
    userId: string,
    key: string,
    input: CreateUrlSourceBody,
  ): Promise<{ status: number; body: CreateUrlSourceResponse }> {
    let originalUrl: string;
    try {
      originalUrl = await assertPublicHttpUrl(input.url);
    } catch (error) {
      if (!(error instanceof PublicUrlError)) throw error;
      throw new ProductError(
        422,
        "VALIDATION_ERROR",
        "Request validation failed",
        "The URL must identify a public HTTP or HTTPS resource.",
        [
          {
            path: "url",
            code: "public_url_required",
            message: "Credentials, localhost, and non-public network addresses are not allowed.",
          },
        ],
      );
    }
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ title: input.title, url: originalUrl }))
      .digest("hex");
    return this.idempotency.execute(
      { userId, method: "POST", route: "/api/v1/sources/url", key, payloadHash },
      async (transaction) => {
        await this.usage.lock(transaction, userId);
        const now = await this.usage.assertQuota(transaction, userId, "sources");
        const sourceId = randomUUID();
        await transaction.insert(sources).values({
          id: sourceId,
          user_id: userId,
          type: "url",
          title: input.title,
          original_url: originalUrl,
          content_hash: createHash("sha256").update(originalUrl).digest("hex"),
          status: "pending",
          created_at: now,
          updated_at: now,
        });
        await this.queueProcessingRun(transaction, sourceId, now);
        return {
          status: 202,
          body: {
            data: {
              archivedAt: null,
              retriesRemaining: 2,
              id: sourceId,
              type: "url",
              title: input.title,
              status: "pending",
              originalUrl,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
          },
        };
      },
    );
  }

  async createPdfSource(
    userId: string,
    key: string,
    fields: CreatePdfSourceFields,
    file: UploadedPdf | undefined,
  ): Promise<{ status: number; body: CreatePdfSourceResponse }> {
    if (!file) {
      throw new ProductError(
        422,
        "VALIDATION_ERROR",
        "Request validation failed",
        "A PDF file is required.",
        [{ path: "file", code: "required", message: "A PDF file is required." }],
      );
    }
    if (
      file.size > this.environment.SOURCE_PDF_MAX_BYTES ||
      file.buffer.byteLength > this.environment.SOURCE_PDF_MAX_BYTES
    ) {
      throw new ProductError(
        413,
        "SOURCE_TOO_LARGE",
        "Source is too large",
        "The PDF exceeds the configured upload limit.",
      );
    }
    if (file.mimetype.toLowerCase() !== "application/pdf") {
      throw new ProductError(
        415,
        "SOURCE_UNSUPPORTED_MEDIA_TYPE",
        "Unsupported media type",
        "The uploaded Source must declare the application/pdf media type.",
      );
    }
    if (file.buffer.byteLength < 5 || file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new ProductError(
        422,
        "SOURCE_INVALID_PDF",
        "Invalid PDF",
        "The uploaded file does not have a valid PDF signature.",
      );
    }

    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    const payloadHash = createHash("sha256")
      .update(
        JSON.stringify({
          title: fields.title,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          contentHash,
        }),
      )
      .digest("hex");
    return this.idempotency.execute(
      { userId, method: "POST", route: "/api/v1/sources/pdf", key, payloadHash },
      async (transaction) => {
        await this.usage.lock(transaction, userId);
        const now = await this.usage.assertQuota(transaction, userId, "sources");
        const sourceId = randomUUID();
        const storageKey = `sources/${userId}/${sourceId}.pdf`;
        try {
          await this.infrastructure.storage.put({
            key: storageKey,
            body: file.buffer,
            contentType: "application/pdf",
          });
        } catch {
          throw new ProductError(
            503,
            "DEPENDENCY_UNAVAILABLE",
            "Storage unavailable",
            "The PDF could not be stored. Try again later.",
          );
        }

        await transaction.insert(sources).values({
          id: sourceId,
          user_id: userId,
          type: "pdf",
          title: fields.title,
          storage_key: storageKey,
          mime_type: "application/pdf",
          original_filename: file.originalname,
          content_hash: contentHash,
          status: "pending",
          metadata: { size_bytes: file.buffer.byteLength },
          created_at: now,
          updated_at: now,
        });
        await this.queueProcessingRun(transaction, sourceId, now);
        return {
          status: 202,
          body: {
            data: {
              archivedAt: null,
              retriesRemaining: 2,
              id: sourceId,
              type: "pdf",
              title: fields.title,
              status: "pending",
              originalFilename: file.originalname,
              sizeBytes: file.buffer.byteLength,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
          },
        };
      },
    );
  }

  async listSources(userId: string, query: ListSourcesQuery): Promise<ListSourcesResponse> {
    const filters: SQL[] = [
      eq(sources.user_id, userId),
      query.archived === "true" ? isNotNull(sources.archived_at) : isNull(sources.archived_at),
    ];
    if (query.q) {
      const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
      filters.push(
        or(
          ilike(sources.title, pattern),
          ilike(sources.original_filename, pattern),
          ilike(sources.original_url, pattern),
        ) as SQL,
      );
    }
    if (query.type) {
      filters.push(eq(sources.type, query.type));
    }
    if (query.status) {
      filters.push(eq(sources.status, query.status));
    }
    if (query.cursor !== undefined) {
      let cursor: z.infer<typeof sourceCursorSchema>;
      try {
        if (query.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(query.cursor)) {
          throw new Error("Invalid base64url cursor");
        }
        const decoded = Buffer.from(query.cursor, "base64url").toString("utf8");
        if (Buffer.from(decoded).toString("base64url") !== query.cursor) {
          throw new Error("Non-canonical base64url cursor");
        }
        cursor = sourceCursorSchema.parse(JSON.parse(decoded));
      } catch {
        throw new ProductError(
          400,
          "VALIDATION_ERROR",
          "Invalid cursor",
          "The pagination cursor is invalid.",
        );
      }
      const createdAt = new Date(cursor.createdAt);
      filters.push(
        or(
          lt(sources.created_at, createdAt),
          and(eq(sources.created_at, createdAt), lt(sources.id, cursor.id)),
        ) as SQL,
      );
    }

    const rows = await this.infrastructure.database.db
      .select({ ...sourceFields, runCount: sourceRunCount })
      .from(sources)
      .where(and(...filters))
      .orderBy(desc(sources.created_at), desc(sources.id))
      .limit(query.limit + 1);
    const hasNextPage = rows.length > query.limit;
    const page = rows.slice(0, query.limit).map(sourceFromRow);
    const lastSource = page.at(-1);

    return {
      data: page,
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && lastSource
            ? Buffer.from(
                JSON.stringify({ createdAt: lastSource.createdAt, id: lastSource.id }),
              ).toString("base64url")
            : null,
      },
    };
  }

  async getSource(userId: string, sourceId: string): Promise<Source> {
    const [row] = await this.infrastructure.database.db
      .select({ ...sourceFields, runCount: sourceRunCount })
      .from(sources)
      .where(and(eq(sources.id, sourceId), eq(sources.user_id, userId)))
      .limit(1);

    if (!row) {
      throw new ProductError(
        404,
        "NOT_FOUND",
        "Resource not found",
        "The requested resource was not found.",
      );
    }

    return sourceFromRow(row);
  }

  async retrySource(
    userId: string,
    sourceId: string,
    key: string,
  ): Promise<{ status: number; body: RetrySourceResponse }> {
    const route = `/api/v1/sources/${sourceId}/retry`;
    const payloadHash = createHash("sha256").update("{}").digest("hex");
    return this.idempotency.execute(
      { userId, method: "POST", route, key, payloadHash },
      async (transaction) => {
        await this.usage.lock(transaction, userId);
        const [row] = await transaction
          .select({ ...sourceFields, runCount: sourceRunCount })
          .from(sources)
          .where(and(eq(sources.id, sourceId), eq(sources.user_id, userId)))
          .for("update")
          .limit(1);
        if (!row) {
          throw new ProductError(
            404,
            "NOT_FOUND",
            "Resource not found",
            "The requested resource was not found.",
          );
        }
        const failure = readSourceFailure(row.failure);
        if (
          row.archivedAt ||
          row.status !== "failed" ||
          !failure.retryable ||
          row.type === "text"
        ) {
          throw new ProductError(
            409,
            "SOURCE_RETRY_NOT_ALLOWED",
            "Source retry is not allowed",
            "Restore archived sources before retrying. Only a retryable failed PDF or URL Source can be retried.",
          );
        }

        const remaining = await this.usage.assertRetry(transaction, "sources", sourceId);
        const now = new Date();
        await this.queueProcessingRun(transaction, sourceId, now);
        await transaction
          .update(sources)
          .set({ status: "pending", failure: null, updated_at: now })
          .where(eq(sources.id, sourceId));
        return {
          status: 202,
          body: {
            data: {
              ...sourceFromRow({ ...row, status: "pending", failure: null, updatedAt: now }),
              retriesRemaining: remaining,
            },
          },
        };
      },
    );
  }

  async patchSource(userId: string, sourceId: string, input: PatchSourceBody): Promise<Source> {
    if (input.text !== undefined) {
      const source = await this.getSource(userId, sourceId);
      if (source.type !== "text")
        throw new ProductError(
          422,
          "VALIDATION_ERROR",
          "Invalid source type",
          "Only text sources can be edited.",
        );
    }
    const [row] = await this.infrastructure.database.db
      .update(sources)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.text !== undefined
          ? {
              text_content: input.text,
              content_hash: createHash("sha256").update(input.text).digest("hex"),
            }
          : {}),
        ...(input.archived !== undefined
          ? { archived_at: input.archived ? new Date() : null }
          : {}),
        updated_at: new Date(),
      })
      .where(and(eq(sources.id, sourceId), eq(sources.user_id, userId)))
      .returning({ ...sourceFields, runCount: sourceRunCount });
    if (!row)
      throw new ProductError(
        404,
        "NOT_FOUND",
        "Resource not found",
        "The requested resource was not found.",
      );
    return sourceFromRow(row);
  }

  async preview(userId: string, sourceId: string): Promise<SourcePreviewResponse> {
    const [row] = await this.infrastructure.database.db
      .select({ text: sources.text_content })
      .from(sources)
      .where(and(eq(sources.id, sourceId), eq(sources.user_id, userId)));
    if (!row)
      throw new ProductError(
        404,
        "NOT_FOUND",
        "Resource not found",
        "The requested resource was not found.",
      );
    const sections = await this.infrastructure.database.db
      .select({
        position: source_contents.position,
        pageNumber: source_contents.page_number,
        heading: source_contents.heading,
        content: source_contents.content,
      })
      .from(source_contents)
      .where(eq(source_contents.source_id, sourceId))
      .orderBy(asc(source_contents.position));
    return { data: { text: row.text, sections } };
  }

  async file(userId: string, sourceId: string): Promise<SourceFileResponse> {
    const [row] = await this.infrastructure.database.db
      .select({ type: sources.type, key: sources.storage_key })
      .from(sources)
      .where(and(eq(sources.id, sourceId), eq(sources.user_id, userId)));
    if (row?.type !== "pdf" || !row.key)
      throw new ProductError(
        404,
        "NOT_FOUND",
        "File not found",
        "The requested PDF was not found.",
      );
    try {
      const expiresAt = new Date(Date.now() + 300_000).toISOString();
      const url = await this.infrastructure.storage.createSignedUrl(row.key, 300);
      return { data: { url, expiresAt } };
    } catch {
      throw new ProductError(
        503,
        "DEPENDENCY_UNAVAILABLE",
        "Storage unavailable",
        "The PDF could not be opened. Try again later.",
      );
    }
  }

  private async queueProcessingRun(
    transaction: DatabaseTransaction,
    sourceId: string,
    createdAt: Date,
  ): Promise<void> {
    await transaction.insert(source_processing_runs).values({
      id: randomUUID(),
      source_id: sourceId,
      status: "queued",
      created_at: createdAt,
    });
  }
}
