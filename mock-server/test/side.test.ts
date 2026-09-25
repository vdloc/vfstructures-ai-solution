import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeaders, chat, readEvents, startServer, type TestServer } from "./helpers.ts";

let srv: TestServer;
beforeEach(async () => {
  srv = await startServer();
});
afterEach(async () => {
  await srv.close();
});

const get = (path: string, user = "dev-user") => fetch(`${srv.base}${path}`, { headers: authHeaders(user) });
const post = (path: string, body: unknown, user = "dev-user") =>
  fetch(`${srv.base}${path}`, { method: "POST", headers: authHeaders(user), body: JSON.stringify(body) });

describe("GET /v1/conversations/{id}", () => {
  it("returns the owner's messages with status", async () => {
    await readEvents(await chat(srv.base, { conversationId: "c-1", message: "/mock:refusal" }));
    const res = await get("/v1/conversations/c-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.conversationId).toBe("c-1");
    expect(body.data.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    expect(body.data.messages[1].status).toBe("refused");
  });

  it("hides other users' conversations and missing ones behind 404", async () => {
    await readEvents(await chat(srv.base, { conversationId: "c-1", message: "/mock:refusal" }));
    expect((await get("/v1/conversations/c-1", "someone-else")).status).toBe(404);
    expect((await get("/v1/conversations/c-missing")).status).toBe(404);
  });

  it("requires auth", async () => {
    expect((await fetch(`${srv.base}/v1/conversations/c-1`)).status).toBe(401);
  });
});

describe("POST /v1/feedback", () => {
  it("records a rating and answers 204", async () => {
    const res = await post("/v1/feedback", { messageId: "m-1", rating: "down", comment: "Wrong clause" });
    expect(res.status).toBe(204);
    expect(srv.state.feedback).toEqual([{ user: "dev-user", messageId: "m-1", rating: "down", comment: "Wrong clause" }]);
  });

  it.each([[{ messageId: "m-1", rating: "meh" }], [{ rating: "up" }], ["nope"]])("rejects %j with 400", async (body) => {
    expect((await post("/v1/feedback", body)).status).toBe(400);
  });
});

describe("POST /v1/approvals/{toolRunId}", () => {
  it("is idempotent per toolRunId", async () => {
    const a = await (await post("/v1/approvals/tr-1", {})).json();
    const b = await (await post("/v1/approvals/tr-1", {})).json();
    const c = await (await post("/v1/approvals/tr-2", {})).json();
    expect(a.data.caseId).toMatch(/^case-/);
    expect(b.data.caseId).toBe(a.data.caseId);
    expect(c.data.caseId).not.toBe(a.data.caseId);
  });
});

describe("GET /v1/capabilities and mock controls", () => {
  it("reports model, tools, corpus version and toggles set through /__mock/state", async () => {
    let caps = (await (await get("/v1/capabilities")).json()).data;
    expect(caps).toMatchObject({ killSwitch: false, fallbackActive: false });
    expect(caps.model).toBeTruthy();
    expect(caps.tools.map((t: { toolId: string }) => t.toolId)).toContain("calc.beam.shear");

    const toggled = await fetch(`${srv.base}/__mock/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ killSwitch: true, fallbackActive: true }),
    });
    expect(toggled.status).toBe(200);
    caps = (await (await get("/v1/capabilities")).json()).data;
    expect(caps).toMatchObject({ killSwitch: true, fallbackActive: true });
  });

  it("/__mock/reset clears state", async () => {
    await readEvents(await chat(srv.base, { conversationId: "c-1", message: "/mock:refusal" }));
    srv.state.killSwitch = true;
    expect(srv.state.conversations.size).toBe(1);
    expect((await fetch(`${srv.base}/__mock/reset`, { method: "POST" })).status).toBe(204);
    expect(srv.state.killSwitch).toBe(false);
    expect(srv.state.conversations.size).toBe(0);
  });
});

describe("/v1/admin/corpus/*", () => {
  it("is declared out of scope with 501 not_mocked", async () => {
    const res = await get("/v1/admin/corpus/documents");
    expect(res.status).toBe(501);
    expect(await res.json()).toMatchObject({ code: "not_mocked" });
  });
});
