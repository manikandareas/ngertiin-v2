import { Inject, Injectable } from "@nestjs/common";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import {
  type DatabaseTransaction,
  generation_runs,
  modules,
  source_processing_runs,
  sources,
} from "@ngertiin/database";
import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

import { retriesRemaining } from "./usage-policy.js";

type Reader = Pick<DatabaseTransaction, "select">;

@Injectable()
export class UsageService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(API_ENV) private readonly environment: ApiEnvironment,
  ) {}

  async lock(transaction: DatabaseTransaction, userId: string) {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`usage:${userId}`}, 0))`,
    );
  }

  async read(userId: string, reader: Reader = this.infrastructure.database.db, now = new Date()) {
    // Jakarta has a fixed UTC+7 offset. Profile timezone never participates.
    const local = new Date(now.getTime() + 7 * 3600_000);
    local.setUTCHours(0, 0, 0, 0);
    local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
    const start = new Date(local.getTime() - 7 * 3600_000);
    const reset = new Date(start.getTime() + 7 * 86400_000);
    const [moduleCounts, sourceCounts, active] = await Promise.all([
      reader
        .select({ used: count() })
        .from(modules)
        .where(
          and(
            eq(modules.owner_id, userId),
            gte(modules.created_at, start),
            lt(modules.created_at, reset),
          ),
        ),
      reader
        .select({ used: count() })
        .from(sources)
        .where(
          and(
            eq(sources.user_id, userId),
            gte(sources.created_at, start),
            lt(sources.created_at, reset),
          ),
        ),
      this.active(userId, reader),
    ]);
    const quota = (limit: number, used: number) => ({
      limit,
      used,
      remaining: Math.max(0, limit - used),
    });
    return {
      periodStart: start.toISOString(),
      resetAt: reset.toISOString(),
      timezone: "Asia/Jakarta" as const,
      modules: quota(this.environment.USAGE_MODULES_WEEKLY_LIMIT, moduleCounts[0]?.used ?? 0),
      sources: quota(this.environment.USAGE_SOURCES_WEEKLY_LIMIT, sourceCounts[0]?.used ?? 0),
      activeModuleId: active?.moduleId ?? null,
    };
  }

  private async active(userId: string, reader: Reader) {
    const [active] = await reader
      .select({ moduleId: generation_runs.module_id })
      .from(generation_runs)
      .where(
        and(
          eq(generation_runs.user_id, userId),
          eq(generation_runs.type, "module"),
          inArray(generation_runs.status, ["queued", "processing"]),
        ),
      )
      .limit(1);
    return active;
  }

  async assertSlot(transaction: DatabaseTransaction, userId: string) {
    const active = await this.active(userId, transaction);
    if (active)
      throw new ProductError(
        409,
        "GENERATION_IN_PROGRESS",
        "Generation in progress",
        "Masih ada modul yang sedang dibuat.",
        undefined,
        { activeModuleId: active.moduleId },
      );
  }

  async assertQuota(
    transaction: DatabaseTransaction,
    userId: string,
    category: "modules" | "sources",
  ) {
    const now = new Date();
    const usage = await this.read(userId, transaction, now);
    if (usage[category].remaining === 0)
      throw new ProductError(
        429,
        "USAGE_LIMIT_EXCEEDED",
        "Weekly usage limit exceeded",
        `Kuota ${category === "modules" ? "modul" : "bahan"} minggu ini habis.`,
        undefined,
        { category, resetAt: usage.resetAt },
      );
    return now;
  }

  async assertRetry(transaction: DatabaseTransaction, category: "modules" | "sources", id: string) {
    const rows =
      category === "modules"
        ? await transaction
            .select({ runs: count() })
            .from(generation_runs)
            .where(and(eq(generation_runs.module_id, id), eq(generation_runs.type, "module")))
        : await transaction
            .select({ runs: count() })
            .from(source_processing_runs)
            .where(eq(source_processing_runs.source_id, id));
    const remaining = retriesRemaining(rows[0]?.runs ?? 0);
    if (remaining === 0)
      throw new ProductError(
        409,
        "RETRY_LIMIT_EXCEEDED",
        "Retry limit exceeded",
        "Batas 2 kali percobaan ulang sudah tercapai.",
      );
    return remaining - 1;
  }
}
