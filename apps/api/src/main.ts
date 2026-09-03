import "reflect-metadata";
import { ConsoleLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { API_ENV } from "./config.js";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  const environment = app.get<ApiEnvironment>(API_ENV);
  app.enableCors({ origin: environment.WEB_ORIGIN });
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
