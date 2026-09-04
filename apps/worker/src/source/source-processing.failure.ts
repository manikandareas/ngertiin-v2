import type { SourceFailure, SourceFailureCode } from "@ngertiin/contracts/api";
import { OcrError } from "../ocr/ocr.service.js";
import { ScraperError } from "../scraper/scraper.service.js";

const messages: Record<SourceFailureCode, string> = {
  SOURCE_TEXT_NOT_EXTRACTABLE: "No extractable text was found in this Source.",
  SOURCE_INVALID_PDF: "The uploaded file could not be processed as a valid PDF.",
  SOURCE_UNSUPPORTED_MEDIA_TYPE: "This Source uses an unsupported URL or content type.",
  SOURCE_PROCESSING_FAILED: "Source processing could not be completed.",
};

export class SourceProcessingFailure extends Error {
  constructor(
    readonly code: SourceFailureCode,
    readonly retryable: boolean,
    cause?: unknown,
  ) {
    super(messages[code], { cause });
    this.name = "SourceProcessingFailure";
  }

  toPublicFailure(): SourceFailure {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

export function mapSourceProcessingFailure(error: unknown): SourceProcessingFailure {
  if (error instanceof SourceProcessingFailure) return error;
  if (error instanceof OcrError) {
    if (error.category === "invalid_pdf") {
      return new SourceProcessingFailure("SOURCE_INVALID_PDF", false, error);
    }
    return new SourceProcessingFailure(
      "SOURCE_PROCESSING_FAILED",
      error.category === "provider_unavailable",
      error,
    );
  }
  if (error instanceof ScraperError) {
    if (error.category === "unsupported_media_type") {
      return new SourceProcessingFailure("SOURCE_UNSUPPORTED_MEDIA_TYPE", false, error);
    }
    return new SourceProcessingFailure(
      "SOURCE_PROCESSING_FAILED",
      error.category === "provider_unavailable",
      error,
    );
  }
  return new SourceProcessingFailure("SOURCE_PROCESSING_FAILED", true, error);
}
