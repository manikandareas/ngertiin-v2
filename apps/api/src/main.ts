import "reflect-metadata";
import { ConsoleLogger, RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { AppModule } from "./app.module.js";
import { API_ENV } from "./config.js";
import { ProductErrorFilter } from "./http/product-error.filter.js";
import { requestContextMiddleware } from "./http/request-context.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  const environment = app.get<ApiEnvironment>(API_ENV);
  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
    ],
  });
  app.use(requestContextMiddleware);
  app.useGlobalFilters(new ProductErrorFilter());
  app.enableCors({
    origin: environment.WEB_ORIGIN,
    exposedHeaders: ["X-Request-Id", "Retry-After", "x-vercel-ai-ui-message-stream"],
  });
  app.enableShutdownHooks();
  await app.listen(environment.API_PORT);
}

bootstrap().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "api.startup_failed",
      errorType: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  process.exitCode = 1;
});
