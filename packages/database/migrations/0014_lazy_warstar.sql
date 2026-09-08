-- Run through the transactional migrator, with old API/worker XP writers stopped.
LOCK TABLE "user_stats" IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
ALTER TABLE "user_stats" ADD COLUMN "leaderboard_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_stats" ADD COLUMN "leaderboard_expires_at" timestamp with time zone;
--> statement-breakpoint
WITH launch AS MATERIALIZED (SELECT clock_timestamp() AS at)
UPDATE "user_stats" SET "leaderboard_xp" = "total_xp",
 "leaderboard_expires_at" = CASE WHEN "total_xp" > 0 THEN launch.at + interval '168 hours' ELSE NULL END
FROM launch;
