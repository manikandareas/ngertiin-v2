import type { ChatRunError, ChatRunStatus } from "@ngertiin/contracts/api";

/** Bound shutdown waits, including an unavailable database; lease recovery owns leftovers. */
export async function settleBefore(work: Promise<unknown>, milliseconds: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, Math.max(0, milliseconds));
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Stop awaiting an uncooperative provider after cancellation grace; observe late rejections. */
export async function withAbortGrace<T>(
  work: Promise<T>,
  signal: AbortSignal,
  graceMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      timer = setTimeout(() => reject(signal.reason), graceMs);
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

export function chatFailureStatus(code: ChatRunError): ChatRunStatus {
  switch (code) {
    case "PROCESS_INTERRUPTED":
      return "interrupted";
    case "RUN_TIMEOUT":
      return "timed_out";
    case "USER_CANCELLED":
      return "cancelled";
    default:
      return "failed";
  }
}
