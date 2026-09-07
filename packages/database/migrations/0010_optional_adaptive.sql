-- Existing generated content and jobs remain usable; only the mandatory gate is removed.
-- Run with the old API/worker stopped so they cannot recreate mandatory gates.
WITH converted AS (
  UPDATE adaptive_interventions
  SET required = false
  WHERE required = true
  RETURNING user_id, module_id
), affected AS (
  SELECT DISTINCT user_id, module_id FROM converted
), next_core AS (
  SELECT DISTINCT ON (a.user_id, a.module_id)
    a.user_id, a.module_id, n.id AS node_id
  FROM affected a
  JOIN module_nodes n ON n.module_id = a.module_id AND n.origin = 'core'
  JOIN node_progress p ON p.node_id = n.id AND p.user_id = a.user_id
  WHERE p.status <> 'completed'
  ORDER BY a.user_id, a.module_id, n.core_position
), unlocked AS (
  UPDATE node_progress p
  SET status = 'available', updated_at = current_timestamp
  FROM next_core n
  WHERE p.user_id = n.user_id AND p.node_id = n.node_id AND p.status = 'locked'
  RETURNING p.id
)
UPDATE user_module_progress p
SET current_node_id = n.node_id, updated_at = current_timestamp
FROM next_core n
WHERE p.user_id = n.user_id AND p.module_id = n.module_id
  AND NOT EXISTS (
    SELECT 1 FROM module_nodes current_node
    JOIN node_progress current_progress
      ON current_progress.node_id = current_node.id AND current_progress.user_id = p.user_id
    WHERE current_node.id = p.current_node_id
      AND current_node.module_id = p.module_id AND current_node.origin = 'core'
      AND current_progress.status IN ('available', 'in_progress')
  );
