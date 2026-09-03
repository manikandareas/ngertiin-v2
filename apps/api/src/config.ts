import { apiEnvSchema, type ApiEnvironment } from "@ngertiin/contracts/environment";

export const API_ENV = Symbol("API_ENV");

export function loadApiEnvironment(environment: NodeJS.ProcessEnv): ApiEnvironment {
  return apiEnvSchema.parse(environment);
}
