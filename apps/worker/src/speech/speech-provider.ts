export async function synthesizeFishAudio(
  apiKey: string,
  input: { text: string; model: string; voice: string },
): Promise<Uint8Array> {
  const response = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      model: input.model,
    },
    body: JSON.stringify({ text: input.text, reference_id: input.voice, format: "mp3" }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`fish_audio_http_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 30 * 1024 * 1024) throw new Error("fish_audio_invalid_size");
  if (
    !(bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) &&
    !(bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
  )
    throw new Error("fish_audio_invalid_mp3");
  return bytes;
}
