import { randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { user_stats, users } from "@ngertiin/database";
import { and, eq, isNull, sql } from "drizzle-orm";
import { API_ENV } from "../config.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

const PROFILE_FETCH_TIMEOUT_MS = 3_000;

function createAvatarUrl(userId: string): string {
  return `https://api.dicebear.com/10.x/adventurer-neutral/svg?seed=${encodeURIComponent(userId)}&backgroundColor=ff2e88,00e5ff,ffe600,7cff00,ff6a00,b400ff`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly clerk: ReturnType<typeof createClerkClient>;

  constructor(
    @Inject(API_ENV) environment: ApiEnvironment,
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {
    this.clerk = createClerkClient({ secretKey: environment.CLERK_SECRET_KEY });
  }

  async ensureUser(clerkUserId: string): Promise<string> {
    const user = await this.infrastructure.database.db.transaction(async (transaction) => {
      const id = randomUUID();
      await transaction
        .insert(users)
        .values({
          id,
          clerk_user_id: clerkUserId,
          avatar_url: createAvatarUrl(id),
        })
        .onConflictDoNothing({ target: users.clerk_user_id });
      const [row] = await transaction
        .select({ id: users.id, initializedAt: users.profile_initialized_at })
        .from(users)
        .where(eq(users.clerk_user_id, clerkUserId))
        .limit(1);
      if (!row) throw new Error("Local user provisioning did not return a user");
      await transaction
        .insert(user_stats)
        .values({ user_id: row.id })
        .onConflictDoNothing({ target: user_stats.user_id });
      return row;
    });
    if (!user.initializedAt) await this.initializeProfile(user.id, clerkUserId);
    return user.id;
  }

  private async initializeProfile(userId: string, clerkUserId: string): Promise<void> {
    const db = this.infrastructure.database.db;
    // A persisted lease also bounds retries across API instances and process restarts.
    const [claimed] = await db
      .update(users)
      .set({
        profile_retry_after: sql`now() + interval '5 minutes'`,
      })
      .where(
        and(
          eq(users.id, userId),
          isNull(users.profile_initialized_at),
          sql`(${users.profile_retry_after} is null or ${users.profile_retry_after} <= now())`,
        ),
      )
      .returning({ id: users.id });
    if (!claimed) return;

    let displayName: string | null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const profile = await Promise.race([
        this.clerk.users.getUser(clerkUserId),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Clerk profile timeout")),
            PROFILE_FETCH_TIMEOUT_MS,
          );
        }),
      ]);
      displayName =
        [profile.firstName, profile.lastName]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(" ") || null;
    } catch (error) {
      this.logger.warn({
        event: "auth.profile_initialization_failed",
        userId,
        errorType: error instanceof Error ? error.name : "UnknownError",
        message: "Profile initialization will retry after five minutes.",
      });
      return;
    } finally {
      clearTimeout(timeout);
    }
    // Preserve manual edits, including a deliberate clear, made while Clerk was loading.
    await db
      .update(users)
      .set({
        display_name: sql`coalesce(nullif(btrim(${users.display_name}), ''), ${displayName})`,
        profile_initialized_at: sql`now()`,
        profile_retry_after: null,
      })
      .where(and(eq(users.id, userId), isNull(users.profile_initialized_at)));
  }
}
