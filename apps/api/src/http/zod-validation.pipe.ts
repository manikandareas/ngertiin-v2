import { Injectable, type PipeTransform } from "@nestjs/common";
import type { FieldError } from "@ngertiin/contracts/api";
import type { output, z, ZodType } from "zod";
import { ProductError } from "./product-error.js";

function issueCode(issue: z.core.$ZodIssue): string {
  if (issue.code === "invalid_format" && "format" in issue && issue.format === "uuid") {
    return "invalid_uuid";
  }
  return issue.code;
}

function fieldErrors(issues: z.core.$ZodIssue[]): FieldError[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "body",
    code: issueCode(issue),
    message: issue.message,
  }));
}

@Injectable()
export class ZodValidationPipe<Schema extends ZodType>
  implements PipeTransform<unknown, output<Schema>>
{
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): output<Schema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ProductError(
        422,
        "VALIDATION_ERROR",
        "Request validation failed",
        "One or more fields are invalid.",
        fieldErrors(result.error.issues),
      );
    }
    return result.data;
  }
}
