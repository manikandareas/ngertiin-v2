import {
  infrastructureEnvSchema,
  type InfrastructureEnvironment,
} from "./infrastructure-environment.js";

export const workerEnvSchema = infrastructureEnvSchema;

export type WorkerEnvironment = InfrastructureEnvironment;
