import { z } from "zod";

export const pageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});

export function paginatedSuccessEnvelopeSchema<const Schema extends z.ZodType>(itemSchema: Schema) {
  return z.object({
    data: z.array(itemSchema),
    pageInfo: pageInfoSchema,
  });
}

export type PageInfo = z.infer<typeof pageInfoSchema>;
export type PaginatedSuccessEnvelope<Value> = {
  data: Value[];
  pageInfo: PageInfo;
};
