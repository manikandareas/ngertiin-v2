import { Global, Module } from "@nestjs/common";
import { API_ENV, loadApiEnvironment } from "./config.js";

@Global()
@Module({
  providers: [
    {
      provide: API_ENV,
      useFactory: () => loadApiEnvironment(process.env),
    },
  ],
  exports: [API_ENV],
})
export class ConfigModule {}
