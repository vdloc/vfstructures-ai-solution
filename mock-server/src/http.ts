import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiResponse } from "./contract.ts";

export const newRequestId = (): string => `req-${randomUUID()}`;

export const ok = <T>(data: T, requestId: string): ApiResponse<T> => ({
  success: true,
  code: "ok",
  message: "",
  data,
  requestId,
});

export const fail = (code: string, message: string, requestId: string, data: unknown = null): ApiResponse<unknown> => ({
  success: false,
  code,
  message,
  data,
  requestId,
});

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(Buffer.byteLength(payload)),
    ...headers,
  });
  res.end(payload);
}

export class BadJsonError extends Error {}

export async function readJson(req: IncomingMessage, limitBytes = 256 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > limitBytes) throw new BadJsonError("Body too large.");
    chunks.push(buf);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BadJsonError("Body is not valid JSON.");
  }
}

export type AuthResult =
  | { kind: "ok"; user: string }
  | { kind: "error"; status: 401 | 403; code: string; message: string };

/**
 * The mock does not validate JWTs. The bearer value is the user id, and two
 * reserved values let the FE exercise the refresh (401) and hide-panel (403) paths.
 */
export function authenticate(req: IncomingMessage): AuthResult {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "");
  if (!match) return { kind: "error", status: 401, code: "unauthorized", message: "Missing or malformed bearer token." };
  const token = match[1]!;
  if (token === "expired") return { kind: "error", status: 401, code: "token_expired", message: "Access token expired." };
  if (token === "no-assistant") return { kind: "error", status: 403, code: "forbidden", message: "Module Assistant.Use is not granted." };
  return { kind: "ok", user: token };
}
