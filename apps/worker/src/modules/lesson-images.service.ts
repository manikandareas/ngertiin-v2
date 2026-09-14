import { Inject, Injectable } from "@nestjs/common";
import type { StoredLessonImage } from "@ngertiin/contracts/api";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { generation_runs } from "@ngertiin/database";
import {
  downloadThumbnail,
  normalizeCommonsQuery,
  searchCommons,
} from "@ngertiin/shared/commons-images";
import { eq, sql } from "drizzle-orm";
import { AiService } from "../ai/ai.service.js";
import { WORKER_ENV } from "../config.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { placeLessonImages } from "./lesson-image-content.js";
import { buildLessonImageReviewRequest, type InspectedLessonImage } from "./lesson-image-review.js";
import type { GeneratedNodeActivities, NodeActivities } from "./modules.schemas.js";

const LESSON_IMAGE_TIMEOUT_MS = 60_000;
const MAX_SEARCH_QUERIES = 2;
const MAX_REVIEW_CANDIDATES = 3;

type ImageStage = "search" | "download" | "visual_inspection" | "storage";
interface ImageSearchDiagnostic {
  id: string;
  query: string;
  resultCount: number | null;
  candidateCount: number | null;
}
interface LessonImageDiagnostic {
  event: "lesson.images";
  runId: string;
  nodeKey: string;
  activityIndex: number;
  durationMs: number;
  requested: number;
  searches: ImageSearchDiagnostic[];
  candidateCount: number;
  selected: number;
  appended: string[];
  skipped: string[];
  reviews: { id: string; index: number | null; reason: string }[];
}

@Injectable()
export class LessonImagesService {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(WORKER_ENV) private readonly environment: WorkerEnvironment,
  ) {}
  async enrich(
    output: GeneratedNodeActivities,
    runId: string,
    nodeKey: string,
  ): Promise<NodeActivities> {
    const activities: NodeActivities["activities"] = [];
    const diagnostics: LessonImageDiagnostic[] = [];
    for (const [activityIndex, activity] of output.activities.entries()) {
      if (activity.type !== "lesson") {
        activities.push(activity);
        continue;
      }
      const started = performance.now();
      const signal = AbortSignal.timeout(LESSON_IMAGE_TIMEOUT_MS);
      const images: StoredLessonImage[] = [];
      let candidateCount = 0;
      const skipped: string[] = [];
      const reviews: { id: string; index: number | null; reason: string }[] = [];
      const searches: ImageSearchDiagnostic[] = [];
      let stage: ImageStage = "search";
      const userAgent = this.environment.WIKIMEDIA_USER_AGENT;
      if (!activity.visualNeeds.length) skipped.push("no_visual_requested");
      if (!this.environment.AI_IMAGE_INPUT_ENABLED) skipped.push("image_input_disabled");
      for (const need of this.environment.AI_IMAGE_INPUT_ENABLED ? activity.visualNeeds : []) {
        try {
          if (images.some((image) => image.id === need.id)) continue;
          const queries = [
            ...new Set(
              [need.query, need.fallbackQuery ?? ""].map(normalizeCommonsQuery).filter(Boolean),
            ),
          ];
          if (!queries.length) skipped.push("empty_search_query");
          const seen = new Set<string>();
          for (const query of queries.slice(0, MAX_SEARCH_QUERIES)) {
            signal.throwIfAborted();
            stage = "search";
            const search: ImageSearchDiagnostic = {
              id: need.id,
              query,
              resultCount: null,
              candidateCount: null,
            };
            searches.push(search);
            const result = await searchCommons(query, signal, userAgent);
            search.resultCount = result.resultCount;
            search.candidateCount = result.candidates.length;
            candidateCount += result.candidates.length;
            if (!result.candidates.length) {
              skipped.push(result.resultCount ? "no_eligible_candidates" : "no_search_results");
              continue;
            }
            const candidates = result.candidates.filter(
              (candidate) => !seen.has(candidate.fileTitle),
            );
            if (!candidates.length) {
              skipped.push("no_new_candidates");
              continue;
            }
            stage = "download";
            const inspected: InspectedLessonImage[] = [];
            for (const candidate of candidates.slice(0, MAX_REVIEW_CANDIDATES)) {
              seen.add(candidate.fileTitle);
              try {
                inspected.push({
                  candidate,
                  bytes: await downloadThumbnail(candidate, signal, userAgent),
                });
              } catch (error) {
                if (isSharedFailure(error, signal)) throw error;
                skipped.push("thumbnail_download_failed");
                signal.throwIfAborted();
              }
            }
            if (!inspected.length) {
              skipped.push("no_downloadable_candidates");
              continue;
            }
            stage = "visual_inspection";
            const selection = await this.ai.generateObject(
              buildLessonImageReviewRequest(need, activity.content.body, inspected, signal),
            );
            reviews.push({ id: need.id, index: selection.index, reason: selection.reason });
            const chosen = selection.index === null ? undefined : inspected[selection.index];
            if (!chosen || !selection.caption.trim() || !selection.alt.trim()) {
              skipped.push("visual_rejected");
              continue;
            }
            signal.throwIfAborted();
            const objectKey = `lesson-images/${encodeURIComponent(runId)}/${encodeURIComponent(nodeKey)}/${activityIndex}/${need.id}`;
            stage = "storage";
            await this.infrastructure.storage.put({
              key: objectKey,
              body: chosen.bytes,
              contentType: chosen.candidate.mime,
              signal,
            });
            signal.throwIfAborted();
            const { thumbnail: _thumbnail, mime: _mime, ...metadata } = chosen.candidate;
            images.push({
              ...metadata,
              id: need.id,
              objectKey,
              caption: selection.caption,
              alt: selection.alt,
            });
            break;
          }
        } catch (error) {
          let reason = `${stage}_failed`;
          if (signal.aborted) reason = "lesson_timeout";
          else if (error instanceof Error && /^[a-z_]+$/.test(error.message))
            reason = error.message;
          skipped.push(reason);
          if (isSharedFailure(error, signal)) break;
        }
      }
      const { body, appended } = placeLessonImages(activity.content.body, images);
      activities.push({ type: "lesson", content: { ...activity.content, body, images } });
      const diagnostic: LessonImageDiagnostic = {
        event: "lesson.images",
        runId,
        nodeKey,
        activityIndex,
        durationMs: Math.round(performance.now() - started),
        requested: activity.visualNeeds.length,
        searches,
        candidateCount,
        selected: images.length,
        appended,
        skipped,
        reviews,
      };
      diagnostics.push(diagnostic);
      console.log(JSON.stringify(diagnostic));
    }
    await this.persistDiagnostics(runId, nodeKey, diagnostics);
    return { activities };
  }

  private async persistDiagnostics(
    runId: string,
    nodeKey: string,
    diagnostics: LessonImageDiagnostic[],
  ): Promise<void> {
    if (!diagnostics.length) return;
    // One entry per node makes retries replace their diagnostics, without losing other nodes.
    try {
      await this.infrastructure.database.db
        .update(generation_runs)
        .set({
          metadata: sql`COALESCE(${generation_runs.metadata}, '{}'::jsonb) || jsonb_build_object('lessonImages', COALESCE(${generation_runs.metadata}->'lessonImages', '{}'::jsonb) || ${JSON.stringify({ [nodeKey]: diagnostics })}::jsonb)`,
        })
        .where(eq(generation_runs.id, runId));
    } catch {
      console.warn(JSON.stringify({ event: "lesson.images_diagnostics_failed", runId, nodeKey }));
    }
  }
}

function isSharedFailure(error: unknown, signal: AbortSignal): boolean {
  return (
    signal.aborted ||
    (error instanceof Error &&
      ["wikimedia_rate_limited", "wikimedia_api_limited", "wikimedia_request_failed"].includes(
        error.message,
      ))
  );
}
