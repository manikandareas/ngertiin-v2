import { sql } from "drizzle-orm";

// Keep outer table names explicit: Drizzle unqualifies interpolated columns in single-table selects.
export const moduleRunCount = sql<number>`(select count(*)::int from generation_runs usage_runs where usage_runs.module_id = "generation_runs"."module_id" and usage_runs.type = 'module')`;
export const sourceRunCount = sql<number>`(select count(*)::int from source_processing_runs usage_runs where usage_runs.source_id = "sources"."id")`;
export function retriesRemaining(runs: number): number {
  return Math.max(0, 2 - Math.max(0, runs - 1));
}
