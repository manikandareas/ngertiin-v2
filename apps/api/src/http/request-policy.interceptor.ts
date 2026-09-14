import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { ProductError } from "./product-error.js";
import type { ProductRequest } from "./request-context.js";

type RateLimitCategory = "read" | "mutation" | "expensive" | "stream" | "chatUpload" | "chatCancel";
type HttpRequest = ProductRequest & {
  method: string;
};
type HttpResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
};

const expensiveRoutes = [
  /^\/api\/v1\/sources\/(url|pdf)$/,
  /^\/api\/v1\/sources\/[^/]+\/retry$/,
  /^\/api\/v1\/modules$/,
  /^\/api\/v1\/modules\/[^/]+\/generation\/retry$/,
  /^\/api\/v1\/modules\/[^/]+\/nodes\/[^/]+\/attempts$/,
  /^\/api\/v1\/adaptive-interventions\/[^/]+\/decision$/,
];

@Injectable()
export class RequestPolicyInterceptor implements NestInterceptor {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();
    const userId = request.requestContext?.localUserId;
    const resourceIds: Record<string, string> = {};
    for (const key of [
      "sourceId",
      "moduleId",
      "nodeId",
      "attemptId",
      "interventionId",
      "threadId",
      "runId",
      "messageId",
      "imageId",
    ] as const) {
      const value = request.params?.[key];
      // Route params are untrusted until pipes run; never log arbitrary input as an ID.
      if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
        resourceIds[key] = value;
    }
    if (request.requestContext) {
      request.requestContext.route = request.route?.path ?? request.path;
      request.requestContext.resourceIds = resourceIds;
    }

    if (userId) {
      const path = (request.route?.path ?? request.path).replace(/\/+$/, "").toLowerCase();
      let category: RateLimitCategory = "mutation";
      if (request.method === "POST" && path === "/api/v1/chat/attachments") category = "chatUpload";
      else if (
        request.method === "POST" &&
        /\/chat\/threads\/[^/]+\/runs\/[^/]+\/cancel$/.test(path)
      )
        category = "chatCancel";
      else if (
        path.endsWith("/generation/events") ||
        (path.includes("/chat/") && path.endsWith("/events"))
      )
        category = "stream";
      else if (request.method === "GET" || request.method === "HEAD") category = "read";
      else if (expensiveRoutes.some((route) => route.test(path))) category = "expensive";
      const limit = await this.infrastructure.consumeRateLimit(userId, category);
      if (limit.unavailable)
        throw new ProductError(
          503,
          "CHAT_UNAVAILABLE",
          "Chat unavailable",
          "Upload belum tersedia. Coba lagi nanti.",
        );
      if (!limit.allowed) {
        response.setHeader("Retry-After", String(limit.retryAfterSeconds));
        throw new ProductError(
          429,
          "RATE_LIMITED",
          "Rate limit exceeded",
          "Too many requests were made in the current rate-limit window.",
        );
      }
    }

    return next.handle();
  }
}
