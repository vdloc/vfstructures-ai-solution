import type { IncomingMessage } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticate } from "../src/http.ts";
import { startServer, type TestServer } from "./helpers.ts";

let srv: TestServer;
beforeEach(async () => {
  srv = await startServer();
});
afterEach(async () => {
  await srv.close();
});

describe("server skeleton", () => {
  it("answers liveness and readiness", async () => {
    expect((await fetch(`${srv.base}/health/live`)).status).toBe(200);
    expect((await fetch(`${srv.base}/health/ready`)).status).toBe(200);
  });

  it("returns an ApiResponse 404 with a requestId for unknown routes", async () => {
    const res = await fetch(`${srv.base}/v1/nope`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, code: "not_found", data: null });
    expect(body.requestId).toMatch(/^req-/);
  });
});

describe("authenticate", () => {
  const req = (authorization?: string) => ({ headers: authorization ? { authorization } : {} }) as IncomingMessage;

  it("rejects a missing or malformed bearer token with 401", () => {
    expect(authenticate(req())).toMatchObject({ kind: "error", status: 401, code: "unauthorized" });
    expect(authenticate(req("Basic abc"))).toMatchObject({ kind: "error", status: 401 });
  });

  it("treats the token 'expired' as an expired JWT", () => {
    expect(authenticate(req("Bearer expired"))).toMatchObject({ kind: "error", status: 401, code: "token_expired" });
  });

  it("treats the token 'no-assistant' as a user without Assistant.Use", () => {
    expect(authenticate(req("Bearer no-assistant"))).toMatchObject({ kind: "error", status: 403, code: "forbidden" });
  });

  it("uses any other token as the user id", () => {
    expect(authenticate(req("Bearer alice"))).toEqual({ kind: "ok", user: "alice" });
  });
});
