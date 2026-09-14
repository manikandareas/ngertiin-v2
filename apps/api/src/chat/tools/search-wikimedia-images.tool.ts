import { randomUUID } from "node:crypto";
import { tool } from "@langchain/core/tools";
import { type ChatImage, chatImageSchema } from "@ngertiin/contracts/api";
import {
  downloadThumbnail,
  normalizeCommonsQuery,
  searchCommons,
} from "@ngertiin/shared/commons-images";
import type { S3StorageService } from "@ngertiin/storage";
import { z } from "zod";
import type { ChatExecutionBudget } from "../chat.budget.js";
import { type InspectedChatImage, reviewChatImages } from "../chat-image-review.js";

export const chatImageKey = (runId: string, imageId: string) => `chat-images/${runId}/${imageId}`;
const textOnlyInstruction =
  "Continue with a complete text explanation. Do not invent an image or retry this tool.";

type ImageSearchStatus = "not_requested" | "FOUND" | "NO_MATCH" | "UNAVAILABLE" | "CANCELLED";
export type ChatImageDiagnostic = {
  status: ImageSearchStatus;
  searches: {
    query: string;
    candidates: number;
    inspected: number;
    selected: string | null;
    reason: string;
  }[];
  stage?: "search" | "download" | "review" | "storage" | "persist";
  errorType?: string;
  durationMs?: number;
};

export function searchWikimediaImagesTool(options: {
  runId: string;
  userAgent: string;
  request: string;
  diagnostic: ChatImageDiagnostic;
  log(diagnostic: ChatImageDiagnostic): void;
  signal: AbortSignal;
  storage: S3StorageService;
  budget: ChatExecutionBudget;
  images: ChatImage[];
  save(): Promise<void>;
}) {
  let called = false;
  return tool(
    async ({ query, fallbackQuery, purpose }) => {
      if (called) return { status: "LIMIT_REACHED", images: [] };
      called = true; // Also fences concurrent calls by the model.
      const started = performance.now();
      const diagnostic = options.diagnostic;
      diagnostic.status = "UNAVAILABLE";
      const signal = AbortSignal.any([options.signal, AbortSignal.timeout(30_000)]);
      try {
        const seen = new Set<string>();
        const queries = [...new Set([query, fallbackQuery].map(normalizeCommonsQuery))].filter(
          Boolean,
        );
        for (const search of queries.slice(0, 2)) {
          if (!options.budget.canInspectImage()) break;
          signal.throwIfAborted();
          diagnostic.stage = "search";
          const { candidates } = await searchCommons(search, signal, options.userAgent);
          const attempt = {
            query: search,
            candidates: candidates.length,
            inspected: 0,
            selected: null as string | null,
            reason: "no_eligible_candidates",
          };
          diagnostic.searches.push(attempt);
          const inspected: InspectedChatImage[] = [];
          diagnostic.stage = "download";
          for (const candidate of candidates) {
            if (seen.has(candidate.fileTitle)) continue;
            seen.add(candidate.fileTitle);
            try {
              inspected.push({
                candidate,
                bytes: await downloadThumbnail(candidate, signal, options.userAgent),
              });
            } catch {
              signal.throwIfAborted();
            }
            if (inspected.length === 3) break;
          }
          attempt.inspected = inspected.length;
          if (!inspected.length) {
            if (candidates.length) attempt.reason = "no_new_readable_candidates";
            diagnostic.status = "NO_MATCH";
            continue;
          }
          diagnostic.stage = "review";
          const selection = await reviewChatImages(
            options.budget,
            options.request,
            purpose,
            inspected,
            signal,
          );
          attempt.reason = selection.reason;
          const selected =
            selection.matchesPurpose && selection.index !== null
              ? inspected[selection.index]
              : undefined;
          if (!selected) {
            diagnostic.status = "NO_MATCH";
            continue; // Try the distinct fallback query after visual rejection too.
          }
          const image = chatImageSchema.parse({
            ...selected.candidate,
            id: randomUUID(),
            caption: selection.caption,
            alt: selection.alt,
          });
          diagnostic.stage = "storage";
          await options.storage.put({
            key: chatImageKey(options.runId, image.id),
            body: selected.bytes,
            contentType: selected.candidate.mime,
            signal,
          });
          signal.throwIfAborted();
          diagnostic.stage = "persist";
          options.images.push(image);
          await options.save(); // Register durably before the agent can reference the ID.
          attempt.selected = image.fileTitle;
          diagnostic.status = "FOUND";
          return {
            status: "FOUND",
            images: [{ id: image.id, caption: image.caption, alt: image.alt }],
            instruction:
              "Insert this verified image near the relevant explanation using ![alt](chat-image-ID), replacing ID with the exact returned id. Do not invent image URLs or details beyond the caption.",
          };
        }
        return {
          status: diagnostic.status,
          images: [],
          instruction: textOnlyInstruction,
        };
      } catch (error) {
        diagnostic.status = options.signal.aborted ? "CANCELLED" : "UNAVAILABLE";
        diagnostic.errorType = error instanceof Error ? error.name : "UnknownError";
        options.signal.throwIfAborted();
        return {
          status: "UNAVAILABLE",
          images: [],
          instruction: textOnlyInstruction,
        };
      } finally {
        diagnostic.durationMs = Math.round(performance.now() - started);
        options.log(diagnostic);
      }
    },
    {
      name: "search_wikimedia_images",
      description:
        "Find and visually verify one Wikimedia Commons image to clarify an educational explanation. Use proactively for explanations of physical/biological processes, structures, spatial relationships and object identification, even without an explicit image request. For photosynthesis request a process diagram, not a leaf photo. Skip decorative images, greetings, simple arithmetic and requests for brief/text-only answers. At most once per response. Returns NO_MATCH when no suitable image exists.",
      schema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe(
            "Use concise English search terms regardless of user language. For processes include diagram or schematic; for photosynthesis use photosynthesis diagram. No site: operators.",
          ),
        fallbackQuery: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe(
            "A distinct English alternative preserving the teaching purpose, e.g. photosynthesis schematic. Never broaden a process diagram into a photo of a related object.",
          ),
        purpose: z
          .string()
          .trim()
          .min(1)
          .max(1000)
          .describe(
            "Specify the visual relationship that must be visible, learner level and user language. For processes require stages or inputs/outputs; for structure require visible parts. Preserve the original request.",
          ),
      }),
    },
  );
}
