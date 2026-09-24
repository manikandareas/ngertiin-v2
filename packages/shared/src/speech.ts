import { createHash } from "node:crypto";
import { marked, type Token } from "marked";
import { learningMaterialText } from "./knowledge.js";

const SCRIPT_VERSION = "lesson-speech-v1";

function spokenTokens(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if (token.type === "image" || token.type === "code" || token.type === "html") return "";
      if ("tokens" in token && Array.isArray(token.tokens)) return spokenTokens(token.tokens);
      if (token.type === "list")
        return token.items.map((item: { tokens: Token[] }) => spokenTokens(item.tokens)).join(". ");
      if (token.type === "table")
        return [
          ...token.header.map((cell: { tokens: Token[] }) => spokenTokens(cell.tokens)),
          ...token.rows.flatMap((row: Array<{ tokens: Token[] }>) =>
            row.map((cell) => spokenTokens(cell.tokens)),
          ),
        ].join(". ");
      if (token.type === "text" || token.type === "escape" || token.type === "codespan")
        return token.text;
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

export function lessonSpeechText(content: unknown): string {
  const material = learningMaterialText("lesson", content);
  const markdown =
    typeof content === "object" && content !== null && "format" in content
      ? spokenTokens(marked.lexer(material))
      : material;
  return markdown
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

export function speechFingerprint(
  text: string,
  provider: string,
  model: string,
  voice: string,
): string {
  return createHash("sha256")
    .update(JSON.stringify([SCRIPT_VERSION, text, provider, model, voice, "mp3"]))
    .digest("hex");
}
