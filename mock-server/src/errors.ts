export interface PreStreamError {
  status: number;
  code: string;
  message: string;
  data?: unknown;
  headers?: Record<string, string>;
}

export const nextUtcMidnight = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

/** `/mock:http-*` triggers for the HTTP errors in 02 §6. Messages are for developers; the FE never shows them raw. */
export const HTTP_TRIGGERS: Record<string, (now: Date) => PreStreamError> = {
  "http-400": () => ({ status: 400, code: "validation_error", message: "Request does not match the /v1/chat schema." }),
  "http-401": () => ({ status: 401, code: "token_expired", message: "Access token expired." }),
  "http-403": () => ({ status: 403, code: "forbidden", message: "Module Assistant.Use is not granted." }),
  "http-429-rate": () => ({
    status: 429,
    code: "rate_limited",
    message: "Too many requests.",
    headers: { "Retry-After": "30" },
    data: { retryAfterSeconds: 30 },
  }),
  "http-429-concurrent": () => ({ status: 429, code: "concurrent_turn", message: "Another question is still running for this user." }),
  "http-429-quota": (now) => ({
    status: 429,
    code: "quota_exceeded",
    message: "Daily token quota exhausted.",
    data: { resetAt: nextUtcMidnight(now).toISOString() },
  }),
  "http-503": () => ({ status: 503, code: "assistant_paused", message: "The assistant is paused." }),
  "http-500": () => ({ status: 500, code: "internal_error", message: "Unexpected server error." }),
};
