import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().datetime({ offset: false });

export function successEnvelopeSchema<const Schema extends z.ZodType>(dataSchema: Schema) {
  return z.object({ data: dataSchema });
}

export type UUID = z.infer<typeof uuidSchema>;
export type Timestamp = z.infer<typeof timestampSchema>;
export type SuccessEnvelope<Value> = { data: Value };
