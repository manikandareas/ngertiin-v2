import { type DatabaseTransaction, user_stats } from "@ngertiin/database";
import { sql } from "drizzle-orm";

// Call only after locking user_stats and successfully inserting the XP event.
export async function addLeaderboardXp(
  transaction: DatabaseTransaction,
  userId: string,
  amount: number,
) {
  await transaction.execute(sql`
    with instant as materialized (select clock_timestamp() as now)
    update ${user_stats} set
      leaderboard_xp = case when leaderboard_expires_at > instant.now
        then leaderboard_xp + ${amount} else ${amount} end,
      leaderboard_expires_at = instant.now + interval '168 hours'
    from instant where user_id = ${userId}::uuid
  `);
}
