import type { AddressInfo } from "node:net";
import { createMockServer, type MockServerOptions } from "../src/server.ts";
import { MockState } from "../src/store.ts";

export interface TestServer {
  base: string;
  state: MockState;
  close: () => Promise<void>;
}

export async function startServer(options: Partial<MockServerOptions> = {}): Promise<TestServer> {
  const state = options.state ?? new MockState();
  const server = createMockServer({ delayScale: 0, ...options, state });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    state,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export const authHeaders = (user = "dev-user"): Record<string, string> => ({
  authorization: `Bearer ${user}`,
  "content-type": "application/json",
});

export function chat(base: string, body: Record<string, unknown>, user = "dev-user", init: RequestInit = {}): Promise<Response> {
  return fetch(`${base}/v1/chat`, {
    method: "POST",
    headers: authHeaders(user),
    body: JSON.stringify({ conversationId: "c-test", message: "Question", locale: "fr", context: {}, ...body }),
    ...init,
  });
}

export interface ReceivedEvent {
  event: string;
  data: any;
  at: number;
}

/** Reads SSE frames. When `stopWhen` matches, it aborts `abort` and returns what it has. */
export async function readEvents(
  res: Response,
  opts: { stopWhen?: (e: ReceivedEvent) => boolean; abort?: AbortController } = {},
): Promise<ReceivedEvent[]> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  const out: ReceivedEvent[] = [];
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return out;
      buf += value;
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const event = /^event: (.*)$/m.exec(frame)?.[1] ?? "message";
        const data = JSON.parse(/^data: (.*)$/m.exec(frame)?.[1] ?? "null");
        const e = { event, data, at: performance.now() };
        out.push(e);
        if (opts.stopWhen?.(e)) {
          opts.abort?.abort();
          return out;
        }
      }
    }
  } catch (err) {
    if (opts.abort?.signal.aborted) return out;
    throw err;
  }
}

export async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}
