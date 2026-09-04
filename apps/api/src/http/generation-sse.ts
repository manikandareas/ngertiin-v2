import type { GenerationState } from "@ngertiin/contracts/api";

export type StreamRequest = { on(event: "close", listener: () => void): void };
export type StreamResponse = {
  status(status: number): StreamResponse;
  setHeader(name: string, value: string): void;
  flushHeaders?(): void;
  write(chunk: string): boolean;
  end(): void;
};

function eventName(
  state: GenerationState,
): "generation.completed" | "generation.failed" | "generation.progress" {
  if (state === "completed") return "generation.completed";
  if (state === "failed") return "generation.failed";
  return "generation.progress";
}

export function streamGeneration<Value>(input: {
  request: StreamRequest;
  response: StreamResponse;
  initial: Value;
  state: (value: Value) => GenerationState;
  read: () => Promise<Value>;
}): void {
  input.response.status(200);
  input.response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  input.response.setHeader("Connection", "keep-alive");
  input.response.setHeader("X-Accel-Buffering", "no");
  input.response.flushHeaders?.();
  input.response.write(`event: generation.snapshot\ndata: ${JSON.stringify(input.initial)}\n\n`);
  if (["completed", "failed"].includes(input.state(input.initial))) {
    input.response.end();
    return;
  }

  let closed = false;
  let polling = false;
  let previous = JSON.stringify(input.initial);
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
        const serialized = JSON.stringify(value);
        if (serialized === previous || closed) return;
        previous = serialized;
        const state = input.state(value);
        input.response.write(`event: ${eventName(state)}\ndata: ${serialized}\n\n`);
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
