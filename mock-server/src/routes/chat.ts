import { randomUUID } from "node:crypto";
import type { ChatRequest, PageContext } from "../contract.ts";
import { HTTP_TRIGGERS } from "../errors.ts";
import { authenticate, BadJsonError, fail, readJson, sendJson } from "../http.ts";
import { play } from "../player.ts";
import { pickScenarioName, SCENARIOS } from "../scenarios/index.ts";
import type { RouteContext } from "../server.ts";
import { statusFor } from "../store.ts";

type Parsed = { ok: true; value: ChatRequest } | { ok: false; error: string };

export function parseChatRequest(body: unknown): Parsed {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "Body must be a JSON object." };
  const b = body as Record<string, unknown>;
  if (typeof b.conversationId !== "string" || b.conversationId === "") return { ok: false, error: "conversationId must be a non-empty string." };
  if (typeof b.message !== "string" || b.message.trim() === "") return { ok: false, error: "message must be a non-empty string." };
  const locale = b.locale ?? "fr";
  if (locale !== "fr" && locale !== "en") return { ok: false, error: 'locale must be "fr" or "en".' };
  const context = b.context ?? {};
  if (typeof context !== "object" || context === null || Array.isArray(context)) return { ok: false, error: "context must be an object." };
  return { ok: true, value: { conversationId: b.conversationId, message: b.message, locale, context: context as PageContext } };
}

export async function handleChat({ req, res, state, delayScale, requestId }: RouteContext): Promise<void> {
  const auth = authenticate(req);
  if (auth.kind === "error") return sendJson(res, auth.status, fail(auth.code, auth.message, requestId));
  if (state.killSwitch) return sendJson(res, 503, fail("assistant_paused", "The assistant is paused.", requestId));

  let body: unknown;
  try {
    body = await readJson(req);
  } catch (err) {
    if (err instanceof BadJsonError) return sendJson(res, 400, fail("validation_error", err.message, requestId));
    throw err;
  }
  const parsed = parseChatRequest(body);
  if (!parsed.ok) return sendJson(res, 400, fail("validation_error", parsed.error, requestId));
  const { conversationId, message, locale, context } = parsed.value;

  const header = req.headers["x-mock-scenario"];
  const name = pickScenarioName(message, typeof header === "string" ? header : undefined, context);
  const trigger = HTTP_TRIGGERS[name];
  if (trigger) {
    const e = trigger(new Date());
    return sendJson(res, e.status, fail(e.code, e.message, requestId, e.data ?? null), e.headers);
  }
  const scenario = SCENARIOS[name];
  if (!scenario) {
    const known = [...Object.keys(SCENARIOS), ...Object.keys(HTTP_TRIGGERS)].join(", ");
    return sendJson(res, 400, fail("unknown_mock_scenario", `Unknown scenario "${name}". Known: ${known}.`, requestId));
  }
  if (!state.canWrite(conversationId, auth.user)) {
    return sendJson(res, 404, fail("conversation_not_found", "Conversation not found.", requestId));
  }
  if (!state.tryBeginTurn(auth.user)) {
    return sendJson(res, 429, fail("concurrent_turn", "Another question is still running for this user.", requestId));
  }

  const messageId = `m-${randomUUID()}`;
  try {
    state.append(conversationId, auth.user, { id: `m-${randomUUID()}`, role: "user", text: message, createdAt: new Date().toISOString(), requestId });
    const steps = scenario({ locale, requestId, messageId, toolRunId: `tr-${randomUUID()}`, context });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Request-Id": requestId,
    });
    res.flushHeaders();

    // Disconnect cancels the turn, as the backend does (AD-25).
    const ac = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) ac.abort();
    });

    const result = await play(steps, (frame) => res.write(frame), { scale: delayScale, signal: ac.signal });
    state.append(conversationId, auth.user, {
      id: messageId,
      role: "assistant",
      text: result.text,
      status: statusFor(result),
      createdAt: new Date().toISOString(),
      requestId,
    });
  } finally {
    state.endTurn(auth.user);
    if (!res.writableEnded) res.end();
  }
}
