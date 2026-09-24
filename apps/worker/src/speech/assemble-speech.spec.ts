import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleSpeech } from "./assemble-speech.js";

test("assembled MP3 preserves block order and real durations", async () => {
  const directory = mkdtempSync(join(tmpdir(), "speech-test-"));
  try {
    const segments = [0.2, 0.3].map((duration, index) => {
      const path = join(directory, `${index}.mp3`);
      execFileSync("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=${index ? 880 : 440}:duration=${duration}`,
        "-ar",
        "24000",
        "-ac",
        "1",
        "-y",
        path,
      ]);
      return new Uint8Array(readFileSync(path));
    });
    const { bytes, timeline } = await assembleSpeech(
      [
        { id: "0", text: "Satu" },
        { id: "1", text: "Dua" },
      ],
      segments,
    );
    expect(timeline[0].start).toBe(0);
    expect(timeline[0].end).toBeCloseTo(0.2, 1);
    expect(timeline[1].start).toBe(timeline[0].end);
    expect(timeline[1].end).toBeCloseTo(0.5, 1);
    const output = join(directory, "joined.mp3");
    writeFileSync(output, bytes);
    const duration = Number(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          output,
        ],
        { encoding: "utf8" },
      ).trim(),
    );
    expect(duration).toBeCloseTo(timeline[1].end, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
