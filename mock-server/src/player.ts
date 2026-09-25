import type { AnyEvent, EventName } from "./contract.ts";
import { formatSseEvent } from "./sse.ts";

/** One event plus the pause before it, in ms at delay scale 1. */
export type Step = AnyEvent & { delayMs: number };

export interface PlayResult {
  outcome: "completed" | "aborted";
  text: string;
  emitted: EventName[];
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Writes each step as an SSE frame after its delay. Stops without writing again once `signal` aborts. */
export async function play(
  steps: Step[],
  write: (frame: string) => void,
  opts: { scale: number; signal: AbortSignal },
): Promise<PlayResult> {
  let text = "";
  const emitted: EventName[] = [];
  for (const step of steps) {
    try {
      await sleep(step.delayMs * opts.scale, opts.signal);
    } catch {
      return { outcome: "aborted", text, emitted };
    }
    if (opts.signal.aborted) return { outcome: "aborted", text, emitted };
    write(formatSseEvent(step.event, step.data));
    emitted.push(step.event);
    if (step.event === "token") text += step.data.text;
  }
  return { outcome: "completed", text, emitted };
}
