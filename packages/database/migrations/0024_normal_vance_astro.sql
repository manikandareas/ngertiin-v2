CREATE TABLE "speech_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"text" text NOT NULL,
	"provider" varchar(32) NOT NULL,
	"model" varchar(100) NOT NULL,
	"voice" varchar(200) NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"object_key" text,
	"failure_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "speech_assets_fingerprint_unique" UNIQUE("fingerprint"),
	CONSTRAINT "speech_assets_status_check" CHECK ("speech_assets"."status" in ('queued', 'processing', 'ready', 'failed'))
);
