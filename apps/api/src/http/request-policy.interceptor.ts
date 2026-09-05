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

type RateLimitCategory = "read" | "mutation" | "expensive" | "stream";
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
    for (const key of ["sourceId", "moduleId", "nodeId", "attemptId", "interventionId"] as const) {
      const value = request.params?.[key];
      if (value) resourceIds[key] = value;
    }
    if (request.requestContext) {
      request.requestContext.route = request.route?.path ?? request.path;
      request.requestContext.resourceIds = resourceIds;
    }

    if (userId) {
      const path = (request.route?.path ?? request.path).replace(/\/+$/, "").toLowerCase();
      let category: RateLimitCategory = "mutation";
      if (path.endsWith("/generation/events")) category = "stream";
      else if (request.method === "GET" || request.method === "HEAD") category = "read";
      else if (expensiveRoutes.some((route) => route.test(path))) category = "expensive";
      const limit = await this.infrastructure.consumeRateLimit(userId, category);
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
