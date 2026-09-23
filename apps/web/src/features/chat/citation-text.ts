import type { ChatCitation } from "@ngertiin/contracts/api";

/** Add presentation markers without changing the append-only answer in storage.
 * Only a provider citation token/link is replaced; cited prose is always kept.
 */
export function citationText(text: string, citations: ChatCitation[]): string {
  const edits = new Map<string, { start: number; end: number; ids: Set<string> }>();
  for (const citation of citations) {
    if (citation.origin !== "web") continue;
    for (const range of citation.occurrences) {
      if (range.start > range.end || range.end > text.length) continue;
      const span = text.slice(range.start, range.end);
      const isMarker =
        /^\s*cite[^]*\s*$/.test(span) ||
        (/^\s*\(?\[[^\]]+\]\(https?:\/\/[^\s]+\)\)?\s*$/.test(span) && span.includes(citation.url));
      const start = isMarker ? range.start : range.end;
      const key = `${start}:${range.end}`;
      const edit = edits.get(key) ?? { start, end: range.end, ids: new Set<string>() };
      edit.ids.add(citation.id);
      edits.set(key, edit);
    }
  }
  let result = "";
  let cursor = 0;
  for (const edit of [...edits.values()].sort((a, b) => a.start - b.start || a.end - b.end)) {
    if (edit.start < cursor) continue;
    result += text.slice(cursor, edit.start);
    result += [...edit.ids].map((id) => `[[cite:${id}]]`).join("");
    cursor = edit.end;
  }
  return result + text.slice(cursor);
}
