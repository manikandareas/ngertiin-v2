import { Inject, Injectable } from "@nestjs/common";
import type { CurrentUser, PatchCurrentUserBody } from "@ngertiin/contracts/api";
import { user_stats, users } from "@ngertiin/database";
import { eq } from "drizzle-orm";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

@Injectable()
export class UsersService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const [row] = await this.infrastructure.database.db
      .select({
        id: users.id,
        displayName: users.display_name,
        timezone: users.timezone,
        totalXp: user_stats.total_xp,
        currentStreak: user_stats.current_streak,
        longestStreak: user_stats.longest_streak,
        lastLearningDate: user_stats.last_learning_date,
      })
      .from(users)
      .innerJoin(user_stats, eq(user_stats.user_id, users.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (row === null || row === undefined) {
      throw new ProductError(
        404,
        "NOT_FOUND",
        "Resource not found",
        "The requested resource was not found.",
      );
    }

    return {
      id: row.id,
      displayName: row.displayName,
      timezone: row.timezone,
      stats: {
        totalXp: row.totalXp,
        currentStreak: row.currentStreak,
        longestStreak: row.longestStreak,
        lastLearningDate: row.lastLearningDate,
      },
    } satisfies CurrentUser;
  }

  async updateCurrentUser(userId: string, input: PatchCurrentUserBody): Promise<CurrentUser> {
    const values: {
      display_name?: string | null;
      timezone?: string;
      updated_at: Date;
    } = { updated_at: new Date() };

    if (Object.hasOwn(input, "displayName")) {
      values.display_name = input.displayName ?? null;
    }
    if (Object.hasOwn(input, "timezone") && input.timezone !== undefined) {
      values.timezone = input.timezone;
    }

    const [updated] = await this.infrastructure.database.db
      .update(users)
      .set(values)
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (updated === null || updated === undefined) {
      throw new ProductError(
        404,
        "NOT_FOUND",
        "Resource not found",
        "The requested resource was not found.",
      );
    }

    return this.getCurrentUser(userId);
  }
}
