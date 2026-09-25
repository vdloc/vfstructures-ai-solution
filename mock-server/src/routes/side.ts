import { randomUUID } from "node:crypto";
import { authenticate, BadJsonError, fail, ok, readJson, sendJson } from "../http.ts";
import type { Route, RouteContext } from "../server.ts";

/** Runs `next` only for an authenticated user; otherwise answers 401/403. */
function authed(next: (ctx: RouteContext, params: string[], user: string) => void | Promise<void>): Route["handle"] {
  return (ctx, params) => {
    const auth = authenticate(ctx.req);
    if (auth.kind === "error") return sendJson(ctx.res, auth.status, fail(auth.code, auth.message, ctx.requestId));
    return next(ctx, params, auth.user);
  };
}

async function jsonBody(ctx: RouteContext): Promise<unknown | undefined> {
  try {
    return await readJson(ctx.req);
  } catch (err) {
    if (!(err instanceof BadJsonError)) throw err;
    sendJson(ctx.res, 400, fail("validation_error", err.message, ctx.requestId));
    return undefined;
  }
}

const TOOLS = [
  { toolId: "calc.beam.shear", version: "3.2.0" },
  { toolId: "calc.beam.flexure", version: "3.2.0" },
  { toolId: "search_documents", version: "1.0.0" },
  { toolId: "find_similar_cases", version: "1.0.0" },
];

export const SIDE_ROUTES: Route[] = [
  {
    method: "GET",
    pattern: /^\/v1\/conversations\/([^/]+)$/,
    handle: authed(({ res, state, requestId }, [id], user) => {
      const c = state.read(id!, user);
      if (!c) return sendJson(res, 404, fail("conversation_not_found", "Conversation not found.", requestId));
      sendJson(res, 200, ok({ conversationId: c.id, messages: c.messages }, requestId));
    }),
  },
  {
    method: "POST",
    pattern: /^\/v1\/feedback$/,
    handle: authed(async (ctx, _params, user) => {
      const body = await jsonBody(ctx);
      if (body === undefined) return;
      const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
      if (typeof b.messageId !== "string" || (b.rating !== "up" && b.rating !== "down")) {
        return sendJson(ctx.res, 400, fail("validation_error", 'Expected { messageId, rating: "up" | "down", comment? }.', ctx.requestId));
      }
      ctx.state.feedback.push({
        user,
        messageId: b.messageId,
        rating: b.rating,
        ...(typeof b.comment === "string" ? { comment: b.comment } : {}),
      });
      ctx.res.writeHead(204).end();
    }),
  },
  {
    method: "POST",
    pattern: /^\/v1\/approvals\/([^/]+)$/,
    handle: authed(({ res, state, requestId }, [toolRunId]) => {
      let caseId = state.approvals.get(toolRunId!);
      if (!caseId) {
        caseId = `case-${randomUUID()}`;
        state.approvals.set(toolRunId!, caseId);
      }
      sendJson(res, 200, ok({ caseId }, requestId));
    }),
  },
  {
    method: "GET",
    pattern: /^\/v1\/capabilities$/,
    handle: authed(({ res, state, requestId }) =>
      sendJson(
        res,
        200,
        ok(
          {
            model: "Claude Sonnet 5",
            fallbackModel: "Claude Haiku 4.5",
            fallbackActive: state.fallbackActive,
            tools: TOOLS,
            corpusVersion: "2026-09-01",
            killSwitch: state.killSwitch,
          },
          requestId,
        ),
      ),
    ),
  },
  ...(["GET", "POST"] as const).map(
    (method): Route => ({
      method,
      pattern: /^\/v1\/admin\/corpus(?:\/.*)?$/,
      handle: ({ res, requestId }) =>
        sendJson(res, 501, fail("not_mocked", "The corpus admin API is out of scope for this mock.", requestId)),
    }),
  ),
  {
    method: "POST",
    pattern: /^\/__mock\/state$/,
    handle: async (ctx) => {
      const body = await jsonBody(ctx);
      if (body === undefined) return;
      const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
      if (typeof b.killSwitch === "boolean") ctx.state.killSwitch = b.killSwitch;
      if (typeof b.fallbackActive === "boolean") ctx.state.fallbackActive = b.fallbackActive;
      sendJson(ctx.res, 200, { killSwitch: ctx.state.killSwitch, fallbackActive: ctx.state.fallbackActive });
    },
  },
  {
    method: "POST",
    pattern: /^\/__mock\/reset$/,
    handle: ({ res, state }) => {
      state.reset();
      res.writeHead(204).end();
    },
  },
];
