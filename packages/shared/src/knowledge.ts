import { createHash } from "node:crypto";
import { z } from "zod";

export const KNOWLEDGE_NORMALIZER = "chat-material-v1";
export const MATERIAL_EXCERPT_PADDING = 400;
export function normalizeMaterial(text: string): string {
  return text.replace(/\r\n?/g, "\n").normalize("NFC");
}
export function materialRevision(text: string): string {
  return createHash("sha256")
    .update(`${KNOWLEDGE_NORMALIZER}\n${normalizeMaterial(text)}`)
    .digest("hex");
}
/** An allowlist shared by citation hydration and indexing; never serialize raw content. */
export function learningMaterialText(type: string, raw: unknown): string {
  if (type === "flashcard") {
    const content = z
      .object({ cards: z.array(z.object({ front: z.string(), back: z.string() })) })
      .parse(raw);
    return content.cards.map((card) => `${card.front}\n${card.back}`).join("\n\n");
  }
  if (type !== "lesson") throw new Error("KNOWLEDGE_MATERIAL_FORBIDDEN");
  const content = z
    .union([
      z.object({ format: z.literal("markdown"), title: z.string(), body: z.string() }),
      z.object({
        introduction: z.string().optional(),
        explanation: z.string(),
        keyPoints: z.array(z.string()),
        examples: z.array(z.string()).optional(),
        summary: z.string().optional(),
      }),
    ])
    .parse(raw);
  return "body" in content
    ? `${content.title}\n\n${content.body}`
    : [
        content.introduction,
        content.explanation,
        ...content.keyPoints,
        ...(content.examples ?? []),
        content.summary,
      ]
        .filter(Boolean)
        .join("\n\n");
}
/** UTF-8 bytes provide a conservative token upper bound; offsets remain Unicode code points. */
export type MaterialChunk = {
  text: string;
  startCodePoint: number;
  endCodePoint: number;
};

export function chunkMaterial(
  text: string,
  tokens: number,
  overlapTokens: number,
): MaterialChunk[] {
  const points = [...text];
  const chunks: MaterialChunk[] = [];
  let start = 0;
  while (start < points.length) {
    let end = start,
      bytes = 0,
      paragraphEnd = 0;
    while (end < points.length) {
      const size = Buffer.byteLength(points[end] ?? "");
      if (bytes + size > tokens) break;
      bytes += size;
      end++;
      if (points[end - 1] === "\n" && points[end - 2] === "\n") paragraphEnd = end;
    }
    if (end < points.length && paragraphEnd > start + Math.floor((end - start) / 2))
      end = paragraphEnd;
    if (end <= start) throw new Error("KNOWLEDGE_CHUNK_BUDGET");
    const body = points.slice(start, end).join("");
    if (body.trim()) chunks.push({ text: body, startCodePoint: start, endCodePoint: end });
    if (end === points.length) break;
    let next = end,
      overlap = 0;
    while (
      next > start + 1 &&
      overlap + Buffer.byteLength(points[next - 1] ?? "") <= overlapTokens
    ) {
      overlap += Buffer.byteLength(points[--next] ?? "");
    }
    start = Math.max(start + 1, next);
  }
  return chunks;
}
export function validateEmbeddings(
  vectors: number[][],
  count: number,
  dimensions: number,
): number[][] {
  if (
    vectors.length !== count ||
    vectors.some(
      (vector) =>
        vector.length !== dimensions ||
        vector.some((n) => !Number.isFinite(n)) ||
        !vector.some((n) => n !== 0),
    )
  )
    throw new Error("KNOWLEDGE_EMBEDDING_INVALID");
  return vectors;
}
