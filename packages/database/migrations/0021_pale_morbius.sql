CREATE TABLE "chat_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"content_hash" text NOT NULL,
	"context_tokens" integer NOT NULL,
	"thread_id" uuid,
	"message_id" uuid,
	"extraction_text" text,
	"extraction_status" text DEFAULT 'pending' NOT NULL,
	"extraction_usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chat_attachment_size" CHECK ("chat_attachments"."size" > 0 and "chat_attachments"."size" <= 10485760),
	CONSTRAINT "chat_attachment_binding" CHECK (("chat_attachments"."thread_id" is null) = ("chat_attachments"."message_id" is null)),
	CONSTRAINT "chat_attachment_extraction" CHECK ("chat_attachments"."extraction_status" in ('pending','ready','failed'))
);
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_attachment_owner_idx" ON "chat_attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_attachment_cleanup_idx" ON "chat_attachments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_attachment_thread_idx" ON "chat_attachments" USING btree ("thread_id");