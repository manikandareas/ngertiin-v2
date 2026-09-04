import "reflect-metadata";
import { ConsoleLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const logger = new ConsoleLogger({ json: true, colors: false });
  const application = await NestFactory.createApplicationContext(AppModule, { logger });
  application.enableShutdownHooks();
  logger.log({ event: "worker.ready", queues: 1 }, "Worker");
}

bootstrap().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "worker.startup_failed",
      errorType: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  process.exit(1);
});
