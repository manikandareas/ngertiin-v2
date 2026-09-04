import { Inject, Injectable } from "@nestjs/common";
import type Firecrawl from "firecrawl";

export const SCRAPER_CLIENT = Symbol("SCRAPER_CLIENT");

export type ScraperErrorCategory =
  | "unsupported_media_type"
  | "provider_unavailable"
  | "unexpected_scrape_call";

const errorMessages: Record<ScraperErrorCategory, string> = {
  unsupported_media_type: "The URL or its content type is not supported.",
  provider_unavailable: "The scraper provider is temporarily unavailable.",
  unexpected_scrape_call: "The scrape call failed unexpectedly.",
};

export class ScraperError extends Error {
  constructor(
    readonly category: ScraperErrorCategory,
    cause?: unknown,
  ) {
    super(errorMessages[category], { cause });
    this.name = "ScraperError";
  }
}

type ScraperClient = Pick<Firecrawl, "scrape">;
type ErrorRecord = Record<string, unknown>;

function asRecord(value: unknown): ErrorRecord | undefined {
  return typeof value === "object" && value !== null ? (value as ErrorRecord) : undefined;
}

function errorStatus(error: unknown): number | undefined {
  const record = asRecord(error);
  const value = record?.status ?? record?.statusCode ?? asRecord(record?.response)?.status;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function classifyError(error: unknown): ScraperErrorCategory {
  const status = errorStatus(error);
  const code = asRecord(error)?.code;
  if (status === 400 || status === 404 || status === 415 || status === 422) {
    return "unsupported_media_type";
  }
  if (
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500) ||
    error instanceof DOMException ||
    (typeof code === "string" &&
      [
        "ECONNABORTED",
        "ECONNREFUSED",
        "ECONNRESET",
        "EAI_AGAIN",
        "ENOTFOUND",
        "ERR_NETWORK",
        "ETIMEDOUT",
        "SCRAPE_TIMEOUT",
      ].includes(code)) ||
    ["AbortError", "AxiosError", "JobTimeoutError"].includes(
      error instanceof Error ? error.name : "",
    )
  ) {
    return "provider_unavailable";
  }
  return "unexpected_scrape_call";
}

@Injectable()
export class ScraperService {
  constructor(@Inject(SCRAPER_CLIENT) private readonly client: ScraperClient) {}

  async scrapeMainContent(url: string): Promise<{ markdown: string }> {
    const startedAt = performance.now();
    try {
      const document = await this.client.scrape(url, {
        formats: ["markdown"],
        onlyMainContent: true,
        removeBase64Images: true,
        timeout: 30_000,
        autoResume: false,
      });
      const contentType = document.metadata?.contentType?.split(";", 1)[0]?.trim().toLowerCase();
      if (contentType && contentType !== "text/html" && contentType !== "application/xhtml+xml") {
        throw new ScraperError("unsupported_media_type");
      }
      console.log(
        JSON.stringify({
          level: "log",
          event: "scraper.provider_call",
          provider: "firecrawl",
          model: null,
          latencyMs: Math.round(performance.now() - startedAt),
        }),
      );
      return { markdown: document.markdown?.trim() ?? "" };
    } catch (error) {
      const failure =
        error instanceof ScraperError ? error : new ScraperError(classifyError(error), error);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error(
        JSON.stringify({
          level: "error",
          event: "scraper.provider_call_failed",
          provider: "firecrawl",
          model: null,
          category: failure.category,
          status: errorStatus(error),
          errorType: /^[A-Za-z0-9_.:-]{1,100}$/.test(errorName) ? errorName : "Error",
          latencyMs: Math.round(performance.now() - startedAt),
        }),
      );
      throw failure;
    }
  }
}
