import { z } from "zod";
import { ProductError } from "../http/product-error.js";

const cursorSchema = z
  .object({
    scope: z.string(),
    id: z.uuid(),
    order: z.union([z.iso.datetime(), z.number().int().positive()]),
  })
  .strict();
export function readChatCursor(cursor: string | undefined, scope: string) {
  if (!cursor) return undefined;
  try {
    const value = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (value.scope !== scope) throw new Error("scope");
    return value;
  } catch {
    throw new ProductError(
      422,
      "VALIDATION_ERROR",
      "Invalid cursor",
      "Cursor tidak valid untuk percakapan ini.",
    );
  }
}
export function chatPage<Value>(
  data: Value[],
  limit: number,
  scope: string,
  key: (value: Value) => { id: string; order: string | number },
) {
  const hasNextPage = data.length > limit;
  const page = data.slice(0, limit);
  const last = page.at(-1);
  return {
    data: page,
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? Buffer.from(JSON.stringify({ scope, ...key(last) })).toString("base64url")
          : null,
    },
  };
}
