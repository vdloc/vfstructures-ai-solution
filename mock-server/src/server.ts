import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { fail, newRequestId, sendJson } from "./http.ts";
import { handleChat } from "./routes/chat.ts";
import { MockState } from "./store.ts";

export interface MockServerOptions {
  delayScale: number;
  state?: MockState;
}

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  state: MockState;
  delayScale: number;
  requestId: string;
}

export interface Route {
  method: string;
  pattern: RegExp;
  handle: (ctx: RouteContext, params: string[]) => void | Promise<void>;
}

export const ROUTES: Route[] = [
  { method: "GET", pattern: /^\/health\/live$/, handle: ({ res }) => sendJson(res, 200, { status: "live" }) },
  { method: "GET", pattern: /^\/health\/ready$/, handle: ({ res }) => sendJson(res, 200, { status: "ready" }) },
  { method: "POST", pattern: /^\/v1\/chat$/, handle: handleChat },
];

export function createMockServer(options: MockServerOptions): http.Server {
  const state = options.state ?? new MockState();
  return http.createServer((req, res) => {
    const requestId = newRequestId();
    const url = new URL(req.url ?? "/", "http://mock.local");
    const ctx: RouteContext = { req, res, url, state, delayScale: options.delayScale, requestId };
    dispatch(ctx).catch((err: unknown) => {
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, fail("internal_error", "Mock server error.", requestId));
      else res.end();
    });
  });
}

async function dispatch(ctx: RouteContext): Promise<void> {
  const method = ctx.req.method ?? "GET";
  for (const route of ROUTES) {
    const match = route.pattern.exec(ctx.url.pathname);
    if (match && route.method === method) {
      await route.handle(ctx, match.slice(1).map((p) => decodeURIComponent(p)));
      return;
    }
  }
  sendJson(ctx.res, 404, fail("not_found", `No mock route for ${method} ${ctx.url.pathname}.`, ctx.requestId));
}
