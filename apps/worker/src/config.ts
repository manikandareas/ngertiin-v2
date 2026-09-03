import { workerEnvSchema, type WorkerEnvironment } from "@ngertiin/contracts/environment";

export const WORKER_ENV = Symbol("WORKER_ENV");

export function loadWorkerEnvironment(environment: NodeJS.ProcessEnv): WorkerEnvironment {
  return workerEnvSchema.parse(environment);
}
