-- Run with a read-only database role. No prompts, filenames, objects, users or credentials.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH recent AS (
  SELECT * FROM chat_runs WHERE created_at >= now() - interval '24 hours'
), statuses AS (
  SELECT status, error_code, count(*) AS runs,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (finished_at-created_at))*1000) AS p50_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM (finished_at-created_at))*1000) AS p95_ms
  FROM recent GROUP BY status, error_code
), usage AS (
  SELECT provider, model, coverage, count(*) AS calls,
    sum(input_tokens) AS input_tokens, sum(output_tokens) AS output_tokens,
    sum(total_tokens) AS total_tokens
  FROM chat_run_usage JOIN recent ON recent.id = chat_run_usage.run_id
  GROUP BY provider, model, coverage
), coverage AS (
  SELECT v.id AS index_version, v.status AS version_status,
    count(d.id) AS eligible_documents,
    count(r.id) FILTER (WHERE r.status = 'ready') AS ready,
    count(r.id) FILTER (WHERE r.status = 'failed') AS failed,
    count(d.id) FILTER (WHERE r.id IS NULL OR r.status NOT IN ('ready','failed')) AS pending
  FROM knowledge_index_versions v
  LEFT JOIN knowledge_documents d ON d.deleted_at IS NULL
  LEFT JOIN knowledge_document_revisions r ON r.document_id=d.id
    AND r.index_version_id=v.id AND r.content_revision=d.current_content_revision
  WHERE v.status IN ('active','building') GROUP BY v.id, v.status
), ocr AS (
  SELECT extraction_usage->>'model' AS model, extraction_usage->>'coverage' AS coverage,
    count(*) AS attachments, sum((extraction_usage->>'pagesProcessed')::numeric) AS pages_processed
  FROM chat_attachments WHERE extraction_usage IS NOT NULL
    AND created_at >= now()-interval '24 hours'
  GROUP BY extraction_usage->>'model', extraction_usage->>'coverage'
)
SELECT jsonb_pretty(jsonb_build_object(
  'capturedAt', now(), 'window', '24 hours',
  'runs', (SELECT coalesce(jsonb_agg(statuses), '[]') FROM statuses),
  'usage', (SELECT coalesce(jsonb_agg(usage), '[]') FROM usage),
  'queue', (SELECT jsonb_build_object(
    'queued', count(*) FILTER (WHERE status='queued'),
    'active', count(*),
    'oldestQueuedMs', coalesce(max(extract(epoch FROM (now()-created_at))*1000) FILTER (WHERE status='queued'),0),
    'expiredLeases', count(*) FILTER (WHERE lease_expires_at <= now()),
    'pastDeadline', count(*) FILTER (WHERE deadline_at <= now())
  ) FROM chat_runs WHERE status IN ('queued','running','cancelling')),
  'indexCoverage', (SELECT coalesce(jsonb_agg(coverage), '[]') FROM coverage),
  'ocr', (SELECT coalesce(jsonb_agg(ocr), '[]') FROM ocr),
  'attachmentCleanupPending', (SELECT count(*) FROM chat_attachments
    WHERE deleted_at IS NOT NULL OR (thread_id IS NULL AND created_at <= now()-interval '24 hours'))
));
COMMIT;
