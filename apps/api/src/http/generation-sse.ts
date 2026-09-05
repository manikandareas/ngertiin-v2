import type { GenerationState } from "@ngertiin/contracts/api";

type GenerationEventName =
  | "generation.snapshot"
  | "generation.completed"
  | "generation.failed"
  | "generation.progress";

export type StreamRequest = { on(event: "close", listener: () => void): void };
export type StreamResponse = {
  status(status: number): StreamResponse;
  setHeader(name: string, value: string): void;
  flushHeaders?(): void;
  write(chunk: string): boolean;
  end(): void;
};

export function streamGeneration<Value>(input: {
  request: StreamRequest;
  response: StreamResponse;
  initial: Value;
  state: (value: Value) => GenerationState;
  read: () => Promise<Value>;
  schema: { parse(value: unknown): { event: GenerationEventName; data: Value } };
}): void {
  const initial = input.schema.parse({ event: "generation.snapshot", data: input.initial });
  input.response.status(200);
  input.response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  input.response.setHeader("Connection", "keep-alive");
  input.response.setHeader("X-Accel-Buffering", "no");
  input.response.flushHeaders?.();
  input.response.write(`event: ${initial.event}\ndata: ${JSON.stringify(initial.data)}\n\n`);
  if (["completed", "failed"].includes(input.state(initial.data))) {
    input.response.end();
    return;
  }

  let closed = false;
  let polling = false;
  let previous = JSON.stringify(initial.data);
  const close = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
    clearTimeout(maxLifetimeTimer);
    input.response.end();
  };
  input.request.on("close", close);
  const pollTimer = setInterval(() => {
    if (closed || polling) return;
    polling = true;
    void input
      .read()
      .then((value) => {
        const state = input.state(value);
        const event = input.schema.parse({
          event:
            state === "completed" || state === "failed"
              ? `generation.${state}`
              : "generation.progress",
          data: value,
        });
        const serialized = JSON.stringify(event.data);
        if (serialized === previous || closed) return;
        previous = serialized;
        input.response.write(`event: ${event.event}\ndata: ${serialized}\n\n`);
        if (state === "completed" || state === "failed") close();
      })
      .catch(close)
      .finally(() => {
        polling = false;
      });
  }, 1_000);
  pollTimer.unref();
  const heartbeatTimer = setInterval(() => {
    if (!closed) input.response.write(": heartbeat\n\n");
  }, 15_000);
  heartbeatTimer.unref();
  const maxLifetimeTimer = setTimeout(close, 5 * 60_000);
  maxLifetimeTimer.unref();
}
