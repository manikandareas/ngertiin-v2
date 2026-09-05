import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import {
  type ApiErrorCode,
  type FieldError,
  type ProblemDetail,
  problemDetailSchema,
} from "@ngertiin/contracts/api";
import { ProductError } from "./product-error.js";
import { getRequestId, type ProductRequest } from "./request-context.js";

type HttpResponse = {
  status(status: number): HttpResponse;
  json(body: unknown): void;
};

type ProblemDefinition = {
  status: number;
  code: ApiErrorCode;
  type: string;
  title: string;
  detail: string;
  errors?: FieldError[];
};

function isProductRequest(request: ProductRequest): boolean {
  return request.path === "/api/v1" || request.path.startsWith("/api/v1/");
}

function definitionFor(exception: unknown): ProblemDefinition {
  if (exception instanceof ProductError) {
    return {
      status: exception.status,
      code: exception.code,
      type: exception.code.toLowerCase().replaceAll("_", "-"),
      title: exception.title,
      detail: exception.detail,
      errors: exception.errors,
    };
  }

  if (exception instanceof Error) {
    const code = "code" in exception ? exception.code : undefined;
    if (code === "LIMIT_FILE_SIZE") {
      return {
        status: 413,
        code: "SOURCE_TOO_LARGE",
        type: "source-too-large",
        title: "Source is too large",
        detail: "The PDF exceeds the configured upload limit.",
      };
    }
    if (
      exception.name === "MulterError" ||
      /multipart|boundary|unexpected end of form/i.test(exception.message)
    ) {
      return {
        status: 400,
        code: "VALIDATION_ERROR",
        type: "malformed-request",
        title: "Malformed request",
        detail: "The multipart request could not be read.",
      };
    }
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    if (status === 400) {
      return {
        status,
        code: "VALIDATION_ERROR",
        type: "malformed-request",
        title: "Malformed request",
        detail: "The request body could not be read.",
      };
    }
    if (status === 401) {
      return {
        status,
        code: "AUTHENTICATION_INVALID",
        type: "authentication-invalid",
        title: "Authentication invalid",
        detail: "The bearer token is invalid or expired.",
      };
    }
    if (status === 403) {
      return {
        status,
        code: "AUTHORIZATION_ERROR",
        type: "authorization-error",
        title: "Operation forbidden",
        detail: "The authenticated user cannot perform this operation.",
      };
    }
    if (status === 404) {
      return {
        status,
        code: "NOT_FOUND",
        type: "not-found",
        title: "Resource not found",
        detail: "The requested resource was not found.",
      };
    }
    if (status === 413) {
      return {
        status,
        code: "SOURCE_TOO_LARGE",
        type: "source-too-large",
        title: "Source is too large",
        detail: "The PDF must not exceed 25 MiB.",
      };
    }
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    type: "internal-error",
    title: "Internal server error",
    detail: "An unexpected error occurred.",
  };
}

@Catch()
export class ProductErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ProductRequest>();
    const response = http.getResponse<HttpResponse>();

    if (!isProductRequest(request)) {
      if (exception instanceof HttpException) {
        response.status(exception.getStatus()).json(exception.getResponse());
        return;
      }
      response.status(500).json({ statusCode: 500, message: "Internal server error" });
      return;
    }

    const definition = definitionFor(exception);
    const requestId = getRequestId(request);
    const instance = request.originalUrl.split("?", 1)[0] ?? request.path;
    const problem: ProblemDetail = problemDetailSchema.parse({
      type: `https://api.ngerti.in/problems/${definition.type}`,
      title: definition.title,
      status: definition.status,
      code: definition.code,
      detail: definition.detail,
      instance,
      requestId,
      ...(definition.errors ? { errors: definition.errors } : {}),
    });

    if (definition.status === 500) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "api.unhandled_error",
          requestId,
          errorType: exception instanceof Error ? exception.name : "UnknownError",
        }),
      );
    }

    response.status(definition.status).json(problem);
  }
}
