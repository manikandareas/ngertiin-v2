import type { Mistral } from "@mistralai/mistralai";

/** Extraction only: callers own persistence, authorization and run lifecycle. */
export async function processOcr(
  client: Pick<Mistral, "ocr">,
  input: {
    model: string;
    binary: Uint8Array;
    mimeType: string;
    signal?: AbortSignal;
  },
) {
  input.signal?.throwIfAborted();
  const url = `data:${input.mimeType};base64,${Buffer.from(input.binary).toString("base64")}`;
  const result = await client.ocr.process(
    {
      model: input.model,
      document: input.mimeType.startsWith("image/")
        ? { type: "image_url", imageUrl: url }
        : { type: "document_url", documentUrl: url },
      includeImageBase64: false,
    },
    input.signal ? { signal: input.signal, retries: { strategy: "none" } } : undefined,
  );
  input.signal?.throwIfAborted();
  return result;
}
