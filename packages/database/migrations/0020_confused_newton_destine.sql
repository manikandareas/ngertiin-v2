ALTER TABLE "chat_threads" ALTER COLUMN "module_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_threads" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "chat_threads" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
CREATE INDEX "chat_threads_owner_recent_idx" ON "chat_threads" USING btree ("user_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "chat_threads_module_recent_idx" ON "chat_threads" USING btree ("user_id","module_id","updated_at","id");