\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $$
BEGIN
  IF EXISTS (
    WITH xp_totals AS (
      SELECT user_id, COALESCE(SUM(amount), 0)::integer AS total_xp
      FROM xp_events
      GROUP BY user_id
    )
    SELECT 1
    FROM user_stats stats
    FULL OUTER JOIN xp_totals ledger USING (user_id)
    WHERE COALESCE(stats.total_xp, 0) <> COALESCE(ledger.total_xp, 0)
  ) THEN
    RAISE EXCEPTION 'release integrity failed: XP ledger does not match user_stats.total_xp';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM user_concept_mastery
    GROUP BY user_id, module_id, concept_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'release integrity failed: duplicate user concept mastery';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM node_progress
    GROUP BY user_id, node_id
    HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM user_module_progress
    GROUP BY user_id, module_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'release integrity failed: duplicate progress record';
  END IF;
END
$$;

ROLLBACK;
