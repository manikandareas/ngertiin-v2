import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { SourceRole } from "@ngertiin/contracts/api";
import { generation_request_sources, generation_requests, sources } from "@ngertiin/database";
import { and, asc, eq } from "drizzle-orm";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { SourceError } from "./source.error.js";

const MAX_CHUNK_CODE_POINTS = 20_000;
const CHUNK_OVERLAP_CODE_POINTS = 500;

export interface SourceContext {
  readonly id: string;
  readonly title: string | null;
  readonly role: SourceRole;
  readonly priority: number;
  readonly text: string;
}

export interface SourceChunk {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceTitle: string | null;
  readonly role: SourceRole;
  readonly priority: number;
  readonly start: number;
  readonly end: number;
  readonly content: string;
}

export type ChunkDescriptor = Omit<SourceChunk, "content">;

@Injectable()
export class SourceService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  async loadModuleGenerationChunks(input: {
    generationRequestId: string;
    userId: string;
  }): Promise<SourceChunk[]> {
    const [request] = await this.infrastructure.database.db
      .select({ id: generation_requests.id })
      .from(generation_requests)
      .where(
        and(
          eq(generation_requests.id, input.generationRequestId),
          eq(generation_requests.user_id, input.userId),
        ),
      )
      .limit(1);
    if (!request) throw new SourceError("context_missing");

    const rows = await this.infrastructure.database.db
      .select({
        id: sources.id,
        userId: sources.user_id,
        type: sources.type,
        title: sources.title,
        status: sources.status,
        text: sources.text_content,
        role: generation_request_sources.role,
        priority: generation_request_sources.priority,
        selector: generation_request_sources.selector,
      })
      .from(generation_request_sources)
      .innerJoin(sources, eq(sources.id, generation_request_sources.source_id))
      .where(eq(generation_request_sources.generation_request_id, input.generationRequestId))
      .orderBy(asc(generation_request_sources.priority), asc(sources.id));
    if (rows.length === 0) throw new SourceError("context_missing");

    for (const row of rows) {
      if (
        row.userId !== input.userId ||
        row.type !== "text" ||
        row.status !== "ready" ||
        row.selector !== null ||
        !row.text?.trim()
      ) {
        throw new SourceError("context_invalid");
      }
    }

    return this.chunkSources(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        role: row.role,
        priority: row.priority,
        text: row.text as string,
      })),
    );
  }

  private chunkSources(sourceContexts: SourceContext[]): SourceChunk[] {
    return sourceContexts.flatMap((source) => {
      const codePoints = Array.from(source.text);
      const chunks: SourceChunk[] = [];
      let start = 0;

      while (start < codePoints.length) {
        const maximumEnd = Math.min(start + MAX_CHUNK_CODE_POINTS, codePoints.length);
        let end = maximumEnd;
        if (maximumEnd < codePoints.length) {
          const minimumBoundary = start + Math.floor(MAX_CHUNK_CODE_POINTS / 2);
          for (let index = maximumEnd - 1; index > minimumBoundary; index -= 1) {
            if (codePoints[index - 1] === "\n" && codePoints[index] === "\n") {
              end = index + 1;
              break;
            }
          }
        }

        const content = codePoints.slice(start, end).join("").trim();
        if (content.length > 0) {
          chunks.push({
            id: `chunk_${createHash("sha256")
              .update(`${source.id}:${start}:${end}`)
              .digest("hex")
              .slice(0, 24)}`,
            sourceId: source.id,
            sourceTitle: source.title,
            role: source.role,
            priority: source.priority,
            start,
            end,
            content,
          });
        }
        if (end >= codePoints.length) break;
        start = Math.max(start + 1, end - CHUNK_OVERLAP_CODE_POINTS);
      }

      return chunks;
    });
  }
}
