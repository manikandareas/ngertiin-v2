import type { Mistral } from "@mistralai/mistralai";
import { Inject, Injectable } from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { processOcr } from "@ngertiin/shared/ocr";
import { WORKER_ENV } from "../config.js";

export const OCR_CLIENT = Symbol("OCR_CLIENT");

export type OcrErrorCategory = "invalid_pdf" | "provider_unavailable" | "unexpected_ocr_call";

const errorMessages: Record<OcrErrorCategory, string> = {
  invalid_pdf: "The PDF was rejected as invalid.",
  provider_unavailable: "The OCR provider is temporarily unavailable.",
  unexpected_ocr_call: "The OCR call failed unexpectedly.",
};

export class OcrError extends Error {
  constructor(
    readonly category: OcrErrorCategory,
    cause?: unknown,
  ) {
    super(errorMessages[category], { cause });
    this.name = "OcrError";
  }
}

export interface ExtractedPdfPage {
  readonly pageNumber: number;
  readonly markdown: string;
}

type OcrClient = Pick<Mistral, "ocr">;
type ErrorRecord = Record<string, unknown>;

function asRecord(value: unknown): ErrorRecord | undefined {
  return typeof value === "object" && value !== null ? (value as ErrorRecord) : undefined;
}

function statusCode(error: unknown): number | undefined {
  const record = asRecord(error);
  const value = record?.statusCode ?? record?.status ?? asRecord(record?.response)?.status;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function classifyError(error: unknown): OcrErrorCategory {
  const status = statusCode(error);
  if (status === 400 || status === 415 || status === 422) return "invalid_pdf";
  if (
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500) ||
    error instanceof DOMException ||
    ["ConnectionError", "RequestAbortedError", "RequestTimeoutError"].includes(
      error instanceof Error ? error.name : "",
    )
  ) {
    return "provider_unavailable";
  }
  return "unexpected_ocr_call";
}

@Injectable()
export class OcrService {
  constructor(
    @Inject(OCR_CLIENT) private readonly client: OcrClient,
    @Inject(WORKER_ENV) private readonly environment: WorkerEnvironment,
  ) {}

  async extractPdf(binary: Uint8Array): Promise<ExtractedPdfPage[]> {
    const startedAt = performance.now();
    try {
      const response = await processOcr(this.client, {
        model: this.environment.MISTRAL_OCR_MODEL,
        binary,
        mimeType: "application/pdf",
      });
      const pages = [...response.pages]
        .sort((left, right) => left.index - right.index)
        .map((page) => ({ pageNumber: page.index + 1, markdown: page.markdown.trim() }));
      const validPages =
        pages.length > 0 &&
        pages.every(
          (page, index) => Number.isInteger(page.pageNumber) && page.pageNumber === index + 1,
        );
      if (!validPages) throw new OcrError("unexpected_ocr_call");

      console.log(
        JSON.stringify({
          level: "log",
          event: "ocr.provider_call",
          provider: "mistral",
          model: this.environment.MISTRAL_OCR_MODEL,
          latencyMs: Math.round(performance.now() - startedAt),
          pageCount: pages.length,
        }),
      );
      return pages;
    } catch (error) {
      const failure = error instanceof OcrError ? error : new OcrError(classifyError(error), error);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error(
        JSON.stringify({
          level: "error",
          event: "ocr.provider_call_failed",
          provider: "mistral",
          model: this.environment.MISTRAL_OCR_MODEL,
          category: failure.category,
          status: statusCode(error),
          errorType: /^[A-Za-z0-9_.:-]{1,100}$/.test(errorName) ? errorName : "Error",
          latencyMs: Math.round(performance.now() - startedAt),
        }),
      );
      throw failure;
    }
  }
}
