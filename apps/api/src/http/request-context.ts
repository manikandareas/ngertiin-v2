import { randomUUID } from "node:crypto";

const validRequestId = /^[A-Za-z0-9._:-]{1,128}$/;

type HeaderValue = string | string[] | undefined;

export type ProductRequest = {
  headers: Record<string, HeaderValue>;
  method?: string;
  originalUrl: string;
  path: string;
  params?: Record<string, string>;
  route?: { path?: string };
  requestContext?: {
    requestId: string;
    localUserId?: string;
    route?: string;
    resourceIds?: Record<string, string>;
  };
};

type HttpResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: "finish", listener: () => void): void;
};

export function requestContextMiddleware(
  request: ProductRequest,
  response: HttpResponse,
  next: () => void,
): void {
  const startedAt = performance.now();
  const incomingRequestId = request.headers["x-request-id"];
  const requestId =
    typeof incomingRequestId === "string" && validRequestId.test(incomingRequestId)
      ? incomingRequestId
      : `req_${randomUUID()}`;
  request.requestContext = { requestId };
  response.setHeader("X-Request-Id", requestId);

  if (request.path.toLowerCase().startsWith("/api/v1/")) {
    response.setHeader("Cache-Control", "private, no-store");
  }

  response.on("finish", () => {
    console.log(
      JSON.stringify({
        level: "log",
        event: "api.request_completed",
        requestId,
        userId: request.requestContext?.localUserId,
        route: request.requestContext?.route ?? request.route?.path ?? "unmatched",
        ...request.requestContext?.resourceIds,
        status: response.statusCode,
        latencyMs: Math.round(performance.now() - startedAt),
      }),
    );
  });

  next();
}

export function getRequestId(request: ProductRequest): string {
  return request.requestContext?.requestId ?? `req_${randomUUID()}`;
}

export function setLocalUserId(request: ProductRequest, localUserId: string): void {
  const requestId = getRequestId(request);
  request.requestContext = { ...request.requestContext, requestId, localUserId };
}

export function getLocalUserId(request: ProductRequest): string {
  const localUserId = request.requestContext?.localUserId;
  if (!localUserId) {
    throw new Error("Authenticated request context is missing a local user ID");
  }
  return localUserId;
}
