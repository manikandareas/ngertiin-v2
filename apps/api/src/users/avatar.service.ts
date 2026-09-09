import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { users } from "@ngertiin/database";
import { eq } from "drizzle-orm";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

import { type AvatarUpload, normalizeAvatar } from "./avatar-image.js";

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  async resolve(key: string | null, fallback: string): Promise<string> {
    if (!key) return fallback;
    try {
      return await this.infrastructure.storage.createSignedUrl(key, 3600);
    } catch {
      this.logger.warn("Avatar URL signing failed");
      return fallback;
    }
  }

  async upload(userId: string, file: AvatarUpload | undefined): Promise<void> {
    const body = await normalizeAvatar(file);
    const key = `avatars/${userId}/${randomUUID()}.webp`;
    try {
      await this.infrastructure.storage.put({ key, body, contentType: "image/webp" });
      await this.replace(userId, key);
    } catch (error) {
      await this.cleanup(key);
      throw error;
    }
  }

  async replace(userId: string, key: string | null): Promise<void> {
    const oldKey = await this.infrastructure.database.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ key: users.avatar_object_key })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!row)
        throw new ProductError(
          404,
          "NOT_FOUND",
          "Profil tidak ditemukan",
          "Muat ulang profil lalu coba lagi.",
        );
      await tx
        .update(users)
        .set({ avatar_object_key: key, updated_at: new Date() })
        .where(eq(users.id, userId));
      return row.key;
    });
    if (oldKey && oldKey !== key) await this.cleanup(oldKey);
  }

  private async cleanup(key: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // A failed COMMIT response can be ambiguous. Never delete an object that
        // the database still references, or delete while that check is unavailable.
        const [referenced] = await this.infrastructure.database.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.avatar_object_key, key))
          .limit(1);
        if (referenced) return;
        await this.infrastructure.storage.delete(key);
        return;
      } catch {
        // A cleanup failure must never undo a committed avatar replacement.
      }
    }
    this.logger.error(`Avatar cleanup deferred; check references before deletion: ${key}`);
  }
}
