import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  type CreateTextSourceBody,
  type CreateTextSourceResponse,
  type ListSourcesQuery,
  type ListSourcesResponse,
  type Source,
  timestampSchema,
  uuidSchema,
} from "@ngertiin/contracts/api";
import { sources } from "@ngertiin/database";
import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { ProductError } from "../http/product-error.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

const sourceCursorSchema = z
  .object({
    createdAt: timestampSchema,
    id: uuidSchema,
  })
  .strict();

@Injectable()
export class SourcesService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
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
        const now = new Date();
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
          .returning({
            id: sources.id,
            type: sources.type,
            title: sources.title,
            status: sources.status,
            originalFilename: sources.original_filename,
            originalUrl: sources.original_url,
            createdAt: sources.created_at,
            updatedAt: sources.updated_at,
          });

        if (!row) {
          throw new Error("Text Source insert did not return a row");
        }

        return {
          status: 201,
          body: {
            data: {
              id: row.id,
              type: row.type,
              title: row.title,
              status: row.status,
              ...(row.originalFilename ? { originalFilename: row.originalFilename } : {}),
              ...(row.originalUrl ? { originalUrl: row.originalUrl } : {}),
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
            },
          },
        };
      },
    );
  }

  async listSources(userId: string, query: ListSourcesQuery): Promise<ListSourcesResponse> {
    const filters: SQL[] = [eq(sources.user_id, userId)];
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
      .select({
        id: sources.id,
        type: sources.type,
        title: sources.title,
        status: sources.status,
        originalFilename: sources.original_filename,
        originalUrl: sources.original_url,
        createdAt: sources.created_at,
        updatedAt: sources.updated_at,
      })
      .from(sources)
      .where(and(...filters))
      .orderBy(desc(sources.created_at), desc(sources.id))
      .limit(query.limit + 1);
    const hasNextPage = rows.length > query.limit;
    const page = rows.slice(0, query.limit).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      status: row.status,
      ...(row.originalFilename ? { originalFilename: row.originalFilename } : {}),
      ...(row.originalUrl ? { originalUrl: row.originalUrl } : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
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
      .select({
        id: sources.id,
        type: sources.type,
        title: sources.title,
        status: sources.status,
        originalFilename: sources.original_filename,
        originalUrl: sources.original_url,
        createdAt: sources.created_at,
        updatedAt: sources.updated_at,
      })
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

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      status: row.status,
      ...(row.originalFilename ? { originalFilename: row.originalFilename } : {}),
      ...(row.originalUrl ? { originalUrl: row.originalUrl } : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
