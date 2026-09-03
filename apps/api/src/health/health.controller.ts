import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type { LiveHealth, ReadyHealth } from "@ngertiin/contracts/health";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  @Get("live")
  live(): LiveHealth {
    return { status: "ok", service: "api" };
  }

  @Get("ready")
  async ready(): Promise<ReadyHealth> {
    const [postgres, redis, storage] = await Promise.allSettled([
      this.infrastructure.checkPostgres(),
      this.infrastructure.checkRedis(),
      this.infrastructure.checkStorage(),
    ]);
    const response: ReadyHealth = {
      status:
        postgres.status === "fulfilled" &&
        redis.status === "fulfilled" &&
        storage.status === "fulfilled"
          ? "ok"
          : "error",
      service: "api",
      dependencies: {
        postgres: postgres.status === "fulfilled" ? "up" : "down",
        redis: redis.status === "fulfilled" ? "up" : "down",
        storage: storage.status === "fulfilled" ? "up" : "down",
      },
    };

    if (response.status === "error") {
      throw new ServiceUnavailableException(response);
    }
    return response;
  }
}
