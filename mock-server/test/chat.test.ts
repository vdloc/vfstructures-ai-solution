import { afterEach, describe, expect, it } from "vitest";
import { authHeaders, chat, readEvents, startServer, waitFor, type TestServer } from "./helpers.ts";

let srv: TestServer | undefined;
afterEach(async () => {
  await srv?.close();
  srv = undefined;
});

describe("POST /v1/chat — stream", () => {
  it("answers with SSE headers from the contract", async () => {
    srv = await startServer();
    const res = await chat(srv.base, { message: "/mock:doc-qa" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    await readEvents(res);
  });

  it("accepts the 02 §7 acceptance body without locale", async () => {
    srv = await startServer();
    const res = await fetch(`${srv.base}/v1/chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ conversationId: "c-1", message: "ping", context: {} }),
    });
    expect(res.status).toBe(200);
    expect((await readEvents(res)).at(-1)?.event).toBe("done");
  });

  it("streams events over time, not in one flush", async () => {
    srv = await startServer({ delayScale: 0.2 });
    const events = await readEvents(await chat(srv.base, { message: "/mock:doc-qa" }));
    const span = events.at(-1)!.at - events[0]!.at;
    const spacedGaps = events.slice(1).filter((e, i) => e.at - events[i]!.at > 5).length;
    expect(span).toBeGreaterThan(300);
    expect(spacedGaps).toBeGreaterThanOrEqual(3);
  });

  it("refusal reaches the client with no token event", async () => {
    srv = await startServer();
    const events = await readEvents(await chat(srv.base, { message: "/mock:refusal" }));
    expect(events.map((e) => e.event)).toEqual(["status", "refusal", "done"]);
  });

  it("stores a completed turn with its done messageId", async () => {
    srv = await startServer();
    const events = await readEvents(await chat(srv.base, { conversationId: "c-store", message: "/mock:doc-qa" }));
    const messages = srv.state.read("c-store", "dev-user")!.messages;
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages[1]).toMatchObject({ id: events.at(-1)!.data.messageId, status: "completed" });
    expect(messages[1]!.text).toContain("0,00088");
  });

  it("stores warnings as completed_unverified and mid-stream errors as errored with partial text", async () => {
    srv = await startServer();
    await readEvents(await chat(srv.base, { conversationId: "c-w", message: "/mock:warning-unknown" }));
    expect(srv.state.read("c-w", "dev-user")!.messages[1]!.status).toBe("completed_unverified");
    const events = await readEvents(await chat(srv.base, { conversationId: "c-e", message: "/mock:error-mid-stream" }));
    expect(events.at(-1)).toMatchObject({ event: "error", data: { retryable: true, partial: true } });
    expect(events.at(-1)!.data.requestId).toMatch(/^req-/);
    const stored = srv.state.read("c-e", "dev-user")!.messages[1]!;
    expect(stored.status).toBe("errored");
    expect(stored.text.length).toBeGreaterThan(0);
  });

  it("stores an aborted message and releases the lock when the client disconnects", async () => {
    srv = await startServer({ delayScale: 0.2 });
    const ac = new AbortController();
    const res = await chat(srv.base, { conversationId: "c-abort", message: "/mock:long" }, "u1", { signal: ac.signal });
    const got = await readEvents(res, { stopWhen: (e) => e.event === "token", abort: ac });
    expect(got.at(-1)!.event).toBe("token");
    await waitFor(() => !srv!.state.activeTurns.has("u1"));
    const last = srv.state.read("c-abort", "u1")!.messages.at(-1)!;
    expect(last.status).toBe("aborted");
    expect(last.text.length).toBeGreaterThan(0);
    const next = await chat(srv.base, { conversationId: "c-abort", message: "/mock:refusal" }, "u1");
    expect(next.status).toBe(200);
    await readEvents(next);
  });

  it("rejects a second concurrent turn for the same user only", async () => {
    srv = await startServer({ delayScale: 0.2 });
    const acA = new AbortController();
    const first = await chat(srv.base, { conversationId: "c-a", message: "/mock:long" }, "u1", { signal: acA.signal });
    expect(first.status).toBe(200);

    const second = await chat(srv.base, { conversationId: "c-b", message: "/mock:doc-qa" }, "u1");
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({ success: false, code: "concurrent_turn" });

    const acC = new AbortController();
    const other = await chat(srv.base, { conversationId: "c-c", message: "/mock:long" }, "u2", { signal: acC.signal });
    expect(other.status).toBe(200);
    acA.abort();
    acC.abort();
  });

  it("routes a Tra re-submit with context.caseParams to case results", async () => {
    srv = await startServer();
    const events = await readEvents(
      await chat(srv.base, {
        message: "Tra",
        context: { caseParams: [{ key: "span", value: 12, unit: "m" }, { key: "fck", value: 30, unit: "MPa" }] },
      }),
    );
    expect(events.find((e) => e.event === "tool_result")?.data.outputs.cases).toHaveLength(5);
  });
});

describe("POST /v1/chat — errors before the stream", () => {
  it.each([
    [undefined, 401, "unauthorized"],
    ["expired", 401, "token_expired"],
    ["no-assistant", 403, "forbidden"],
  ])("token %s → %i %s", async (token, statusCode, code) => {
    srv = await startServer();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${srv.base}/v1/chat`, { method: "POST", headers, body: JSON.stringify({ conversationId: "c", message: "q" }) });
    expect(res.status).toBe(statusCode);
    expect(await res.json()).toMatchObject({ success: false, code });
  });

  it.each([
    ["not json", 400],
    [JSON.stringify({ message: "q" }), 400],
    [JSON.stringify({ conversationId: "c", message: "" }), 400],
    [JSON.stringify({ conversationId: "c", message: "q", locale: "vi" }), 400],
    [JSON.stringify({ conversationId: "c", message: "q", context: [] }), 400],
  ])("rejects body %s with %i validation_error", async (body, statusCode) => {
    srv = await startServer();
    const res = await fetch(`${srv.base}/v1/chat`, { method: "POST", headers: authHeaders(), body });
    expect(res.status).toBe(statusCode);
    expect(await res.json()).toMatchObject({ code: "validation_error" });
  });

  it("rejects an unknown mock scenario with the list of known ones", async () => {
    srv = await startServer();
    const res = await chat(srv.base, { message: "/mock:nope" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("unknown_mock_scenario");
    expect(body.message).toContain("doc-qa");
  });

  it.each([
    ["http-400", 400, "validation_error"],
    ["http-401", 401, "token_expired"],
    ["http-403", 403, "forbidden"],
    ["http-429-concurrent", 429, "concurrent_turn"],
    ["http-503", 503, "assistant_paused"],
    ["http-500", 500, "internal_error"],
  ])("trigger %s → %i %s with a requestId", async (trigger, statusCode, code) => {
    srv = await startServer();
    const res = await chat(srv.base, { message: `/mock:${trigger}` });
    expect(res.status).toBe(statusCode);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, code });
    expect(body.requestId).toMatch(/^req-/);
  });

  it("rate limit sends Retry-After", async () => {
    srv = await startServer();
    const res = await chat(srv.base, { message: "/mock:http-429-rate" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(await res.json()).toMatchObject({ code: "rate_limited", data: { retryAfterSeconds: 30 } });
  });

  it("quota exceeded carries the reset time in the body", async () => {
    srv = await startServer();
    const res = await chat(srv.base, { message: "/mock:http-429-quota" });
    const body = await res.json();
    expect(body.code).toBe("quota_exceeded");
    expect(new Date(body.data.resetAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("returns 503 while the kill switch is on", async () => {
    srv = await startServer();
    srv.state.killSwitch = true;
    const res = await chat(srv.base, { message: "/mock:doc-qa" });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "assistant_paused" });
  });

  it("refuses to write into another user's conversation", async () => {
    srv = await startServer();
    await readEvents(await chat(srv.base, { conversationId: "c-owned", message: "/mock:refusal" }, "u1"));
    const res = await chat(srv.base, { conversationId: "c-owned", message: "/mock:refusal" }, "u2");
    expect(res.status).toBe(404);
  });
});
