import { execFile } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { LessonSpeechBlock, LessonSpeechTimeline } from "@ngertiin/shared";

const run = promisify(execFile);
const SAMPLE_RATE = 24_000;

export async function assembleSpeech(
  blocks: LessonSpeechBlock[],
  segments: Uint8Array[],
): Promise<{
  bytes: Uint8Array;
  timeline: LessonSpeechTimeline;
}> {
  const directory = await mkdtemp(join(tmpdir(), "lesson-speech-"));
  const combined = join(directory, "combined.pcm");
  const timeline: LessonSpeechTimeline = [];
  let samples = 0;
  try {
    for (const [index, block] of blocks.entries()) {
      const input = join(directory, `${index}.mp3`);
      const pcm = join(directory, `${index}.pcm`);
      await writeFile(input, segments[index]);
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        input,
        "-f",
        "s16le",
        "-acodec",
        "pcm_s16le",
        "-ar",
        String(SAMPLE_RATE),
        "-ac",
        "1",
        pcm,
      ]);
      const size = (await stat(pcm)).size;
      if (size === 0 || size % 2 !== 0) throw new Error("speech_invalid_pcm");
      const start = samples / SAMPLE_RATE;
      samples += size / 2;
      timeline.push({ id: block.id, text: block.text, start, end: samples / SAMPLE_RATE });
      await appendFile(combined, await readFile(pcm));
    }
    const output = join(directory, "lesson.mp3");
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "s16le",
      "-ar",
      String(SAMPLE_RATE),
      "-ac",
      "1",
      "-i",
      combined,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      output,
    ]);
    return { bytes: new Uint8Array(await readFile(output)), timeline };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
