import {
  type AdaptiveDecision,
  type AdaptiveGenerationEvent,
  type AdaptiveIntervention,
  type AttemptResult,
  adaptiveGenerationEventSchema,
  archiveModuleResponseSchema,
  type CompleteNodeResult,
  type CreateModuleBodyInput,
  type CreatePdfSourceFieldsInput,
  type CreateTextSourceBodyInput,
  type CreateUrlSourceBodyInput,
  type CurrentUser,
  completeNodeResponseSchema,
  createModuleResponseSchema,
  createPdfSourceResponseSchema,
  createTextSourceResponseSchema,
  createUrlSourceResponseSchema,
  type Dashboard,
  decideAdaptiveInterventionResponseSchema,
  type GenerationEvent,
  type GenerationStatus,
  generationEventSchema,
  getAdaptiveInterventionResponseSchema,
  getAttemptResponseSchema,
  getCurrentUserResponseSchema,
  getDashboardResponseSchema,
  getGenerationResponseSchema,
  getJourneyResponseSchema,
  getModuleResponseSchema,
  getNodeResponseSchema,
  getSourceResponseSchema,
  type JourneySummary,
  type ListModulesQueryInput,
  type ListModulesResponse,
  type ListSourcesQueryInput,
  type ListSourcesResponse,
  listModulesResponseSchema,
  listSourcesResponseSchema,
  type ModuleSummary,
  type NodeActionResult,
  type NodeDetail,
  type PatchCurrentUserBody,
  type ProblemDetail,
  patchCurrentUserResponseSchema,
  problemDetailSchema,
  retryGenerationResponseSchema,
  retrySourceResponseSchema,
  type Source,
  type SubmitAttemptBody,
  startNodeResponseSchema,
  submitAttemptResponseSchema,
  usageResponseSchema,
} from "@ngertiin/contracts/api";
import { webEnvironment } from "../config";

export type TokenResolver = () => Promise<string | null>;

type ResponseSchema<Value> = {
  parse(value: unknown): Value;
};

export class ApiProblemError extends Error {
  constructor(readonly problem: ProblemDetail) {
    super(problem.detail);
    this.name = "ApiProblemError";
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function requestApi<Value>(
  path: string,
  tokenResolver: TokenResolver,
  schema: ResponseSchema<Value>,
  init?: RequestInit,
): Promise<Value> {
  const token = await tokenResolver();
  if (!token) {
    throw new Error("Clerk session token is unavailable.");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body !== undefined && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${webEnvironment.VITE_API_URL}/api/v1${path}`, {
    ...init,
    headers,
  });
  const body = await readJson(response);

  if (!response.ok) {
    const problem = problemDetailSchema.safeParse(body);
    if (problem.success) {
      throw new ApiProblemError(problem.data);
    }
    throw new Error(`API returned an invalid error response (${response.status}).`);
  }

  return schema.parse(body);
}

export async function getCurrentUser(tokenResolver: TokenResolver): Promise<CurrentUser> {
  const response = await requestApi("/me", tokenResolver, getCurrentUserResponseSchema);
  return response.data;
}

export async function getDashboard(tokenResolver: TokenResolver): Promise<Dashboard> {
  const response = await requestApi("/dashboard", tokenResolver, getDashboardResponseSchema);
  return response.data;
}

export async function patchCurrentUser(
  tokenResolver: TokenResolver,
  input: PatchCurrentUserBody,
): Promise<CurrentUser> {
  const response = await requestApi("/me", tokenResolver, patchCurrentUserResponseSchema, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function createTextSource(
  tokenResolver: TokenResolver,
  input: CreateTextSourceBodyInput,
  idempotencyKey: string,
): Promise<Source> {
  const response = await requestApi(
    "/sources/text",
    tokenResolver,
    createTextSourceResponseSchema,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function createUrlSource(
  tokenResolver: TokenResolver,
  input: CreateUrlSourceBodyInput,
  idempotencyKey: string,
): Promise<Source> {
  const response = await requestApi("/sources/url", tokenResolver, createUrlSourceResponseSchema, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function createPdfSource(
  tokenResolver: TokenResolver,
  fields: CreatePdfSourceFieldsInput,
  file: File,
  idempotencyKey: string,
): Promise<Source> {
  const body = new FormData();
  if (fields.title !== undefined) body.set("title", fields.title);
  body.set("file", file);
  const response = await requestApi("/sources/pdf", tokenResolver, createPdfSourceResponseSchema, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body,
  });
  return response.data;
}

export async function listSources(
  tokenResolver: TokenResolver,
  query: ListSourcesQueryInput = {},
): Promise<ListSourcesResponse> {
  const search = new URLSearchParams();
  if (query.type !== undefined) {
    search.set("type", query.type);
  }
  if (query.status !== undefined) {
    search.set("status", query.status);
  }
  if (query.limit !== undefined) {
    search.set("limit", String(query.limit));
  }
  if (query.cursor !== undefined) {
    search.set("cursor", query.cursor);
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return requestApi(`/sources${suffix}`, tokenResolver, listSourcesResponseSchema);
}

export async function getSource(tokenResolver: TokenResolver, sourceId: string): Promise<Source> {
  const response = await requestApi(
    `/sources/${encodeURIComponent(sourceId)}`,
    tokenResolver,
    getSourceResponseSchema,
  );
  return response.data;
}

export async function retrySource(
  tokenResolver: TokenResolver,
  sourceId: string,
  idempotencyKey: string,
): Promise<Source> {
  const response = await requestApi(
    `/sources/${encodeURIComponent(sourceId)}/retry`,
    tokenResolver,
    retrySourceResponseSchema,
    { method: "POST", headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}

export async function createModule(
  tokenResolver: TokenResolver,
  input: CreateModuleBodyInput,
  idempotencyKey: string,
): Promise<{ module: ModuleSummary; generation: GenerationStatus }> {
  const response = await requestApi("/modules", tokenResolver, createModuleResponseSchema, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function listModules(
  tokenResolver: TokenResolver,
  query: ListModulesQueryInput = {},
): Promise<ListModulesResponse> {
  const search = new URLSearchParams();
  if (query.status !== undefined) search.set("status", query.status);
  if (query.progressStatus !== undefined) search.set("progressStatus", query.progressStatus);
  if (query.limit !== undefined) search.set("limit", String(query.limit));
  if (query.cursor !== undefined) search.set("cursor", query.cursor);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return requestApi(`/modules${suffix}`, tokenResolver, listModulesResponseSchema);
}

export async function getModule(
  tokenResolver: TokenResolver,
  moduleId: string,
): Promise<ModuleSummary> {
  const response = await requestApi(
    `/modules/${encodeURIComponent(moduleId)}`,
    tokenResolver,
    getModuleResponseSchema,
  );
  return response.data;
}

export async function archiveModule(
  tokenResolver: TokenResolver,
  moduleId: string,
): Promise<ModuleSummary> {
  const response = await requestApi(
    `/modules/${encodeURIComponent(moduleId)}/archive`,
    tokenResolver,
    archiveModuleResponseSchema,
    { method: "POST" },
  );
  return response.data;
}

export async function getGeneration(
  tokenResolver: TokenResolver,
  moduleId: string,
): Promise<GenerationStatus> {
  const response = await requestApi(
    `/modules/${encodeURIComponent(moduleId)}/generation`,
    tokenResolver,
    getGenerationResponseSchema,
  );
  return response.data;
}

export async function retryGeneration(
  tokenResolver: TokenResolver,
  moduleId: string,
  idempotencyKey: string,
): Promise<{ module: ModuleSummary; generation: GenerationStatus }> {
  const response = await requestApi(
    `/modules/${encodeURIComponent(moduleId)}/generation/retry`,
    tokenResolver,
    retryGenerationResponseSchema,
    { method: "POST", headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}

export async function getJourney(
  tokenResolver: TokenResolver,
  moduleId: string,
): Promise<JourneySummary> {
  const response = await requestApi(
    `/modules/${encodeURIComponent(moduleId)}/journey`,
    tokenResolver,
    getJourneyResponseSchema,
  );
  return response.data;
}

export async function getNode(
  tokenResolver: TokenResolver,
  moduleId: string,
  nodeId: string,
): Promise<NodeDetail> {
  const response = await requestApi(
    `/modules/${encodeURIComponent(moduleId)}/nodes/${encodeURIComponent(nodeId)}`,
    tokenResolver,
    getNodeResponseSchema,
  );
  return response.data;
}

export async function startNode(
  tokenResolver: TokenResolver,
  moduleId: string,
  nodeId: string,
): Promise<NodeActionResult> {
  const response = await requestApi(
    `/modules/${encodeURIComponent(moduleId)}/nodes/${encodeURIComponent(nodeId)}/start`,
    tokenResolver,
    startNodeResponseSchema,
    { method: "POST" },
  );
  return response.data;
}

export async function completeNode(
  tokenResolver: TokenResolver,
  moduleId: string,
  nodeId: string,
): Promise<CompleteNodeResult> {
  const response = await requestApi(
    `/modules/${encodeURIComponent(moduleId)}/nodes/${encodeURIComponent(nodeId)}/complete`,
    tokenResolver,
    completeNodeResponseSchema,
    { method: "POST" },
  );
  return response.data;
}

export async function submitAttempt(
  tokenResolver: TokenResolver,
  moduleId: string,
  nodeId: string,
  input: SubmitAttemptBody,
): Promise<AttemptResult> {
  const response = await requestApi(
    `/modules/${encodeURIComponent(moduleId)}/nodes/${encodeURIComponent(nodeId)}/attempts`,
    tokenResolver,
    submitAttemptResponseSchema,
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.data;
}

export async function getAttempt(
  tokenResolver: TokenResolver,
  attemptId: string,
): Promise<AttemptResult> {
  const response = await requestApi(
    `/attempts/${encodeURIComponent(attemptId)}`,
    tokenResolver,
    getAttemptResponseSchema,
  );
  return response.data;
}

export async function getAdaptiveIntervention(
  tokenResolver: TokenResolver,
  interventionId: string,
): Promise<AdaptiveIntervention> {
  const response = await requestApi(
    `/adaptive-interventions/${encodeURIComponent(interventionId)}`,
    tokenResolver,
    getAdaptiveInterventionResponseSchema,
  );
  return response.data;
}

export async function decideAdaptiveIntervention(
  tokenResolver: TokenResolver,
  interventionId: string,
  decision: AdaptiveDecision,
  idempotencyKey: string,
): Promise<AdaptiveIntervention> {
  const response = await requestApi(
    `/adaptive-interventions/${encodeURIComponent(interventionId)}/decision`,
    tokenResolver,
    decideAdaptiveInterventionResponseSchema,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ decision }),
    },
  );
  return response.data;
}

async function streamApiEvents<Value>(input: {
  tokenResolver: TokenResolver;
  path: string;
  signal: AbortSignal;
  schema: ResponseSchema<Value>;
  onEvent: (event: Value) => void;
}): Promise<void> {
  const token = await input.tokenResolver();
  if (!token) throw new Error("Clerk session token is unavailable.");
  const response = await fetch(`${webEnvironment.VITE_API_URL}/api/v1${input.path}`, {
    headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
    signal: input.signal,
  });
  if (!response.ok) {
    const body = await readJson(response);
    const problem = problemDetailSchema.safeParse(body);
    if (problem.success) throw new ApiProblemError(problem.data);
    throw new Error(`API returned an invalid SSE response (${response.status}).`);
  }
  if (!response.body) throw new Error("Generation event stream has no body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = done ? "" : (frames.pop() ?? "");
    for (const frame of frames) {
      if (frame.startsWith(":")) continue;
      let eventName = "";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (!eventName || dataLines.length === 0) continue;
      input.onEvent(
        input.schema.parse({ event: eventName, data: JSON.parse(dataLines.join("\n")) }),
      );
    }
    if (done) break;
  }
}

export function streamAdaptiveGenerationEvents(
  tokenResolver: TokenResolver,
  interventionId: string,
  signal: AbortSignal,
  onEvent: (event: AdaptiveGenerationEvent) => void,
): Promise<void> {
  return streamApiEvents({
    tokenResolver,
    path: `/adaptive-interventions/${encodeURIComponent(interventionId)}/generation/events`,
    signal,
    schema: adaptiveGenerationEventSchema,
    onEvent,
  });
}

export function streamGenerationEvents(
  tokenResolver: TokenResolver,
  moduleId: string,
  signal: AbortSignal,
  onEvent: (event: GenerationEvent) => void,
): Promise<void> {
  return streamApiEvents({
    tokenResolver,
    path: `/modules/${encodeURIComponent(moduleId)}/generation/events`,
    signal,
    schema: generationEventSchema,
    onEvent,
  });
}

export async function getUsage(tokenResolver: TokenResolver) {
  return (await requestApi("/me/usage", tokenResolver, usageResponseSchema)).data;
}
