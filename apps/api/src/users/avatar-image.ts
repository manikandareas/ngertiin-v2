import sharp from "sharp";
import { ProductError } from "../http/product-error.js";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export type AvatarUpload = { buffer: Buffer; size: number; mimetype: string };

export async function normalizeAvatar(file: AvatarUpload | undefined): Promise<Buffer> {
  try {
    if (
      !file?.size ||
      file.size > MAX_AVATAR_BYTES ||
      file.buffer.length > MAX_AVATAR_BYTES ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
    )
      throw new Error("Invalid image");
    const image = sharp(file.buffer, { limitInputPixels: 25_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("Invalid image");
    return await image
      .rotate()
      .resize(512, 512, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new ProductError(
      400,
      "VALIDATION_ERROR",
      "Foto tidak valid",
      "Gunakan gambar JPG, PNG, atau WebP statis maksimal 5 MB dan 25 megapiksel.",
    );
  }
}
