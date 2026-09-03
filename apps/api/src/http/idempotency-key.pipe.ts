import { Injectable, type PipeTransform } from "@nestjs/common";
import { idempotencyKeySchema } from "@ngertiin/contracts/api";
import { ProductError } from "./product-error.js";

@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (value === undefined) {
      throw new ProductError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency key required",
        "An Idempotency-Key header is required for this command.",
      );
    }

    const result = idempotencyKeySchema.safeParse(value);
    if (!result.success) {
      throw new ProductError(
        422,
        "VALIDATION_ERROR",
        "Request validation failed",
        "The Idempotency-Key header is invalid.",
        result.error.issues.map((issue) => ({
          path: "Idempotency-Key",
          code: issue.code,
          message: issue.message,
        })),
      );
    }

    return result.data;
  }
}
