import { randomUUID } from "node:crypto";

const validRequestId = /^[A-Za-z0-9._:-]{1,128}$/;

type HeaderValue = string | string[] | undefined;

export type ProductRequest = {
  headers: Record<string, HeaderValue>;
  originalUrl: string;
  path: string;
  requestContext?: {
    requestId: string;
    localUserId?: string;
  };
};

type HttpResponse = {
  setHeader(name: string, value: string): void;
};

function incomingRequestId(value: HeaderValue): string | undefined {
  return typeof value === "string" && validRequestId.test(value) ? value : undefined;
}

export function requestContextMiddleware(
  request: ProductRequest,
  response: HttpResponse,
  next: () => void,
): void {
  const requestId = incomingRequestId(request.headers["x-request-id"]) ?? `req_${randomUUID()}`;
  request.requestContext = { requestId };
  response.setHeader("X-Request-Id", requestId);

  if (request.path.startsWith("/api/v1/")) {
    response.setHeader("Cache-Control", "private, no-store");
  }

  next();
}

export function getRequestId(request: ProductRequest): string {
  return request.requestContext?.requestId ?? `req_${randomUUID()}`;
}

export function setLocalUserId(request: ProductRequest, localUserId: string): void {
  const requestId = getRequestId(request);
  request.requestContext = { requestId, localUserId };
}

export function getLocalUserId(request: ProductRequest): string {
  const localUserId = request.requestContext?.localUserId;
  if (!localUserId) {
    throw new Error("Authenticated request context is missing a local user ID");
  }
  return localUserId;
}
