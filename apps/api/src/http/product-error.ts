import type { ApiErrorCode, FieldError } from "@ngertiin/contracts/api";

export class ProductError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly title: string,
    readonly detail: string,
    readonly errors?: FieldError[],
  ) {
    super(detail);
    this.name = "ProductError";
  }
}
