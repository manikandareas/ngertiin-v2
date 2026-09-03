import { webEnvSchema } from "@ngertiin/contracts/environment";

export const webEnvironment = webEnvSchema.parse(import.meta.env);

export const isClerkConfigured =
  webEnvironment.VITE_CLERK_PUBLISHABLE_KEY.startsWith("pk_") &&
  !webEnvironment.VITE_CLERK_PUBLISHABLE_KEY.includes("replace_me");
