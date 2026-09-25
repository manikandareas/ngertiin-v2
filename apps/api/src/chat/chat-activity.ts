import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { type ChatActivity, type ChatRunStatus, isChatRunActive } from "@ngertiin/contracts/api";

const toolLabels: Record<string, string> = {
  read_excerpt: "Membaca kutipan pilihanmu",
  read_progress: "Memeriksa progres belajar",
  search_module_materials: "Mencari materi modul",
  search_wikimedia_images: "Mencari gambar pendukung",
  ask_user: "Menyiapkan pertanyaan untukmu",
  create_practice: "Menyiapkan latihan",
};

export type ToolActivityEvent = {
  id: string;
  name: string;
  status: ChatActivity["status"];
  input?: unknown;
  output?: unknown;
};

type ActivityResult = NonNullable<ChatActivity["results"]>[number];
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const shortText = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
function publicUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol)) return url.href;
  } catch {
    /* Ignore invalid provider links. */
  }
}
function sourceKey(value: string): string {
  const url = new URL(value);
  if (url.searchParams.get("utm_source") === "openai") url.searchParams.delete("utm_source");
  return url.href;
}
function toolOutput(value: unknown): unknown {
  if (Array.isArray(value) && value.every((item) => record(item).type === "text"))
    value = value.map((item) => record(item).text).join("");
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}
function materialResult(value: unknown): ActivityResult | undefined {
  const citation = record(record(value).citation);
  const title = shortText(citation.title, 240);
  if (!title) return;
  return { title, description: shortText(citation.excerpt, 800) };
}
// Deliberately whitelist presentation fields; never persist raw arguments/results or error details.
function toolDetails(event: ToolActivityEvent): Partial<ChatActivity> {
  const input = record(event.input);
  const raw = toolOutput(event.output);
  const output = record(raw);
  const details: Partial<ChatActivity> = {};
  if (["search_module_materials", "search_wikimedia_images"].includes(event.name))
    details.query = shortText(input.query, 500);
  if (output.error || output.status === "UNAVAILABLE")
    return {
      ...details,
      status: "failed",
      text: "Hasil belum tersedia. Timo dapat melanjutkan dengan konteks lain.",
    };
  if (event.status !== "completed") return details;
  if (event.name === "read_excerpt") {
    const result = materialResult(raw);
    if (result) {
      details.results = [result];
      details.query = result.title;
    }
  } else if (event.name === "search_module_materials" && Array.isArray(output.snapshots)) {
    details.results = output.snapshots
      .flatMap((item) => {
        const result = materialResult(item);
        return result ? [result] : [];
      })
      .slice(0, 8);
    if (!details.results.length)
      details.text =
        output.status === "INDEX_NOT_READY"
          ? "Materi masih disiapkan untuk pencarian."
          : "Tidak ditemukan materi yang cocok.";
  } else if (event.name === "read_progress" && Array.isArray(raw)) {
    const progress = raw.map((item) => record(record(item).progress));
    const valid = progress.filter(
      (item) => typeof item.completedNodes === "number" && typeof item.totalNodes === "number",
    );
    if (valid.length)
      details.text = `${valid.reduce((sum, item) => sum + Number(item.completedNodes), 0)} dari ${valid.reduce((sum, item) => sum + Number(item.totalNodes), 0)} bagian belajar selesai.`;
  } else if (event.name === "search_wikimedia_images" && Array.isArray(output.images)) {
    details.results = output.images
      .flatMap((item) => {
        const img = record(item);
        const title = shortText(img.caption ?? img.alt, 240);
        return title ? [{ title }] : [];
      })
      .slice(0, 8);
    if (!details.results.length) details.text = "Tidak ada gambar pendukung yang dipilih.";
  } else if (event.name === "ask_user") {
    details.text = "Jawaban pengguna sudah diterima.";
  } else if (event.name === "create_practice" && typeof output.practiceId === "string") {
    details.text = "Latihan telah dibuat. Lihat kartu latihan di percakapan.";
  }
  return details;
}

export class ChatActivities {
  private readonly items = new Map<string, ChatActivity>();
  private messageId = crypto.randomUUID() as string;
  private readonly sourceTitles = new Map<string, string>();

  constructor(previous: ChatActivity[] = []) {
    for (const item of previous) this.items.set(item.id, { ...item });
  }

  tool(event: ToolActivityEvent): boolean {
    return this.update(
      `tool:${event.id}`,
      "tool",
      toolLabels[event.name] ?? "Menjalankan alat bantu",
      event.status,
      toolDetails(event),
    );
  }

  search(event: ChatModelStreamEvent): boolean {
    // LangChain converts OpenAI public summary deltas into reasoning content blocks.
    if (event.event === "message-start") {
      this.messageId = event.id ?? crypto.randomUUID();
      return false;
    }
    if (event.event === "content-block-delta" && event.delta.type === "reasoning-delta") {
      const id = `reasoning:${this.messageId}:${event.index}`;
      const text = ((this.items.get(id)?.text ?? "") + event.delta.reasoning).slice(0, 12000);
      return this.update(id, "reasoning", "Memahami pertanyaan", "running", { text });
    }
    if (event.event === "content-block-finish" && event.content.type === "reasoning") {
      const id = `reasoning:${this.messageId}:${event.index}`;
      const text = shortText(event.content.reasoning, 12000);
      return text
        ? this.update(id, "reasoning", "Memahami pertanyaan", "completed", { text })
        : false;
    }
    if (event.event !== "provider" || event.provider !== "openai") return false;
    const payload = record(event.payload);
    if (event.name === "response.content_part.done") {
      const annotations = record(payload.part).annotations;
      let changed = false;
      for (const annotation of Array.isArray(annotations) ? annotations : []) {
        changed =
          this.search({
            ...event,
            name: "response.output_text.annotation.added",
            payload: { annotation },
          }) || changed;
      }
      return changed;
    }
    if (event.name === "response.output_text.annotation.added") {
      const annotation = record(payload.annotation);
      const url = publicUrl(annotation.url);
      const title = shortText(annotation.title, 240);
      if (annotation.type !== "url_citation" || !url || !title) return false;
      this.sourceTitles.set(sourceKey(url), title);
      let changed = false;
      for (const item of this.items.values()) {
        if (
          item.kind !== "search" ||
          !item.results?.some((result) => result.url && sourceKey(result.url) === sourceKey(url))
        )
          continue;
        changed =
          this.update(item.id, item.kind, item.label, item.status, {
            results: item.results.map((result) =>
              result.url && sourceKey(result.url) === sourceKey(url)
                ? { ...result, title }
                : result,
            ),
          }) || changed;
      }
      return changed;
    }
    if (event.name === "response.output_item.added" || event.name === "response.output_item.done") {
      const item = record(payload.item);
      if (item.type !== "web_search_call" || typeof item.id !== "string") return false;
      const action = record(item.action);
      const results: ActivityResult[] = Array.isArray(action.sources)
        ? action.sources
            .flatMap((source) => {
              const row = record(source);
              const url = publicUrl(row.url);
              return url
                ? [
                    {
                      title:
                        this.sourceTitles.get(sourceKey(url)) ??
                        shortText(row.title, 240) ??
                        new URL(url).hostname,
                      url,
                    },
                  ]
                : [];
            })
            .filter((row, i, rows) => rows.findIndex((other) => other.url === row.url) === i)
            .slice(0, 8)
        : [];
      const details: Partial<ChatActivity> = {};
      const query =
        (Array.isArray(action.queries)
          ? shortText(action.queries.filter((q) => typeof q === "string").join(" · "), 500)
          : undefined) ??
        shortText(action.query, 500) ??
        shortText(action.pattern, 500) ??
        shortText(action.url, 500);
      if (query) details.query = query;
      const pageUrl = publicUrl(action.url);
      if (pageUrl && ["open_page", "find_in_page"].includes(String(action.type))) {
        results.push({
          title: this.sourceTitles.get(sourceKey(pageUrl)) ?? new URL(pageUrl).hostname,
          url: pageUrl,
        });
      }
      if (results.length || Array.isArray(action.sources)) details.results = results;
      const previous = this.items.get(`search:${item.id}`);
      const status =
        item.status === "failed"
          ? "failed"
          : event.name.endsWith(".done")
            ? "completed"
            : "running";
      return this.update(
        `search:${item.id}`,
        "search",
        action.type === "open_page"
          ? "Membaca halaman web"
          : action.type === "find_in_page"
            ? "Mencari dalam halaman"
            : "Mencari di web",
        status === "running" && previous?.finishedAt ? previous.status : status,
        details,
      );
    }
    if (!event.name.startsWith("response.web_search_call.") || typeof payload.item_id !== "string")
      return false;
    const status = event.name.endsWith(".completed")
      ? "completed"
      : event.name.endsWith(".failed")
        ? "failed"
        : "running";
    const previous = this.items.get(`search:${payload.item_id}`);
    return this.update(
      `search:${payload.item_id}`,
      "search",
      previous?.label ?? "Mencari di web",
      previous?.finishedAt ? previous.status : status,
    );
  }

  private update(
    id: string,
    kind: ChatActivity["kind"],
    label: string,
    status: ChatActivity["status"],
    details: Partial<ChatActivity> = {},
  ): boolean {
    const previous = this.items.get(id);
    const now = new Date().toISOString();
    const next: ChatActivity = {
      ...previous,
      id,
      kind,
      label,
      status,
      startedAt: previous?.startedAt ?? now,
      finishedAt:
        status === "running" || status === "waiting" ? null : (previous?.finishedAt ?? now),
      ...Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined)),
    };
    if (JSON.stringify(previous) === JSON.stringify(next)) return false;
    this.items.set(id, next);
    return true;
  }

  values(): ChatActivity[] {
    return structuredClone([...this.items.values()]);
  }
}

export function settleChatActivities(items: ChatActivity[], status: ChatRunStatus): ChatActivity[] {
  if (isChatRunActive(status)) return items;
  return items.map((item) => {
    if (item.status !== "running" && item.status !== "waiting") return item;
    return {
      ...item,
      // A terminal run is not proof that an unfinished tool succeeded.
      status:
        status === "waiting_for_input"
          ? "waiting"
          : status === "cancelled"
            ? "cancelled"
            : "failed",
      finishedAt:
        status === "waiting_for_input" ? null : (item.finishedAt ?? new Date().toISOString()),
    };
  });
}
