ALTER TABLE "users" ADD COLUMN "avatar_url" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_initialized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_retry_after" timestamp with time zone;
--> statement-breakpoint
UPDATE "users" SET "avatar_url" = 'https://api.dicebear.com/10.x/adventurer-neutral/svg?seed=' || "id"::text || '&backgroundColor=ff2e88,00e5ff,ffe600,7cff00,ff6a00,b400ff';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "avatar_url" SET NOT NULL;
