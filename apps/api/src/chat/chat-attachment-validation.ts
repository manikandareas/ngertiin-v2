import { extname } from "node:path";
import { CHAT_ATTACHMENT_MAX_BYTES, chatAttachmentTypes } from "@ngertiin/contracts/api";
import { XMLValidator } from "fast-xml-parser";
import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { ProductError } from "../http/product-error.js";

export type AttachmentUpload = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};
export function invalidAttachment(detail: string): never {
  throw new ProductError(422, "VALIDATION_ERROR", "Invalid attachment", detail);
}
export function readUtf8(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject binary control bytes in text uploads.
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error("Binary content");
  return text;
}
export async function validateAttachment(
  file: AttachmentUpload,
): Promise<{ mime: string; filename: string }> {
  if (!file.buffer.length || file.buffer.length > CHAT_ATTACHMENT_MAX_BYTES)
    invalidAttachment("File harus berisi data dan maksimal 10 MB.");
  const extension = extname(file.originalname).slice(1).toLowerCase();
  if (!Object.hasOwn(chatAttachmentTypes, extension))
    invalidAttachment("Format file belum didukung.");
  const mime = chatAttachmentTypes[extension as keyof typeof chatAttachmentTypes];
  const declared = file.mimetype.toLowerCase().split(";")[0];
  if (
    declared &&
    declared !== "application/octet-stream" &&
    declared !== mime &&
    !(
      mime.startsWith("text/") &&
      ["text/plain", "text/csv", "text/markdown", "application/vnd.ms-excel"].includes(declared)
    )
  )
    invalidAttachment("Jenis file tidak cocok dengan isinya.");
  try {
    if (mime.startsWith("image/")) {
      const image = sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: "warning" });
      const metadata = await image.metadata();
      if (`image/${metadata.format}` !== mime || (metadata.pages ?? 1) > 1)
        throw new Error("Invalid image");
      await image.stats(); // Decode pixels, not just the header.
    } else if (mime === "application/pdf") {
      if (!file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Invalid PDF");
      const pdf = await PDFDocument.load(file.buffer, { throwOnInvalidObject: true });
      if (!pdf.getPageCount()) throw new Error("Empty PDF");
    } else if (mime.startsWith("text/")) {
      readUtf8(file.buffer);
    } else {
      validateOffice(file.buffer, extension);
    }
  } catch {
    invalidAttachment("File rusak, terenkripsi, atau isinya tidak sesuai format. Pilih file lain.");
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Sanitize untrusted filenames.
  const safeName = file.originalname.replace(/[\x00-\x1f/\\]/g, "_");
  return {
    mime,
    filename: `${safeName.slice(0, -(extension.length + 1)).slice(0, 230)}.${extension}`,
  };
}

function validateOffice(binary: Uint8Array, extension: string): void {
  let expanded = 0;
  let entries = 0;
  const files = unzipSync(binary, {
    filter(entry) {
      expanded += entry.originalSize;
      if (
        ++entries > 10000 ||
        expanded > 50 * 1024 * 1024 ||
        entry.name.includes("..") ||
        entry.name.startsWith("/")
      )
        throw new Error("Unsafe archive");
      return true;
    },
  });
  const main = {
    docx: "word/document.xml",
    pptx: "ppt/presentation.xml",
    xlsx: "xl/workbook.xml",
  }[extension];
  if (!main || !files[main] || !files["[Content_Types].xml"] || !files["_rels/.rels"])
    throw new Error("Invalid Office structure");
  const mainXml = readUtf8(files[main]);
  const rootTag = { docx: "document", pptx: "presentation", xlsx: "workbook" }[extension];
  if (!rootTag || !new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${rootTag}(?:\\s|/?>)`).test(mainXml))
    throw new Error("Invalid Office root");
  const types = readUtf8(files["[Content_Types].xml"]);
  const expected = {
    docx: "wordprocessingml.document.main+xml",
    pptx: "presentationml.presentation.main+xml",
    xlsx: "spreadsheetml.sheet.main+xml",
  }[extension];
  if (!expected || !types.includes(expected) || /macroEnabled|vbaProject/i.test(types))
    throw new Error("Invalid Office type");
  for (const [name, bytes] of Object.entries(files)) {
    if (/\.xml$/.test(name)) {
      const xml = readUtf8(bytes);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
        throw new Error("Invalid XML");
    }
  }
}
