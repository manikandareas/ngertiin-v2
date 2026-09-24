import { createHash } from "node:crypto";
import { marked, type Token } from "marked";
import { learningMaterialText } from "./knowledge.js";

const SCRIPT_VERSION = "lesson-speech-v2";

export type LessonSpeechBlock = { id: string; text: string };
export type LessonSpeechTimeline = Array<LessonSpeechBlock & { start: number; end: number }>;

function normalize(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

function spokenTokens(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if (token.type === "image" || token.type === "code" || token.type === "html") return "";
      if (token.type === "br") return " ";
      if ("tokens" in token && Array.isArray(token.tokens)) return spokenTokens(token.tokens);
      if (token.type === "text" || token.type === "escape" || token.type === "codespan")
        return token.text;
      return "";
    })
    .filter(Boolean)
    .join("");
}

export function lessonSpeechBlocks(content: unknown): LessonSpeechBlock[] {
  learningMaterialText("lesson", content);
  const parts: string[] = [];
  if (typeof content === "object" && content !== null && "format" in content) {
    const { title, body } = content as { format: string; title: string; body: string };
    parts.push(title);
    const tokens = marked.lexer(body);
    function collect(items: Token[]): void {
      for (const token of items) {
        if (token.type === "list") {
          for (const item of token.items) collect(item.tokens ?? []);
        } else if (token.type === "blockquote") {
          collect(token.tokens ?? []);
        } else if (token.type === "table") {
          parts.push(...token.header.map((cell: { tokens: Token[] }) => spokenTokens(cell.tokens)));
          for (const row of token.rows)
            parts.push(...row.map((cell: { tokens: Token[] }) => spokenTokens(cell.tokens)));
        } else if (
          token.type === "heading" ||
          token.type === "paragraph" ||
          token.type === "text"
        ) {
          parts.push(
            "tokens" in token && Array.isArray(token.tokens)
              ? spokenTokens(token.tokens)
              : token.text,
          );
        }
      }
    }
    collect(tokens);
  } else {
    const lesson = content as {
      introduction?: string;
      explanation: string;
      keyPoints: string[];
      examples?: string[];
      summary?: string;
    };
    parts.push(
      ...(lesson.introduction ?? "").split(/\n\s*\n/),
      ...lesson.explanation.split(/\n\s*\n/),
      ...lesson.keyPoints,
      ...(lesson.examples ?? []),
      ...(lesson.summary ?? "").split(/\n\s*\n/),
    );
  }
  return parts
    .map(normalize)
    .filter(Boolean)
    .map((part, index) => ({ id: String(index), text: part }));
}

export function speechFingerprint(
  blocks: LessonSpeechBlock[],
  provider: string,
  model: string,
  voice: string,
): string {
  return createHash("sha256")
    .update(JSON.stringify([SCRIPT_VERSION, blocks, provider, model, voice, "mp3"]))
    .digest("hex");
}
