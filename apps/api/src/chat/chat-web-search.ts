import { randomUUID } from "node:crypto";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import {
  type ChatWebCitation,
  type ChatWebSearchState,
  chatWebCitationSchema,
} from "@ngertiin/contracts/api";
import { z } from "zod";

const annotationSchema = z.object({
  type: z.literal("url_citation"),
  url: chatWebCitationSchema.shape.url,
  title: z.string(),
  start_index: z.number().int().nonnegative(),
  end_index: z.number().int().nonnegative(),
});
const partEventSchema = z.object({
  output_index: z.number(),
  content_index: z.number(),
  part: z.object({
    type: z.literal("output_text"),
    text: z.string(),
    annotations: z.array(z.unknown()).optional(),
  }),
});
const annotationEventSchema = z.object({
  output_index: z.number(),
  content_index: z.number(),
  annotation: z.unknown(),
});
const searchEventSchema = z.object({ item_id: z.string() });

/** Captures native annotations with every occurrence, deduplicating only sources.
 * Only public text offsets and source metadata leave this per-run collector.
 */
export class ChatWebSearch {
  private text = "";
  private readonly blocks = new Map<string, number>();
  private readonly sources = new Map<string, ChatWebCitation>();
  private readonly searches = new Set<string>();
  private readonly active = new Set<string>();
  state: ChatWebSearchState = { status: "not_requested", searches: 0 };

  handle(event: ChatModelStreamEvent): boolean {
    if (event.event === "message-start") this.blocks.clear();
    if (event.event === "content-block-delta" && event.delta.type === "text-delta") {
      this.text += event.delta.text;
    }
    if (event.event !== "provider" || event.provider !== "openai") return false;
    if (event.name.startsWith("response.web_search_call.")) {
      const parsed = searchEventSchema.safeParse(event.payload);
      if (!parsed.success) return false;
      const id = parsed.data.item_id;
      this.searches.add(id);
      if (event.name.endsWith(".completed") || event.name.endsWith(".failed"))
        this.active.delete(id);
      else this.active.add(id);
      let status: ChatWebSearchState["status"] = "completed";
      if (this.active.size) status = "searching";
      else if (event.name.endsWith(".failed")) status = "failed";
      const next: ChatWebSearchState = { status, searches: this.searches.size };
      const changed = next.status !== this.state.status || next.searches !== this.state.searches;
      this.state = next;
      return changed;
    }
    if (
      event.name === "response.content_part.added" ||
      event.name === "response.content_part.done"
    ) {
      const parsed = partEventSchema.safeParse(event.payload);
      if (!parsed.success) return false;
      const { output_index, content_index, part } = parsed.data;
      const key = `${output_index}:${content_index}`;
      if (event.name.endsWith(".added")) {
        this.blocks.set(key, this.text.length);
        return false;
      }
      let changed = false;
      for (const annotation of part.annotations ?? []) {
        changed = this.add(annotation, this.blocks.get(key), part.text) || changed;
      }
      return changed;
    }
    if (event.name === "response.output_text.annotation.added") {
      const parsed = annotationEventSchema.safeParse(event.payload);
      if (!parsed.success) return false;
      const { output_index, content_index, annotation } = parsed.data;
      const offset = this.blocks.get(`${output_index}:${content_index}`);
      return this.add(annotation, offset, offset === undefined ? "" : this.text.slice(offset));
    }
    return false;
  }

  private add(raw: unknown, offset: number | undefined, blockText: string): boolean {
    const parsed = annotationSchema.safeParse(raw);
    if (!parsed.success) return false;
    const annotation = parsed.data;
    let source = this.sources.get(annotation.url);
    let changed = false;
    if (!source) {
      source = {
        id: randomUUID(),
        origin: "web",
        title: annotation.title || new URL(annotation.url).hostname,
        url: annotation.url,
        occurrences: [],
      };
      this.sources.set(annotation.url, source);
      changed = true;
    }
    // OpenAI character offsets are converted once to JavaScript's UTF-16 offsets.
    const points = [...blockText];
    if (
      offset !== undefined &&
      annotation.start_index <= annotation.end_index &&
      annotation.end_index <= points.length
    ) {
      const start = offset + points.slice(0, annotation.start_index).join("").length;
      const end = offset + points.slice(0, annotation.end_index).join("").length;
      if (!source.occurrences.some((range) => range.start === start && range.end === end)) {
        source.occurrences.push({ start, end });
        changed = true;
      }
    }
    return changed;
  }

  values(publicText: string): ChatWebCitation[] {
    return [...this.sources.values()].map((source) => ({
      ...source,
      occurrences: source.occurrences.filter(
        (range) =>
          range.end <= publicText.length && publicText.startsWith(this.text.slice(0, range.end)),
      ),
    }));
  }
}
