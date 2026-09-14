import { type BeforeApplicationShutdown, Inject, Injectable } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

@Injectable()
export class HttpShutdownService implements BeforeApplicationShutdown {
  constructor(@Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost) {}

  beforeApplicationShutdown() {
    // Module destroy hooks have drained durable runs. Explicitly close HTTP
    // connections: destroying tracked sockets alone can leave Bun's close pending.
    const server = this.adapterHost.httpAdapter?.getHttpServer();
    server?.closeAllConnections?.();
  }
}
