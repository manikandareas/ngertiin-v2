CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_revision_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"location_json" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_document_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"index_version_id" integer NOT NULL,
	"content_revision" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	CONSTRAINT "knowledge_revision_status" CHECK ("knowledge_document_revisions"."status" in ('pending','indexing','ready','failed','obsolete'))
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"source_content_id" uuid,
	"node_id" uuid,
	"activity_id" uuid,
	"current_content_revision" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "knowledge_document_origin" CHECK (("knowledge_documents"."origin" = 'original_source' and "knowledge_documents"."source_content_id" is not null and "knowledge_documents"."node_id" is null and "knowledge_documents"."activity_id" is null) or ("knowledge_documents"."origin" = 'generated_material' and "knowledge_documents"."source_content_id" is null and "knowledge_documents"."node_id" is not null and "knowledge_documents"."activity_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "knowledge_index_versions" (
	"id" integer PRIMARY KEY NOT NULL,
	"embedding_model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"normalizer_version" text NOT NULL,
	"chunker_version" text NOT NULL,
	"status" text DEFAULT 'building' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_version_status" CHECK ("knowledge_index_versions"."status" in ('building','active','retired')),
	CONSTRAINT "knowledge_dimensions" CHECK ("knowledge_index_versions"."dimensions" = 1536)
);
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_revision_id_knowledge_document_revisions_id_fk" FOREIGN KEY ("document_revision_id") REFERENCES "public"."knowledge_document_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_revisions" ADD CONSTRAINT "knowledge_document_revisions_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_revisions" ADD CONSTRAINT "knowledge_document_revisions_index_version_id_knowledge_index_versions_id_fk" FOREIGN KEY ("index_version_id") REFERENCES "public"."knowledge_index_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_source_content_id_source_contents_id_fk" FOREIGN KEY ("source_content_id") REFERENCES "public"."source_contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_node_id_module_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."module_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunk_ordinal_idx" ON "knowledge_chunks" USING btree ("document_revision_id","ordinal");--> statement-breakpoint
CREATE INDEX "knowledge_chunk_search_idx" ON "knowledge_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_revision_identity_idx" ON "knowledge_document_revisions" USING btree ("document_id","index_version_id","content_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_document_source_idx" ON "knowledge_documents" USING btree ("module_id","source_content_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_document_activity_idx" ON "knowledge_documents" USING btree ("module_id","activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_one_active_idx" ON "knowledge_index_versions" USING btree ("status") WHERE "knowledge_index_versions"."status" = 'active';
--> statement-breakpoint
CREATE FUNCTION knowledge_invalidate_material() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'activities' THEN
    UPDATE knowledge_documents SET current_content_revision = NULL WHERE activity_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'source_contents' THEN
    UPDATE knowledge_documents SET current_content_revision = NULL WHERE source_content_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'sources' THEN
    UPDATE knowledge_documents SET current_content_revision = NULL WHERE source_content_id IN (SELECT id FROM source_contents WHERE source_id = OLD.id);
  ELSIF TG_TABLE_NAME = 'module_nodes' THEN
    UPDATE knowledge_documents SET current_content_revision = NULL WHERE node_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'modules' THEN
    UPDATE knowledge_documents SET current_content_revision = NULL WHERE module_id = OLD.id;
  ELSE
    UPDATE knowledge_documents SET current_content_revision = NULL WHERE module_id IN (SELECT id FROM modules WHERE generation_request_id = OLD.generation_request_id);
  END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER knowledge_activity_changed AFTER UPDATE OF content, type, node_id ON activities FOR EACH ROW EXECUTE FUNCTION knowledge_invalidate_material();
--> statement-breakpoint
CREATE TRIGGER knowledge_source_content_changed AFTER UPDATE OF content, source_id, page_number, heading ON source_contents FOR EACH ROW EXECUTE FUNCTION knowledge_invalidate_material();
--> statement-breakpoint
CREATE TRIGGER knowledge_source_changed AFTER UPDATE OF status, user_id, title ON sources FOR EACH ROW EXECUTE FUNCTION knowledge_invalidate_material();
--> statement-breakpoint
CREATE TRIGGER knowledge_node_changed AFTER UPDATE OF module_id, title ON module_nodes FOR EACH ROW EXECUTE FUNCTION knowledge_invalidate_material();
--> statement-breakpoint
CREATE TRIGGER knowledge_module_changed AFTER UPDATE OF generation_request_id, owner_id, status ON modules FOR EACH ROW EXECUTE FUNCTION knowledge_invalidate_material();
--> statement-breakpoint
CREATE TRIGGER knowledge_source_link_changed AFTER DELETE OR UPDATE ON generation_request_sources FOR EACH ROW EXECUTE FUNCTION knowledge_invalidate_material();
