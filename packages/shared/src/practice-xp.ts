import {
  type DatabaseTransaction,
  practice_attempts,
  user_stats,
  users,
  xp_events,
} from "@ngertiin/database";
import { eq, sql } from "drizzle-orm";
import { addLeaderboardXp } from "./leaderboard.js";

/** Must run in the same transaction that finalizes the Practice result. */
export async function awardPracticeCompletion(
  tx: DatabaseTransaction,
  input: {
    userId: string;
    practiceId: string;
    attemptId: string;
    kind: "flashcard" | "quiz" | "exam";
    moduleId: string;
  },
): Promise<number> {
  const [stats] = await tx
    .select()
    .from(user_stats)
    .where(eq(user_stats.user_id, input.userId))
    .for("update");
  if (!stats) throw new Error("Missing user stats");
  const [user] = await tx
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, input.userId));
  const timezone = user?.timezone ?? "UTC";
  const [day] = await tx.execute(
    sql`select (clock_timestamp() at time zone ${timezone})::date::text as value`,
  );
  const today = String(day?.value);
  const [daily] = await tx.execute(
    sql`select coalesce(sum(amount),0)::integer as total from ${xp_events} where user_id = ${input.userId}::uuid and reason = 'practice_completed' and (created_at at time zone ${timezone})::date = ${today}::date`,
  );
  const base = input.kind === "flashcard" ? 10 : input.kind === "quiz" ? 20 : 30;
  const amount = Math.max(0, Math.min(base, 100 - Number(daily?.total ?? 0)));
  const [inserted] = await tx
    .insert(xp_events)
    .values({
      user_id: input.userId,
      module_id: input.moduleId,
      amount,
      reason: "practice_completed",
      reference_id: input.practiceId,
    })
    .onConflictDoNothing()
    .returning({ id: xp_events.id });
  if (!inserted) return 0;
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const streak =
    stats.last_learning_date === today
      ? stats.current_streak
      : stats.last_learning_date === yesterday.toISOString().slice(0, 10)
        ? stats.current_streak + 1
        : 1;
  await tx
    .update(user_stats)
    .set({
      total_xp: stats.total_xp + amount,
      current_streak: streak,
      longest_streak: Math.max(stats.longest_streak, streak),
      last_learning_date: today,
      updated_at: new Date(),
    })
    .where(eq(user_stats.user_id, input.userId));
  if (amount > 0) await addLeaderboardXp(tx, input.userId, amount);
  await tx
    .update(practice_attempts)
    .set({ xp_awarded: amount })
    .where(eq(practice_attempts.id, input.attemptId));
  return amount;
}
