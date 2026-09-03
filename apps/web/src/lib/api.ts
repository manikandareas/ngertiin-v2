import {
  type CurrentUser,
  getCurrentUserResponseSchema,
  type PatchCurrentUserBody,
  type ProblemDetail,
  patchCurrentUserResponseSchema,
  problemDetailSchema,
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
  if (init?.body !== undefined) {
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
