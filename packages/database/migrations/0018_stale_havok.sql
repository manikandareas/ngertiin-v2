CREATE TABLE "chat_admission_slots" (
	"id" text PRIMARY KEY NOT NULL,
	CONSTRAINT "chat_admission_global_only" CHECK ("chat_admission_slots"."id" = 'global')
);
--> statement-breakpoint
INSERT INTO "chat_admission_slots" ("id") VALUES ('global');
