import { describe, expect, test } from "bun:test";
import { lessonSpeechBlocks, speechFingerprint } from "./speech.js";

describe("lesson speech blocks", () => {
  test("keeps rendered Markdown blocks in reading order", () => {
    const blocks = lessonSpeechBlocks({
      format: "markdown",
      title: "Judul",
      body: "Paragraf **penting**.\n\n## Bagian\n\n- Poin satu\n  - Poin turunan\n- Poin dua\n\n![gambar](url)\n\nParagraf akhir.",
    });
    expect(blocks).toEqual([
      { id: "0", text: "Judul" },
      { id: "1", text: "Paragraf penting." },
      { id: "2", text: "Bagian" },
      { id: "3", text: "Poin satu" },
      { id: "4", text: "Poin turunan" },
      { id: "5", text: "Poin dua" },
      { id: "6", text: "Paragraf akhir." },
    ]);
  });

  test("keeps structured lesson sections distinct", () => {
    const blocks = lessonSpeechBlocks({
      introduction: "Pembuka",
      explanation: "Penjelasan awal\n\nPenjelasan lanjut",
      keyPoints: ["Pertama", "Kedua"],
      examples: ["Contoh"],
      summary: "Ringkasan",
    });
    expect(blocks.map((block) => block.text)).toEqual([
      "Pembuka",
      "Penjelasan awal",
      "Penjelasan lanjut",
      "Pertama",
      "Kedua",
      "Contoh",
      "Ringkasan",
    ]);
    expect(speechFingerprint(blocks, "fish-audio", "model", "voice")).not.toBe(
      speechFingerprint(
        [{ id: "0", text: blocks.map((block) => block.text).join(" ") }],
        "fish-audio",
        "model",
        "voice",
      ),
    );
  });
});
