import { z } from "zod";

export const webEnvSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
});

export type WebEnvironment = z.infer<typeof webEnvSchema>;
