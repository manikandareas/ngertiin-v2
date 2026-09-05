import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AdaptiveModule } from "./adaptive/adaptive.module.js";
import { AttemptsModule } from "./attempts/attempts.module.js";
import { ConfigModule } from "./config.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { HealthModule } from "./health/health.module.js";
import { ModulesModule } from "./modules/modules.module.js";
import { RequestPolicyInterceptor } from "./http/request-policy.interceptor.js";
import { InfrastructureModule } from "./infrastructure/infrastructure.module.js";
import { SourcesModule } from "./sources/sources.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ConfigModule,
    InfrastructureModule,
    HealthModule,
    DashboardModule,
    UsersModule,
    SourcesModule,
    ModulesModule,
    AttemptsModule,
    AdaptiveModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: RequestPolicyInterceptor }],
})
export class AppModule {}
