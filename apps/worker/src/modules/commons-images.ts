import { z } from "zod";

let retryAfter = 0;
const MAX_BYTES = 5 * 1024 * 1024;
const rasterTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const infoSchema = z.object({
  title: z.string(),
  imageinfo: z
    .array(
      z.object({
        thumburl: z.url(),
        thumbwidth: z.number().int().positive(),
        thumbheight: z.number().int().positive(),
        thumbmime: z.string(),
        mime: z.string(),
        descriptionurl: z.url(),
        extmetadata: z.object({
          Artist: z.object({ value: z.string() }).optional(),
          LicenseShortName: z.object({ value: z.string() }).optional(),
          LicenseUrl: z.object({ value: z.string() }).optional(),
          Restrictions: z.object({ value: z.string() }).optional(),
        }),
      }),
    )
    .optional(),
});
export interface CommonsCandidate {
  fileTitle: string;
  width: number;
  height: number;
  creator: string;
  sourceUrl: string;
  license: string;
  licenseVersion: string;
  licenseUrl: string;
  thumbnail: string;
  mime: string;
}
function plain(value: string): string {
  return value
    .replace(/<\/(?:p|li|div)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
function allowedUrl(value: string, api = false): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(api
      ? url.hostname === "commons.wikimedia.org"
      : ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname))
  ) {
    throw new Error("unsafe_wikimedia_url");
  }
  return url;
}
async function request(
  url: string,
  signal: AbortSignal,
  userAgent: string,
  api = false,
): Promise<Response> {
  if (Date.now() < retryAfter) throw new Error("wikimedia_rate_limited");
  let next = allowedUrl(url, api);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(next, {
      signal,
      redirect: "manual",
      headers: { "User-Agent": userAgent },
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      next = allowedUrl(new URL(response.headers.get("location") ?? "", next).href, api);
      continue;
    }
    if (response.status === 429 || response.status === 503) {
      const value = response.headers.get("retry-after");
      const seconds = value ? Number(value) : Number.NaN;
      retryAfter = Math.max(
        Date.now() + 60_000,
        Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(value ?? "") || 0,
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      // Do not retry inside the lesson budget; respect Retry-After by abandoning enrichment.
      throw new Error(
        response.status === 429 || response.status === 503
          ? "wikimedia_rate_limited"
          : "wikimedia_request_failed",
      );
    }
    return response;
  }
  throw new Error("wikimedia_redirect_limit");
}
async function readBounded(response: Response): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("image_too_large");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_download");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error("image_too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export function normalizeCommonsQuery(query: string): string {
  return query
    .replace(/(?:^|\s)-?site:\s*(?:"[^"]*"|\S+)/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface CommonsSearchResult {
  candidates: CommonsCandidate[];
  resultCount: number;
}

export async function searchCommons(
  query: string,
  signal: AbortSignal,
  userAgent: string,
): Promise<CommonsSearchResult> {
  query = normalizeCommonsQuery(query);
  if (!query) throw new Error("empty_search_query");
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "5",
    prop: "imageinfo",
    iiprop: "url|size|mime|thumbmime|extmetadata",
    iiurlwidth: "960",
    maxlag: "5",
  }).toString();
  const response = await request(url.href, signal, userAgent, true);
  const result = z
    .object({
      error: z.unknown().optional(),
      query: z.object({ pages: z.array(z.unknown()) }).optional(),
    })
    .parse(JSON.parse(new TextDecoder().decode(await readBounded(response))));
  if (result.error) {
    retryAfter = Date.now() + 60_000;
    throw new Error("wikimedia_api_limited");
  }
  const candidates: CommonsCandidate[] = [];
  for (const raw of result.query?.pages ?? []) {
    const parsed = infoSchema.safeParse(raw);
    if (!parsed.success) continue;
    const page = parsed.data;
    const info = page.imageinfo?.[0];
    if (!info) continue;
    if (![...rasterTypes, "image/svg+xml"].includes(info.mime) || !rasterTypes.has(info.thumbmime))
      continue;
    const meta = (key: keyof typeof info.extmetadata) => plain(info.extmetadata[key]?.value ?? "");
    const license = meta("LicenseShortName");
    const creator = meta("Artist");
    const licenseMatch = /^(CC BY(?:-SA)?) (\d\.\d)$/.exec(license);
    const publicDomain = /^(public domain|CC0)$/i.test(license);
    if (!creator || (!licenseMatch && !publicDomain) || meta("Restrictions")) continue;
    const licenseUrl =
      meta("LicenseUrl") ||
      (publicDomain
        ? `https://creativecommons.org/publicdomain/${/^cc0$/i.test(license) ? "zero" : "mark"}/1.0/`
        : "");
    let parsedLicense: URL;
    try {
      parsedLicense = new URL(licenseUrl.startsWith("//") ? `https:${licenseUrl}` : licenseUrl);
      allowedUrl(info.thumburl);
      allowedUrl(info.descriptionurl, true);
    } catch {
      continue;
    }
    if (
      parsedLicense.hostname !== "creativecommons.org" ||
      !["https:", "http:"].includes(parsedLicense.protocol) ||
      parsedLicense.username ||
      parsedLicense.password ||
      parsedLicense.port
    )
      continue;
    parsedLicense.protocol = "https:";
    if (
      publicDomain &&
      !`${parsedLicense.pathname.replace(/\/$/, "")}/`.startsWith(
        `/publicdomain/${/^cc0$/i.test(license) ? "zero" : "mark"}/1.0/`,
      )
    )
      continue;
    if (
      licenseMatch &&
      !`${parsedLicense.pathname.replace(/\/$/, "")}/`.startsWith(
        `/licenses/${licenseMatch[1]?.toLowerCase().replace("cc ", "")}/${licenseMatch[2]}/`,
      )
    )
      continue;
    candidates.push({
      fileTitle: page.title,
      width: info.thumbwidth,
      height: info.thumbheight,
      creator,
      sourceUrl: info.descriptionurl,
      license,
      licenseVersion: licenseMatch?.[2] ?? "1.0",
      licenseUrl: parsedLicense.href,
      thumbnail: info.thumburl,
      mime: info.thumbmime,
    });
  }
  return { candidates, resultCount: result.query?.pages.length ?? 0 };
}
export async function downloadThumbnail(
  candidate: CommonsCandidate,
  signal: AbortSignal,
  userAgent: string,
): Promise<Uint8Array> {
  const response = await request(candidate.thumbnail, signal, userAgent);
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (mime !== candidate.mime || !mime || !rasterTypes.has(mime)) {
    await response.body?.cancel();
    throw new Error("invalid_image_mime");
  }
  const bytes = await readBounded(response);
  if (!hasRasterSignature(bytes, mime)) throw new Error("invalid_image_bytes");
  return bytes;
}

function hasRasterSignature(bytes: Uint8Array, mime: string): boolean {
  switch (mime) {
    case "image/jpeg":
      return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case "image/png":
      return Buffer.from(bytes.subarray(0, 8)).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
    case "image/webp":
      return (
        Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
        Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP"
      );
    default:
      return false;
  }
}
