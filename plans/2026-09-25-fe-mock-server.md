# Assistant.Api Mock Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone mock of `Assistant.Api` `/v1` that plays every SSE scenario, pre-stream HTTP error and side endpoint the Frontend needs, so the whole AI panel can be built and tested before the Backend runs.

**Architecture:** One Node 22 + TypeScript service in `mock-server/`, built on plain `node:http` with no framework. The FE's Next.js BFF points `ASSISTANT_URL` at it, so the BFF's `req.signal` forwarding and unbuffered streaming get exercised too. Scenarios are pure functions that return timed event lists. A player writes them as SSE frames with real delays, scaled by an env multiplier (0 in tests). A small in-memory state holds conversations, the per-user active-turn lock, approvals and toggles.

**Tech Stack:** Node 22, TypeScript 5 (`tsx` runner, no build step), vitest 3, pnpm 10.

**Spec:** `/home/vdloc/Documents/vfstructures-ai-solution/ship/02-hop-dong.md` (the contract, primary). Also read `ship/04-frontend.md` (FE states), `ship/07-giao-dien.md` (UI states) and `ship/12-tra-case.md` §1, §4, §9 (case shape).

## Global Constraints

- Paths are `/v1/...` exactly as in 02 §1. Response JSON follows `ApiResponse<T>`.
- The SSE response has `Content-Type: text/event-stream` and `X-Accel-Buffering: no`. Frames are separated by a blank line, and the server flushes after every event.
- There are 11 event names: `status`, `retrieval`, `token`, `tool_call`, `tool_result`, `approval_required`, `citation`, `refusal`, `warning`, `error`, `done`.
- The four valid sequences, verbatim from 02 §4:
  - `doc_qa : status → retrieval → token×n → citation → done`
  - `calc : status → status → tool_call → tool_result → token×n → citation → done`
  - `refusal : status → refusal → done ← KHÔNG có token nào`
  - `error : status → retrieval → token×3 → error`
- `retrieval` = `{ chunks: [{docId,title,page,clause}], scores }`. The `case_lookup` branch adds `params: [{key,value,unit,source,confirmed}]`.
- `citation` = `[{ n, docId, page, clause, quote, bbox? }]`. This is a JSON array, not an object.
- `token` = `{ text, risk? }` with `risk ∈ unverified | mismatch`. Sentences that contain numbers or verdict wording arrive as one whole token (AD-30).
- `error` = `{ code, retryable, partial, requestId }`. `retryable` and `requestId` are always present. The stream `error.code` values are `internalServerException`, `runtimeClientError`, `validationException`, `throttled` and `quotaExceeded`.
- `done` = `{ messageId, usage }`, where `usage` = `{ inputTokens, outputTokens, totalTokens, cacheReadInputTokens, cacheWriteInputTokens, latencyMs }`.
- `warning` arrives **after** the last `token`. Known codes: `unverified_number`, `unverified_citation`, `standard_version_mismatch`, `degraded_retrieval_only`, `degraded_routing`, `truncated`, `unverified_verdict`.
- The verdict lives in `tool_result.outputs.verdict` = `{ "pass": true, "field": "utilization", "value": 0.87 }`. When a tool has no verdict, the block is absent.
- `approval_required` is not emitted by default (v1.2 / AD-28). It is available only as an opt-in scenario.
- Latency targets at delay scale 1: first `status` ≲ 300 ms, `retrieval` ≲ 1.5 s, first `token` ≲ 3 s. Replay must use real delays and never flush everything at once.
- Every error carries a `requestId`.
- The UI languages are French (default) and English only (GĐ-1). The mock chooses fixture text by `locale`, and **no Vietnamese text appears in any payload**. Citation `quote`s stay in French in both locales (07 §8).
- `context` is untrusted. The mock never uses it for authorization; identity comes from the Bearer token only.
- Every shell command in this plan is prefixed with `rtk` (repo AGENTS.md).

## Open questions for BE/FE sign-off (mock-only assumptions)

The contract is silent on the points below. The mock picks one answer for each and marks it `MOCK-ONLY` in code. Nothing here may be presented to the FE as contract. Each point goes to the BE/FE re-sign meeting.

1. **`ApiResponse<T>` field names.** The mock uses `{ success, code, message, data, requestId }`.
2. **`status.phase` values.** The mock uses `routing | planning | retrieving | calculating | writing`.
3. **`bbox` format.** The mock uses `[x0, y0, x1, y1]` as fractions of the page, with the origin at the top left.
4. **Case lookup "Tra" re-submit.** The request has no field for confirmed chips. The mock accepts `context.caseParams: [{key,value,unit}]` on the next `POST /v1/chat`.
5. **How case results arrive.** The mock sends `tool_call { toolId: "find_similar_cases" }` → `tool_result { outputs: { cases: [...] } }`. `tool_result` has no `toolId`, so the FE pairs it with the preceding `tool_call`.
6. **Fewer than 2 params.** The mock sends `status → retrieval{params: 1 item} → done`, and the FE shows the missing-param input.
7. **"Case older than current standard" flag.** The mock adds `isCurrentStandard: boolean` on each case.
8. **`GET /v1/conversations/{id}` shape.** The mock returns `{ conversationId, messages: [{ id, role, text, status?, createdAt, requestId? }] }`, with `status ∈ completed | completed_unverified | refused | errored | aborted`.
9. **`POST /v1/feedback` body.** The mock expects `{ messageId, rating: "up" | "down", comment? }`.
10. **`GET /v1/capabilities` shape.** The mock returns `{ model, fallbackModel, fallbackActive, tools: [{toolId, version}], corpusVersion, killSwitch }`.
11. **`GET /v1/sources/{docId}` shape.** The mock returns `{ docId, title, edition, url, page, expiresAt, highlight: { page, bbox } | null }`.
12. **`/v1/admin/corpus/*`.** This is **out of scope**, because the admin page is not part of the chat panel and the contract gives no shapes. The mock answers `501 not_mocked`.

## Review Focus

1. **Events arrive spaced out over time, not in one flush.** An FE dev sees text grow gradually. Test: Task 6, "streams events over time, not in one flush".
2. **Client disconnect mid-turn.** Nothing more is written, the stored message has `status: "aborted"` with its partial text, and the user's lock is released so the next question works. Test: Task 6, "stores an aborted message and releases the lock when the client disconnects".
3. **A second concurrent turn for the same user gets `429 concurrent_turn`,** while a different user is not blocked. Test: Task 6, "rejects a second concurrent turn for the same user only".
4. **A refusal stream contains zero `token` events,** both in the fixture and on the wire. Tests: Task 4 invariants, plus Task 6, "refusal reaches the client with no token event".
5. **`warning` arrives strictly after the last `token`, including the unknown code.** Test: the Task 4 invariant `checkInvariants`, which runs over every scenario in both locales. Task 5 scenarios are covered automatically.

---

## File structure

```
mock-server/
  package.json            scripts, dev deps
  tsconfig.json
  README.md               (Vietnamese) run, wire BFF, scenario triggers, open questions
  scripts/acceptance.sh   curl -N acceptance mirroring 02 §7
  src/
    contract.ts           all /v1 types; MOCK-ONLY assumptions marked
    sse.ts                formatSseEvent
    player.ts             Step, sleep, play (timed, abortable)
    store.ts              MockState: conversations, turn lock, approvals, feedback, toggles; statusFor
    http.ts               requestId, ApiResponse helpers, sendJson, readJson, authenticate
    server.ts             router + createMockServer
    main.ts               env → listen
    documents.ts          mock document catalogue + highlight boxes
    pdf.ts                tiny multi-page PDF generator
    errors.ts             pre-stream HTTP error triggers
    scenarios/
      build.ts            ScenarioContext, delays, step helpers
      docs.ts             doc_qa / refusal / error / warning scenarios
      tools.ts            calc / risk / mixed / approval / case scenarios
      index.ts            SCENARIOS registry + pickScenarioName
    routes/
      chat.ts             POST /v1/chat
      side.ts             conversations, feedback, approvals, capabilities, admin, __mock
      sources.ts          GET /v1/sources/{docId}, GET /__mock/files/{docId}.pdf
  test/
    helpers.ts
    scenario-invariants.ts
    *.test.ts
```

---

### Task 1: Scaffold, contract types, SSE framing

**Files:**
- Create: `mock-server/package.json`, `mock-server/tsconfig.json`, `mock-server/src/contract.ts`, `mock-server/src/sse.ts`
- Modify: `.gitignore` (append `node_modules/`)
- Test: `mock-server/test/sse.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: every type in `contract.ts` (`EventName`, `AnyEvent`, `EventDataMap`, `Locale`, `Phase`, `Chunk`, `CaseParam`, `CaseParamInput`, `CaseRecord`, `CitationItem`, `BBox`, `Risk`, `Verdict`, `PageContext`, `ChatRequest`, `ApiResponse<T>`, `StreamErrorCode`, `Usage`, `KNOWN_WARNING_CODES`, `EVENT_NAMES`), plus `formatSseEvent(event: string, data: unknown): string`

- [ ] **Step 1: Create package and config**

`mock-server/package.json`:

```json
{
  "name": "vfs-assistant-mock",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "start": "tsx src/main.ts",
    "dev": "tsx watch src/main.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "pnpm": { "onlyBuiltDependencies": ["esbuild"] }
}
```

`mock-server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm add -D typescript@^5 tsx@^4 vitest@^3 @types/node@^22`
Expected: `node_modules/` and `pnpm-lock.yaml` are created.

Append `node_modules/` as a new line to `/home/vdloc/Documents/vfstructures-ai-solution/.gitignore`.

- [ ] **Step 2: Write the failing test**

`mock-server/test/sse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EVENT_NAMES } from "../src/contract.ts";
import { formatSseEvent } from "../src/sse.ts";

describe("formatSseEvent", () => {
  it("writes one event frame terminated by a blank line", () => {
    expect(formatSseEvent("status", { phase: "routing", text: "Analyse…" })).toBe(
      'event: status\ndata: {"phase":"routing","text":"Analyse…"}\n\n',
    );
  });

  it("keeps multi-line text on a single data line", () => {
    const frame = formatSseEvent("token", { text: "a\nb" });
    expect(frame.split("\n\n")).toEqual([expect.any(String), ""]);
    expect(frame).toContain('"a\\nb"');
  });

  it("serialises array payloads such as citation as-is", () => {
    expect(formatSseEvent("citation", [{ n: 1 }])).toBe('event: citation\ndata: [{"n":1}]\n\n');
  });
});

describe("contract", () => {
  it("declares exactly the 11 events of the contract", () => {
    expect(EVENT_NAMES).toHaveLength(11);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/sse.test.ts`
Expected: FAIL. The imports of `../src/contract.ts` and `../src/sse.ts` do not resolve.

- [ ] **Step 4: Write the implementation**

`mock-server/src/contract.ts`:

```ts
// Types for the /v1 contract in ship/02-hop-dong.md.
// Anything marked MOCK-ONLY is an assumption this mock makes where the contract
// is silent. The list lives in mock-server/README.md, "Câu hỏi mở".

export const EVENT_NAMES = [
  "status",
  "retrieval",
  "token",
  "tool_call",
  "tool_result",
  "approval_required",
  "citation",
  "refusal",
  "warning",
  "error",
  "done",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export type Locale = "fr" | "en";

/** MOCK-ONLY: the contract names `phase` but defines no values. */
export type Phase = "routing" | "planning" | "retrieving" | "calculating" | "writing";

export interface StatusData {
  phase: Phase;
  text: string;
}

export interface Chunk {
  docId: string;
  title: string;
  page: number;
  clause: string;
}

export type ParamSource = "tool_run" | "pageContext" | "case_hints";

export interface CaseParam {
  key: string;
  value: number;
  unit: string;
  source: ParamSource;
  confirmed: boolean;
}

export interface RetrievalData {
  chunks: Chunk[];
  scores: number[];
  params?: CaseParam[];
}

export type Risk = "unverified" | "mismatch";

export interface TokenData {
  text: string;
  risk?: Risk;
}

export interface ToolCallData {
  toolId: string;
  version: string;
  inputs: Record<string, unknown>;
}

export interface Verdict {
  pass: boolean;
  field: string;
  value: number;
}

export interface ToolResultData {
  toolRunId: string;
  outputs: Record<string, unknown> & { verdict?: Verdict };
  units: Record<string, string>;
  standard: string;
}

export interface ApprovalRequiredData {
  toolRunId: string;
  summary: string;
}

/** MOCK-ONLY: [x0, y0, x1, y1] as fractions of the page, origin top-left. */
export type BBox = [number, number, number, number];

export interface CitationItem {
  n: number;
  docId: string;
  page: number;
  clause: string;
  quote: string;
  bbox?: BBox;
}

export interface RefusalData {
  reason: string;
  suggestion: string;
}

export const KNOWN_WARNING_CODES = [
  "unverified_number",
  "unverified_citation",
  "standard_version_mismatch",
  "degraded_retrieval_only",
  "degraded_routing",
  "truncated",
  "unverified_verdict",
] as const;

export interface WarningData {
  code: string;
}

export type StreamErrorCode =
  | "internalServerException"
  | "runtimeClientError"
  | "validationException"
  | "throttled"
  | "quotaExceeded";

export interface ErrorData {
  code: StreamErrorCode;
  retryable: boolean;
  partial: boolean;
  requestId: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadInputTokens: number;
  cacheWriteInputTokens: number;
  latencyMs: number;
}

export interface DoneData {
  messageId: string;
  usage: Usage;
}

export interface EventDataMap {
  status: StatusData;
  retrieval: RetrievalData;
  token: TokenData;
  tool_call: ToolCallData;
  tool_result: ToolResultData;
  approval_required: ApprovalRequiredData;
  citation: CitationItem[];
  refusal: RefusalData;
  warning: WarningData;
  error: ErrorData;
  done: DoneData;
}

export type AnyEvent = { [K in EventName]: { event: K; data: EventDataMap[K] } }[EventName];

/** MOCK-ONLY: how confirmed chips reach the backend when the user presses "Tra". */
export interface CaseParamInput {
  key: string;
  value: number;
  unit: string;
}

/** Case shape from ship/12-tra-case.md §1. `caseId`, `last_seen_at` and `isCurrentStandard` are MOCK-ONLY names. */
export interface CaseRecord {
  caseId: string;
  tool_id: string;
  tool_version: string;
  element_type: string;
  params: Record<string, number>;
  units: Record<string, string>;
  result: Record<string, number>;
  verdict: "pass";
  standard_ref: string;
  use_count: number;
  last_seen_at: string;
  isCurrentStandard: boolean;
}

export interface PageContext {
  module?: string;
  projectId?: string;
  memberId?: string;
  selectedElementIds?: string[];
  activeView?: string;
  unitSystem?: "metric" | "imperial";
  codeStandard?: string;
  hasResult?: boolean;
  resultKind?: string;
  calcAt?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  /** MOCK-ONLY, see CaseParamInput. */
  caseParams?: CaseParamInput[];
}

export interface ChatRequest {
  conversationId: string;
  message: string;
  locale: Locale;
  context: PageContext;
}

/** MOCK-ONLY field names: the contract says "ApiResponse<T> of Payment API" without the shape. */
export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T | null;
  requestId: string;
}
```

`mock-server/src/sse.ts`:

```ts
/** One SSE frame. JSON.stringify never emits a raw newline, so one data line is always enough. */
export function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/sse.test.ts && rtk pnpm typecheck`
Expected: 4 tests PASS, and tsc exits 0.

- [ ] **Step 6: Commit**

```bash
cd /home/vdloc/Documents/vfstructures-ai-solution
rtk git add .gitignore mock-server/package.json mock-server/pnpm-lock.yaml mock-server/tsconfig.json mock-server/src/contract.ts mock-server/src/sse.ts mock-server/test/sse.test.ts
rtk git commit -m "feat(mock): scaffold Assistant.Api mock with contract types and SSE framing"
```

---

### Task 2: Timed, abortable scenario player

**Files:**
- Create: `mock-server/src/player.ts`
- Test: `mock-server/test/player.test.ts`

**Interfaces:**
- Consumes: `AnyEvent`, `EventName` from `contract.ts`; `formatSseEvent` from `sse.ts`
- Produces:
  - `type Step = AnyEvent & { delayMs: number }`
  - `sleep(ms: number, signal: AbortSignal): Promise<void>`, which rejects on abort
  - `interface PlayResult { outcome: "completed" | "aborted"; text: string; emitted: EventName[] }`
  - `play(steps: Step[], write: (frame: string) => void, opts: { scale: number; signal: AbortSignal }): Promise<PlayResult>`

- [ ] **Step 1: Write the failing test**

`mock-server/test/player.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { play, sleep, type Step } from "../src/player.ts";

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2, cacheReadInputTokens: 0, cacheWriteInputTokens: 0, latencyMs: 40 };
const steps: Step[] = [
  { delayMs: 10, event: "status", data: { phase: "routing", text: "…" } },
  { delayMs: 10, event: "token", data: { text: "Hello " } },
  { delayMs: 10, event: "token", data: { text: "world" } },
  { delayMs: 10, event: "done", data: { messageId: "m-1", usage } },
];

describe("play", () => {
  it("writes every step in order and returns the token text", async () => {
    const frames: string[] = [];
    const result = await play(steps, (f) => frames.push(f), { scale: 0, signal: new AbortController().signal });
    expect(result).toEqual({ outcome: "completed", text: "Hello world", emitted: ["status", "token", "token", "done"] });
    expect(frames.map((f) => f.split("\n")[0])).toEqual(["event: status", "event: token", "event: token", "event: done"]);
  });

  it("waits delayMs × scale before each step", async () => {
    const start = performance.now();
    await play(steps, () => {}, { scale: 2, signal: new AbortController().signal });
    expect(performance.now() - start).toBeGreaterThanOrEqual(75);
  });

  it("stops writing as soon as the signal aborts and keeps the partial text", async () => {
    const ac = new AbortController();
    const frames: string[] = [];
    const result = await play(
      steps,
      (f) => {
        frames.push(f);
        if (frames.length === 2) ac.abort();
      },
      { scale: 1, signal: ac.signal },
    );
    expect(result).toEqual({ outcome: "aborted", text: "Hello ", emitted: ["status", "token"] });
    expect(frames).toHaveLength(2);
  });

  it("writes nothing when the signal is already aborted, even at scale 0", async () => {
    const ac = new AbortController();
    ac.abort();
    const frames: string[] = [];
    const result = await play(steps, (f) => frames.push(f), { scale: 0, signal: ac.signal });
    expect(result.outcome).toBe("aborted");
    expect(frames).toEqual([]);
  });
});

describe("sleep", () => {
  it("rejects when aborted", async () => {
    const ac = new AbortController();
    const pending = sleep(1000, ac.signal);
    ac.abort();
    await expect(pending).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/player.test.ts`
Expected: FAIL. `../src/player.ts` does not exist.

- [ ] **Step 3: Write the implementation**

`mock-server/src/player.ts`:

```ts
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
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/player.test.ts && rtk pnpm typecheck`
Expected: 5 tests PASS, and tsc exits 0.

- [ ] **Step 5: Commit**

```bash
cd /home/vdloc/Documents/vfstructures-ai-solution
rtk git add mock-server/src/player.ts mock-server/test/player.test.ts
rtk git commit -m "feat(mock): add timed, abortable SSE scenario player"
```

---

### Task 3: State store and HTTP skeleton

**Files:**
- Create: `mock-server/src/store.ts`, `mock-server/src/http.ts`, `mock-server/src/server.ts`, `mock-server/src/main.ts`, `mock-server/test/helpers.ts`
- Test: `mock-server/test/store.test.ts`, `mock-server/test/server.test.ts`

**Interfaces:**
- Consumes: `PlayResult` from `player.ts`; `ApiResponse` from `contract.ts`
- Produces:
  - `store.ts`: `type MessageStatus`, `interface StoredMessage`, `interface Conversation`, `interface FeedbackRecord`, and `class MockState` with fields `conversations`, `activeTurns`, `approvals`, `feedback`, `killSwitch`, `fallbackActive` and methods `tryBeginTurn(user)`, `endTurn(user)`, `canWrite(conversationId, user)`, `append(conversationId, user, message)`, `read(conversationId, user)`, `findMessage(messageId)`, `reset()`. Also `statusFor(result: PlayResult): MessageStatus`.
  - `http.ts`: `newRequestId()`, `ok(data, requestId)`, `fail(code, message, requestId, data?)`, `sendJson(res, status, body, headers?)`, `class BadJsonError`, `readJson(req)`, `type AuthResult`, `authenticate(req)`
  - `server.ts`: `interface MockServerOptions { delayScale: number; state?: MockState }`, `interface RouteContext { req; res; url; state; delayScale; requestId }`, `interface Route`, the exported mutable array `ROUTES: Route[]` (later tasks push into it from their own modules), and `createMockServer(options): http.Server`
  - `test/helpers.ts`: `startServer(options?) → { base, state, close }`, `authHeaders(user?)`

- [ ] **Step 1: Write the failing tests**

`mock-server/test/store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MockState, statusFor } from "../src/store.ts";

const msg = (id: string) => ({ id, role: "user" as const, text: "q", createdAt: "2026-09-25T00:00:00Z" });

describe("MockState", () => {
  it("allows one active turn per user", () => {
    const s = new MockState();
    expect(s.tryBeginTurn("u1")).toBe(true);
    expect(s.tryBeginTurn("u1")).toBe(false);
    expect(s.tryBeginTurn("u2")).toBe(true);
    s.endTurn("u1");
    expect(s.tryBeginTurn("u1")).toBe(true);
  });

  it("keeps conversations private to their owner", () => {
    const s = new MockState();
    s.append("c-1", "u1", msg("m-1"));
    expect(s.read("c-1", "u1")?.messages).toHaveLength(1);
    expect(s.read("c-1", "u2")).toBeUndefined();
    expect(s.canWrite("c-1", "u2")).toBe(false);
    expect(s.canWrite("c-new", "u2")).toBe(true);
    expect(() => s.append("c-1", "u2", msg("m-2"))).toThrow();
  });

  it("finds a message by id across conversations", () => {
    const s = new MockState();
    s.append("c-1", "u1", msg("m-1"));
    expect(s.findMessage("m-1")?.text).toBe("q");
    expect(s.findMessage("m-x")).toBeUndefined();
  });

  it("reset clears everything", () => {
    const s = new MockState();
    s.append("c-1", "u1", msg("m-1"));
    s.tryBeginTurn("u1");
    s.killSwitch = true;
    s.reset();
    expect(s.conversations.size).toBe(0);
    expect(s.activeTurns.size).toBe(0);
    expect(s.killSwitch).toBe(false);
  });
});

describe("statusFor", () => {
  it.each([
    [{ outcome: "aborted", text: "", emitted: ["status"] }, "aborted"],
    [{ outcome: "completed", text: "a", emitted: ["status", "token", "error"] }, "errored"],
    [{ outcome: "completed", text: "", emitted: ["status", "refusal", "done"] }, "refused"],
    [{ outcome: "completed", text: "a", emitted: ["status", "token", "warning", "done"] }, "completed_unverified"],
    [{ outcome: "completed", text: "a", emitted: ["status", "token", "done"] }, "completed"],
  ] as const)("maps %j to %s", (result, expected) => {
    expect(statusFor({ ...result, emitted: [...result.emitted] })).toBe(expected);
  });
});
```

`mock-server/test/helpers.ts`:

```ts
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
```

`mock-server/test/server.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/store.test.ts test/server.test.ts`
Expected: FAIL. `../src/store.ts`, `../src/http.ts` and `../src/server.ts` do not exist.

- [ ] **Step 3: Write the implementation**

`mock-server/src/store.ts`:

```ts
import type { PlayResult } from "./player.ts";

/** MOCK-ONLY status names for GET /v1/conversations/{id}. `aborted` is from 02 §7. */
export type MessageStatus = "completed" | "completed_unverified" | "refused" | "errored" | "aborted";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: MessageStatus;
  createdAt: string;
  requestId?: string;
}

export interface Conversation {
  id: string;
  owner: string;
  messages: StoredMessage[];
}

export interface FeedbackRecord {
  user: string;
  messageId: string;
  rating: "up" | "down";
  comment?: string;
}

export class MockState {
  readonly conversations = new Map<string, Conversation>();
  readonly activeTurns = new Set<string>();
  readonly approvals = new Map<string, string>();
  readonly feedback: FeedbackRecord[] = [];
  killSwitch = false;
  fallbackActive = false;

  /** Server-side guard of AD-23: one running turn per user. */
  tryBeginTurn(user: string): boolean {
    if (this.activeTurns.has(user)) return false;
    this.activeTurns.add(user);
    return true;
  }

  endTurn(user: string): void {
    this.activeTurns.delete(user);
  }

  canWrite(conversationId: string, user: string): boolean {
    const c = this.conversations.get(conversationId);
    return !c || c.owner === user;
  }

  append(conversationId: string, user: string, message: StoredMessage): void {
    let c = this.conversations.get(conversationId);
    if (!c) {
      c = { id: conversationId, owner: user, messages: [] };
      this.conversations.set(conversationId, c);
    }
    if (c.owner !== user) throw new Error(`conversation ${conversationId} belongs to another user`);
    c.messages.push(message);
  }

  read(conversationId: string, user: string): Conversation | undefined {
    const c = this.conversations.get(conversationId);
    return c && c.owner === user ? c : undefined;
  }

  findMessage(messageId: string): StoredMessage | undefined {
    for (const c of this.conversations.values()) {
      const m = c.messages.find((x) => x.id === messageId);
      if (m) return m;
    }
    return undefined;
  }

  reset(): void {
    this.conversations.clear();
    this.activeTurns.clear();
    this.approvals.clear();
    this.feedback.length = 0;
    this.killSwitch = false;
    this.fallbackActive = false;
  }
}

export function statusFor(result: PlayResult): MessageStatus {
  if (result.outcome === "aborted") return "aborted";
  if (result.emitted.includes("error")) return "errored";
  if (result.emitted.includes("refusal")) return "refused";
  if (result.emitted.includes("warning")) return "completed_unverified";
  return "completed";
}
```

`mock-server/src/http.ts`:

```ts
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
```

`mock-server/src/server.ts`:

```ts
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { fail, newRequestId, sendJson } from "./http.ts";
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
```

`mock-server/src/main.ts`:

```ts
import { createMockServer } from "./server.ts";

const port = Number(process.env.PORT ?? 8787);
const delayScale = Number(process.env.MOCK_DELAY_SCALE ?? 1);
if (!Number.isFinite(delayScale) || delayScale < 0) throw new Error("MOCK_DELAY_SCALE must be a number >= 0");

createMockServer({ delayScale }).listen(port, () => {
  console.log(`Assistant.Api mock listening on http://localhost:${port} (delay scale ${delayScale})`);
});
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run && rtk pnpm typecheck`
Expected: all tests PASS, and tsc exits 0.

- [ ] **Step 5: Smoke-run the server**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && (PORT=8799 timeout 3 pnpm start &) ; sleep 1.5; rtk curl -s http://localhost:8799/health/live`
Expected: `{"status":"live"}`

- [ ] **Step 6: Commit**

```bash
cd /home/vdloc/Documents/vfstructures-ai-solution
rtk git add mock-server/src/store.ts mock-server/src/http.ts mock-server/src/server.ts mock-server/src/main.ts mock-server/test/helpers.ts mock-server/test/store.test.ts mock-server/test/server.test.ts
rtk git commit -m "feat(mock): add state store, auth and HTTP router skeleton"
```

---

### Task 4: Document catalogue, document scenarios, registry and contract invariants

**Files:**
- Create: `mock-server/src/documents.ts`, `mock-server/src/scenarios/build.ts`, `mock-server/src/scenarios/docs.ts`, `mock-server/src/scenarios/index.ts`, `mock-server/test/scenario-invariants.ts`
- Test: `mock-server/test/scenarios-docs.test.ts`

**Interfaces:**
- Consumes: `Step` from `player.ts`; the types from `contract.ts`
- Produces:
  - `documents.ts`: `interface MockDocument { docId; title; edition; pages; restricted }`, `DOCUMENTS`, `findDocument(docId)`, `HIGHLIGHTS: Record<"docId:page", BBox>`
  - `scenarios/build.ts`: `interface ScenarioContext { locale; requestId; messageId; toolRunId; context: PageContext }`, `type Scenario = (ctx) => Step[]`, `interface Tx { fr; en }`, `tx(ctx, Tx)`, `DELAY`, `interface Segment { text; whole?; risk? }`, `status(phase, text, delayMs?)`, `answer(segments, firstDelayMs?)`, `chunk(docId, page, clause)`, `retrieval(chunks, opts?)`, `cite(n, chunk, quote)`, `citations(items)`, `warning(code)`, `streamError(ctx, code, retryable, partial)`, `insertBeforeDone(steps, ...extra)`, `finish(ctx, steps)`
  - `scenarios/docs.ts`: `docQa`, `appHelp`, `longAnswer`, `refusalOutOfScope`, `refusalNoBasis`, `errorMidStream`, `errorFatal`, `warningCitation`, `warningStandard`, `warningUnknown`, `degradedRouting`, `degradedRetrievalOnly`, `truncated`, `unknownFields`, `docQaSegments(ctx)`
  - `scenarios/index.ts`: `SCENARIOS: Record<string, Scenario>`, `DEFAULT_SCENARIO`, `pickScenarioName(message, header, context)`
  - `test/scenario-invariants.ts`: `sampleContext(locale, context?)`, `eventNames(steps)`, `collapse(names)`, `checkInvariants(steps): string[]`

- [ ] **Step 1: Write the invariant checker (a test helper, used by this task and Task 5)**

`mock-server/test/scenario-invariants.ts`:

```ts
import type { Locale, PageContext } from "../src/contract.ts";
import { findDocument } from "../src/documents.ts";
import type { Step } from "../src/player.ts";
import type { ScenarioContext } from "../src/scenarios/build.ts";

export const sampleContext = (locale: Locale, context: PageContext = {}): ScenarioContext => ({
  locale,
  requestId: "req-test",
  messageId: "m-test",
  toolRunId: "tr-test",
  context,
});

export const eventNames = (steps: Step[]): string[] => steps.map((s) => s.event);

/** Collapses runs such as token×n into one entry, to compare against the sequences in 02 §4. */
export const collapse = (names: string[]): string[] => names.filter((n, i) => n !== names[i - 1]);

// Letters used in Vietnamese but never in French or English (GĐ-1: no Vietnamese in the product).
const VIETNAMESE = /[ăđơưĩũạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/iu;

function checkSource(docId: string, page: number, where: string, problems: string[]): void {
  const doc = findDocument(docId);
  if (!doc) problems.push(`${where}: unknown docId ${docId}`);
  else if (page < 1 || page > doc.pages) problems.push(`${where}: page ${page} outside 1..${doc.pages} of ${docId}`);
}

/** Returns human-readable contract violations; an empty array means the scenario is valid. */
export function checkInvariants(steps: Step[]): string[] {
  const problems: string[] = [];
  const names = eventNames(steps);

  if (names[0] !== "status") problems.push("first event must be status");
  const terminals = names.filter((n) => n === "done" || n === "error");
  if (terminals.length !== 1) problems.push(`expected exactly one done/error, got ${terminals.length}`);
  if (names.at(-1) !== "done" && names.at(-1) !== "error") problems.push("last event must be done or error");

  const lastToken = names.lastIndexOf("token");
  names.forEach((n, i) => {
    if (n === "warning" && i < lastToken) problems.push(`warning at #${i} precedes token at #${lastToken}`);
    if (n === "tool_result" && !names.slice(0, i).includes("tool_call")) problems.push(`tool_result at #${i} without tool_call`);
  });
  if (names.includes("refusal") && names.includes("token")) problems.push("refusal stream must not contain token");

  for (const s of steps) {
    if (s.event === "retrieval") {
      if (!Array.isArray(s.data.chunks) || !Array.isArray(s.data.scores)) problems.push("retrieval needs chunks[] and scores[]");
      s.data.chunks.forEach((c) => checkSource(c.docId, c.page, "retrieval", problems));
    }
    if (s.event === "citation") {
      if (!Array.isArray(s.data)) problems.push("citation data must be an array");
      else s.data.forEach((c) => checkSource(c.docId, c.page, `citation [${c.n}]`, problems));
    }
    if (s.event === "error" && (typeof s.data.requestId !== "string" || typeof s.data.retryable !== "boolean")) {
      problems.push("error needs requestId and retryable");
    }
  }

  // Latency targets from 04 step 3–4, at scale 1, for events that do not wait on a tool.
  let t = 0;
  let toolSeen = false;
  const firstAt: Partial<Record<string, number>> = {};
  for (const s of steps) {
    t += s.delayMs;
    if (s.event === "tool_call") toolSeen = true;
    if (firstAt[s.event] === undefined && !toolSeen) firstAt[s.event] = t;
  }
  if ((firstAt.status ?? 0) > 300) problems.push(`first status at ${firstAt.status} ms > 300`);
  if ((firstAt.retrieval ?? 0) > 1500) problems.push(`first retrieval at ${firstAt.retrieval} ms > 1500`);
  if ((firstAt.token ?? 0) > 3000) problems.push(`first token at ${firstAt.token} ms > 3000`);

  if (VIETNAMESE.test(JSON.stringify(steps))) problems.push("Vietnamese text in payload");
  return problems;
}
```

- [ ] **Step 2: Write the failing test**

`mock-server/test/scenarios-docs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { KNOWN_WARNING_CODES } from "../src/contract.ts";
import { pickScenarioName, SCENARIOS } from "../src/scenarios/index.ts";
import { checkInvariants, collapse, eventNames, sampleContext } from "./scenario-invariants.ts";

const run = (name: string, locale: "fr" | "en" = "fr") => SCENARIOS[name]!(sampleContext(locale));

describe.each(Object.keys(SCENARIOS))("scenario %s", (name) => {
  it.each(["fr", "en"] as const)("respects the contract invariants in %s", (locale) => {
    expect(checkInvariants(run(name, locale))).toEqual([]);
  });
});

describe("document scenarios", () => {
  it("doc-qa follows status → retrieval → token×n → citation → done", () => {
    expect(collapse(eventNames(run("doc-qa")))).toEqual(["status", "retrieval", "token", "citation", "done"]);
  });

  it("refusal is status → refusal → done with no token", () => {
    expect(eventNames(run("refusal"))).toEqual(["status", "refusal", "done"]);
  });

  it("refusal-no-basis shows sources then refuses, still with no token", () => {
    expect(eventNames(run("refusal-no-basis"))).toEqual(["status", "retrieval", "refusal", "done"]);
  });

  it("error-mid-stream is status → retrieval → token×3 → error, retryable and partial", () => {
    const steps = run("error-mid-stream");
    expect(eventNames(steps)).toEqual(["status", "retrieval", "token", "token", "token", "error"]);
    expect(steps.at(-1)).toMatchObject({ event: "error", data: { retryable: true, partial: true, requestId: "req-test" } });
  });

  it("warning-unknown sends a code the FE cannot know, after the last token", () => {
    const warning = run("warning-unknown").find((s) => s.event === "warning");
    expect(warning?.event === "warning" && (KNOWN_WARNING_CODES as readonly string[]).includes(warning.data.code)).toBe(false);
  });

  it.each([
    ["warning-citation", "unverified_citation"],
    ["warning-standard", "standard_version_mismatch"],
    ["degraded-routing", "degraded_routing"],
    ["degraded-retrieval-only", "degraded_retrieval_only"],
    ["truncated", "truncated"],
  ])("%s carries warning %s", (name, code) => {
    expect(run(name)).toContainEqual(expect.objectContaining({ event: "warning", data: { code } }));
  });

  it("degraded-retrieval-only lists sources but never writes text", () => {
    const names = eventNames(run("degraded-retrieval-only"));
    expect(names).toContain("retrieval");
    expect(names).not.toContain("token");
  });

  it("sends sentences with numbers as one whole token (AD-30)", () => {
    const tokens = run("doc-qa").flatMap((s) => (s.event === "token" ? [s.data.text] : []));
    expect(tokens).toContain("Pour un béton C30/37 et un acier B500, on obtient ρw,min ≈ 0,00088 [1]. ");
  });

  it("answers in English for locale en but keeps French quotes", () => {
    const steps = run("doc-qa", "en");
    const text = steps.flatMap((s) => (s.event === "token" ? [s.data.text] : [])).join("");
    expect(text).toContain("Beams must contain");
    const cites = steps.find((s) => s.event === "citation");
    expect(cites?.event === "citation" && cites.data[0]!.quote).toContain("effort tranchant");
  });

  it("citations carry a bbox for highlighted pages", () => {
    const cites = run("doc-qa").find((s) => s.event === "citation");
    expect(cites?.event === "citation" && cites.data[0]!.bbox).toHaveLength(4);
  });

  it("unknown-fields adds an extra field to every event payload", () => {
    for (const s of run("unknown-fields")) {
      const payloads = Array.isArray(s.data) ? s.data : [s.data];
      for (const p of payloads) expect(p).toHaveProperty("futureField");
    }
  });

  it("long produces a much longer answer than doc-qa", () => {
    expect(eventNames(run("long")).length).toBeGreaterThan(eventNames(run("doc-qa")).length * 5);
  });
});

describe("pickScenarioName", () => {
  it("prefers a /mock:<name> trigger in the message", () => {
    expect(pickScenarioName("Hello /mock:refusal please", "calc", {})).toBe("refusal");
  });
  it("falls back to the x-mock-scenario header", () => {
    expect(pickScenarioName("Hello", "truncated", {})).toBe("truncated");
  });
  it("defaults to doc-qa", () => {
    expect(pickScenarioName("Hello", undefined, {})).toBe("doc-qa");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/scenarios-docs.test.ts`
Expected: FAIL. `../src/documents.ts` and `../src/scenarios/index.ts` do not exist.

- [ ] **Step 4: Write the document catalogue**

`mock-server/src/documents.ts`:

```ts
import type { BBox } from "./contract.ts";

export interface MockDocument {
  docId: string;
  title: string;
  edition: string;
  pages: number;
  restricted: boolean;
}

export const DOCUMENTS: readonly MockDocument[] = [
  { docId: "en1992-1-1", title: "NF EN 1992-1-1 — Eurocode 2 : calcul des structures en béton", edition: "2005/NA:2016", pages: 230, restricted: false },
  { docId: "en1993-1-1", title: "NF EN 1993-1-1 — Eurocode 3 : calcul des structures en acier", edition: "2005/NA:2013", pages: 100, restricted: false },
  { docId: "vfs-app-help", title: "VF Structures — Guide d'utilisation", edition: "2026.3", pages: 40, restricted: false },
  { docId: "restricted-internal-note", title: "Note interne — projet confidentiel", edition: "1", pages: 5, restricted: true },
];

export const findDocument = (docId: string): MockDocument | undefined => DOCUMENTS.find((d) => d.docId === docId);

/** Regions highlighted in the source viewer, keyed "docId:page". MOCK-ONLY bbox format, see contract.ts. */
export const HIGHLIGHTS: Record<string, BBox> = {
  "en1992-1-1:164": [0.12, 0.41, 0.88, 0.47],
  "en1992-1-1:165": [0.12, 0.22, 0.88, 0.29],
  "en1992-1-1:88": [0.12, 0.55, 0.88, 0.61],
  "en1993-1-1:52": [0.12, 0.3, 0.88, 0.36],
  "vfs-app-help:12": [0.1, 0.18, 0.9, 0.3],
};
```

- [ ] **Step 5: Write the scenario builders**

`mock-server/src/scenarios/build.ts`:

```ts
import type { Chunk, CitationItem, Locale, PageContext, Phase, Risk, StreamErrorCode } from "../contract.ts";
import { findDocument, HIGHLIGHTS } from "../documents.ts";
import type { Step } from "../player.ts";

export interface ScenarioContext {
  locale: Locale;
  requestId: string;
  messageId: string;
  toolRunId: string;
  context: PageContext;
}

export type Scenario = (ctx: ScenarioContext) => Step[];

export interface Tx {
  fr: string;
  en: string;
}

export const tx = (ctx: ScenarioContext, text: Tx): string => text[ctx.locale];

/**
 * Delays in ms at scale 1. Cumulative targets (04 step 3–4): first status ≤ 300,
 * retrieval ≤ 1500, first token ≤ 3000.
 */
export const DELAY = { status: 250, retrieval: 1000, firstToken: 1200, token: 45, sentence: 350, tool: 2500, tail: 150 } as const;

export const status = (phase: Phase, text: string, delayMs: number = DELAY.status): Step => ({
  delayMs,
  event: "status",
  data: { phase, text },
});

export interface Segment {
  text: string;
  /** Sentences with numbers or verdict wording are held and sent as one token (AD-30). */
  whole?: boolean;
  risk?: Risk;
}

export function answer(segments: Segment[], firstDelayMs: number = DELAY.firstToken): Step[] {
  const steps: Step[] = [];
  for (const seg of segments) {
    if (seg.whole || seg.risk) {
      steps.push({ delayMs: DELAY.sentence, event: "token", data: seg.risk ? { text: seg.text, risk: seg.risk } : { text: seg.text } });
    } else {
      for (const piece of seg.text.match(/\S+\s*|\s+/g) ?? []) {
        steps.push({ delayMs: DELAY.token, event: "token", data: { text: piece } });
      }
    }
  }
  if (steps.length > 0) steps[0] = { ...steps[0]!, delayMs: firstDelayMs };
  return steps;
}

export function chunk(docId: string, page: number, clause: string): Chunk {
  const doc = findDocument(docId);
  if (!doc) throw new Error(`unknown mock document ${docId}`);
  return { docId, title: doc.title, page, clause };
}

export function retrieval(chunks: Chunk[], opts: { scores?: number[]; delayMs?: number } = {}): Step {
  const scores = opts.scores ?? chunks.map((_, i) => Number((0.91 - i * 0.07).toFixed(2)));
  return { delayMs: opts.delayMs ?? DELAY.retrieval, event: "retrieval", data: { chunks, scores } };
}

export function cite(n: number, source: Chunk, quote: string): CitationItem {
  const bbox = HIGHLIGHTS[`${source.docId}:${source.page}`];
  return { n, docId: source.docId, page: source.page, clause: source.clause, quote, ...(bbox ? { bbox } : {}) };
}

export const citations = (items: CitationItem[]): Step => ({ delayMs: DELAY.tail, event: "citation", data: items });

export const warning = (code: string): Step => ({ delayMs: DELAY.tail, event: "warning", data: { code } });

export const streamError = (ctx: ScenarioContext, code: StreamErrorCode, retryable: boolean, partial: boolean): Step => ({
  delayMs: 600,
  event: "error",
  data: { code, retryable, partial, requestId: ctx.requestId },
});

export function insertBeforeDone(steps: Step[], ...extra: Step[]): Step[] {
  const i = steps.findIndex((s) => s.event === "done");
  if (i < 0) throw new Error("insertBeforeDone needs a done step");
  return [...steps.slice(0, i), ...extra, ...steps.slice(i)];
}

/** Appends `done` with usage derived from the steps. */
export function finish(ctx: ScenarioContext, steps: Step[]): Step[] {
  const text = steps.map((s) => (s.event === "token" ? s.data.text : "")).join("");
  const latencyMs = steps.reduce((sum, s) => sum + s.delayMs, 0) + DELAY.tail;
  const outputTokens = Math.ceil(text.length / 4);
  return [
    ...steps,
    {
      delayMs: DELAY.tail,
      event: "done",
      data: {
        messageId: ctx.messageId,
        usage: {
          inputTokens: 3120,
          outputTokens,
          totalTokens: 3120 + outputTokens,
          cacheReadInputTokens: 2048,
          cacheWriteInputTokens: 0,
          latencyMs,
        },
      },
    },
  ];
}
```

- [ ] **Step 6: Write the document scenarios**

`mock-server/src/scenarios/docs.ts`:

```ts
import type { CitationItem } from "../contract.ts";
import type { Step } from "../player.ts";
import {
  answer,
  chunk,
  citations,
  cite,
  finish,
  insertBeforeDone,
  retrieval,
  status,
  streamError,
  tx,
  warning,
  type Scenario,
  type ScenarioContext,
  type Segment,
} from "./build.ts";

const SHEAR_MIN = chunk("en1992-1-1", 164, "9.2.2");
const SHEAR_SPACING = chunk("en1992-1-1", 165, "9.2.2 (6)");
const EC3_SHEAR = chunk("en1993-1-1", 52, "6.2.6");
const APP_EXPORT = chunk("vfs-app-help", 12, "4.3");

const searching = (ctx: ScenarioContext): Step =>
  status("retrieving", tx(ctx, { fr: "Recherche dans les documents…", en: "Searching the documents…" }));

export function docQaSegments(ctx: ScenarioContext): Segment[] {
  return ctx.locale === "fr"
    ? [
        { text: "Les poutres doivent comporter un minimum d'armatures d'effort tranchant. " },
        { text: "Le taux minimal est donné par l'expression (9.5N) : $\\rho_{w,min} = 0{,}08\\sqrt{f_{ck}}/f_{yk}$ [1]. ", whole: true },
        { text: "Pour un béton C30/37 et un acier B500, on obtient ρw,min ≈ 0,00088 [1]. ", whole: true },
        { text: "L'espacement longitudinal des cadres est limité à sl,max = 0,75·d·(1 + cot α) [2].", whole: true },
      ]
    : [
        { text: "Beams must contain a minimum amount of shear reinforcement. " },
        { text: "The minimum ratio is given by expression (9.5N): $\\rho_{w,min} = 0.08\\sqrt{f_{ck}}/f_{yk}$ [1]. ", whole: true },
        { text: "For C30/37 concrete and B500 steel this gives ρw,min ≈ 0.00088 [1]. ", whole: true },
        { text: "The longitudinal spacing of the links is limited to sl,max = 0.75·d·(1 + cot α) [2].", whole: true },
      ];
}

// Quotes stay in the French original whatever the answer language (07 §8).
const docQaCitations = (): CitationItem[] => [
  cite(1, SHEAR_MIN, "Le taux d'armatures d'effort tranchant ne doit pas être inférieur à ρw,min = (0,08·√fck) / fyk (9.5N)."),
  cite(2, SHEAR_SPACING, "L'espacement longitudinal maximal entre cours d'armatures d'effort tranchant est sl,max = 0,75·d·(1 + cot α) (9.6N)."),
];

export const docQa: Scenario = (ctx) =>
  finish(ctx, [searching(ctx), retrieval([SHEAR_MIN, SHEAR_SPACING]), ...answer(docQaSegments(ctx)), citations(docQaCitations())]);

export const appHelp: Scenario = (ctx) =>
  finish(ctx, [
    searching(ctx),
    retrieval([APP_EXPORT]),
    ...answer(
      ctx.locale === "fr"
        ? [
            { text: "La note de calcul s'exporte depuis l'écran des résultats. " },
            { text: "Ouvrez le menu Exporter et choisissez « Note de calcul (PDF) » [1].", whole: true },
          ]
        : [
            { text: "The calculation report is exported from the results screen. " },
            { text: "Open the Export menu and choose “Calculation report (PDF)” [1].", whole: true },
          ],
    ),
    citations([cite(1, APP_EXPORT, "Menu Exporter > Note de calcul (PDF) : génère la note complète du module ouvert.")]),
  ]);

export const longAnswer: Scenario = (ctx) => {
  const segments: Segment[] = [];
  for (let i = 1; i <= 8; i++) {
    segments.push({ text: `${i === 1 ? "" : "\n\n"}### ${tx(ctx, { fr: "Point", en: "Point" })} ${i}\n\n`, whole: true }, ...docQaSegments(ctx));
  }
  return finish(ctx, [searching(ctx), retrieval([SHEAR_MIN, SHEAR_SPACING]), ...answer(segments), citations(docQaCitations())]);
};

export const refusalOutOfScope: Scenario = (ctx) =>
  finish(ctx, [
    status("routing", tx(ctx, { fr: "Analyse de la question…", en: "Reading the question…" })),
    {
      delayMs: 400,
      event: "refusal",
      data: {
        reason: tx(ctx, {
          fr: "Cette question sort du périmètre de l'assistant, limité au calcul de structures et aux normes associées.",
          en: "This question is outside the assistant's scope, which covers structural design and the related standards.",
        }),
        suggestion: tx(ctx, {
          fr: "Posez une question sur une vérification, une clause de norme ou un résultat de calcul.",
          en: "Ask about a design check, a code clause or a calculation result.",
        }),
      },
    },
  ]);

export const refusalNoBasis: Scenario = (ctx) =>
  finish(ctx, [
    searching(ctx),
    retrieval([EC3_SHEAR], { scores: [0.31] }),
    {
      delayMs: 300,
      event: "refusal",
      data: {
        reason: tx(ctx, {
          fr: "Aucune base suffisante n'a été trouvée dans les documents disponibles.",
          en: "No sufficient basis was found in the available documents.",
        }),
        suggestion: tx(ctx, {
          fr: "Précisez la norme ou la clause visée, ou consultez la source la plus proche ci-dessus.",
          en: "Name the standard or clause you mean, or open the closest source above.",
        }),
      },
    },
  ]);

export const errorMidStream: Scenario = (ctx) => [
  searching(ctx),
  retrieval([SHEAR_MIN, SHEAR_SPACING]),
  ...answer(docQaSegments(ctx)).slice(0, 3),
  streamError(ctx, "throttled", true, true),
];

export const errorFatal: Scenario = (ctx) => [
  status("routing", tx(ctx, { fr: "Analyse de la question…", en: "Reading the question…" })),
  streamError(ctx, "internalServerException", false, false),
];

const docQaThenWarning =
  (code: string): Scenario =>
  (ctx) =>
    insertBeforeDone(docQa(ctx), warning(code));

export const warningCitation = docQaThenWarning("unverified_citation");
export const warningStandard = docQaThenWarning("standard_version_mismatch");
/** A code added after the FE shipped; the FE must show the generic banner (02 §5). */
export const warningUnknown = docQaThenWarning("future_check_failed");
export const degradedRouting = docQaThenWarning("degraded_routing");

export const degradedRetrievalOnly: Scenario = (ctx) =>
  finish(ctx, [searching(ctx), retrieval([SHEAR_MIN, SHEAR_SPACING]), warning("degraded_retrieval_only")]);

export const truncated: Scenario = (ctx) =>
  finish(ctx, [searching(ctx), retrieval([SHEAR_MIN, SHEAR_SPACING]), ...answer(docQaSegments(ctx).slice(0, 2)), warning("truncated")]);

/** Every payload gains a field the FE does not know; the FE must ignore it (02 §10). */
export const unknownFields: Scenario = (ctx) =>
  docQa(ctx).map((s): Step => {
    const extra = { futureField: "ignore-me" };
    if (s.event === "citation") return { ...s, data: s.data.map((item) => ({ ...item, ...extra })) };
    return { ...s, data: { ...s.data, ...extra } } as Step;
  });
```

- [ ] **Step 7: Write the registry**

`mock-server/src/scenarios/index.ts`:

```ts
import type { PageContext } from "../contract.ts";
import type { Scenario } from "./build.ts";
import * as docs from "./docs.ts";

export const SCENARIOS: Record<string, Scenario> = {
  "doc-qa": docs.docQa,
  "app-help": docs.appHelp,
  long: docs.longAnswer,
  refusal: docs.refusalOutOfScope,
  "refusal-no-basis": docs.refusalNoBasis,
  "error-mid-stream": docs.errorMidStream,
  "error-fatal": docs.errorFatal,
  "warning-citation": docs.warningCitation,
  "warning-standard": docs.warningStandard,
  "warning-unknown": docs.warningUnknown,
  "degraded-routing": docs.degradedRouting,
  "degraded-retrieval-only": docs.degradedRetrievalOnly,
  truncated: docs.truncated,
  "unknown-fields": docs.unknownFields,
};

export const DEFAULT_SCENARIO = "doc-qa";

const TRIGGER = /\/mock:([a-z0-9-]+)/;

/** A trigger in the message wins because the BFF forwards the body untouched; then the x-mock-scenario header. */
export function pickScenarioName(message: string, header: string | undefined, _context: PageContext): string {
  const match = TRIGGER.exec(message);
  if (match) return match[1]!;
  if (header) return header;
  return DEFAULT_SCENARIO;
}
```

- [ ] **Step 8: Run tests and typecheck**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run && rtk pnpm typecheck`
Expected: all tests PASS (the invariant suite runs 14 scenarios × 2 locales), and tsc exits 0.

- [ ] **Step 9: Commit**

```bash
cd /home/vdloc/Documents/vfstructures-ai-solution
rtk git add mock-server/src/documents.ts mock-server/src/scenarios mock-server/test/scenario-invariants.ts mock-server/test/scenarios-docs.test.ts
rtk git commit -m "feat(mock): add document, refusal, error and warning scenarios with contract invariants"
```

---

### Task 5: Tool scenarios — calc, risk flags, mixed, approval, case lookup

**Files:**
- Create: `mock-server/src/scenarios/tools.ts`
- Modify: `mock-server/src/scenarios/index.ts` (register the scenarios; route `context.caseParams` to `case-results`)
- Test: `mock-server/test/scenarios-tools.test.ts`

**Interfaces:**
- Consumes: everything in `scenarios/build.ts`; `CaseParam` and `CaseRecord` from `contract.ts`; `checkInvariants`, `sampleContext`, `eventNames` and `collapse` from `test/scenario-invariants.ts`
- Produces:
  - `tools.ts`: `calcPass`, `calcFail`, `calcNoVerdict`, `riskFlags`, `unverifiedVerdict`, `slowTool`, `mixedPlan`, `approval`, `caseLookup`, `caseLookupInsufficient`, `caseResults`, `MOCK_CASES: CaseRecord[]`
  - `index.ts`: `pickScenarioName` now returns `"case-results"` when `context.caseParams` is an array and no trigger or header is set

- [ ] **Step 1: Write the failing test**

`mock-server/test/scenarios-tools.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Step } from "../src/player.ts";
import { pickScenarioName, SCENARIOS } from "../src/scenarios/index.ts";
import { checkInvariants, collapse, eventNames, sampleContext } from "./scenario-invariants.ts";

const run = (name: string, locale: "fr" | "en" = "fr", context = {}) => SCENARIOS[name]!(sampleContext(locale, context));
const find = <E extends Step["event"]>(steps: Step[], event: E) => steps.find((s) => s.event === event) as Extract<Step, { event: E }> | undefined;

const CONFIRMED = [
  { key: "span", value: 12, unit: "m" },
  { key: "fck", value: 30, unit: "MPa" },
];

describe("calc scenarios", () => {
  it("calc follows status → status → tool_call → tool_result → token×n → citation → done", () => {
    expect(collapse(eventNames(run("calc")))).toEqual(["status", "tool_call", "tool_result", "token", "citation", "done"]);
    expect(eventNames(run("calc")).slice(0, 2)).toEqual(["status", "status"]);
  });

  it("calc carries a passing verdict block in outputs", () => {
    expect(find(run("calc"), "tool_result")?.data.outputs.verdict).toEqual({ pass: true, field: "utilization", value: 0.88 });
  });

  it("calc-fail carries a failing verdict", () => {
    expect(find(run("calc-fail"), "tool_result")?.data.outputs.verdict?.pass).toBe(false);
  });

  it("calc-no-verdict has no verdict block at all", () => {
    expect(find(run("calc-no-verdict"), "tool_result")?.data.outputs).not.toHaveProperty("verdict");
  });

  it("tool_result carries units and standard for the result card", () => {
    const r = find(run("calc"), "tool_result")!.data;
    expect(r.units.VRds).toBe("kN");
    expect(r.standard).toContain("EN 1992-1-1");
    expect(r.toolRunId).toBe("tr-test");
  });
});

describe("risk flags (AD-30)", () => {
  it("risk sends one mismatch and one unverified sentence, then warning unverified_number", () => {
    const steps = run("risk");
    const risks = steps.flatMap((s) => (s.event === "token" && s.data.risk ? [s.data.risk] : []));
    expect(risks.sort()).toEqual(["mismatch", "unverified"]);
    expect(find(steps, "warning")?.data.code).toBe("unverified_number");
  });

  it("unverified-verdict pairs a failing engine verdict with text claiming a pass", () => {
    const steps = run("unverified-verdict");
    expect(find(steps, "tool_result")?.data.outputs.verdict?.pass).toBe(false);
    expect(steps.some((s) => s.event === "token" && s.data.risk === "mismatch")).toBe(true);
    expect(find(steps, "warning")?.data.code).toBe("unverified_verdict");
  });
});

describe("longer tool turns", () => {
  it("slow-tool keeps sending status updates for more than 10 s before the result", () => {
    const steps = run("slow-tool");
    const until = steps.findIndex((s) => s.event === "tool_result");
    const elapsed = steps.slice(0, until + 1).reduce((t, s) => t + s.delayMs, 0);
    expect(elapsed).toBeGreaterThan(10_000);
    expect(eventNames(steps.slice(0, until)).filter((n) => n === "status").length).toBeGreaterThanOrEqual(4);
  });

  it("mixed opens with a planning status line", () => {
    expect(find(run("mixed"), "status")?.data.phase).toBe("planning");
    expect(eventNames(run("mixed"))).toContain("retrieval");
  });

  it("approval emits approval_required after citation and before done", () => {
    expect(collapse(eventNames(run("approval"))).slice(-3)).toEqual(["citation", "approval_required", "done"]);
  });

  it("no scenario other than approval emits approval_required (AD-28)", () => {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
      if (name === "approval") continue;
      expect(eventNames(scenario(sampleContext("fr", { caseParams: CONFIRMED })))).not.toContain("approval_required");
    }
  });
});

describe("case lookup (AD-16, AD-28)", () => {
  it("case-lookup shows chips and stops, with at least one editable case_hints chip", () => {
    const steps = run("case-lookup");
    expect(eventNames(steps)).toEqual(["status", "retrieval", "done"]);
    const params = find(steps, "retrieval")!.data.params!;
    expect(params.length).toBeGreaterThanOrEqual(2);
    expect(params).toContainEqual(expect.objectContaining({ source: "case_hints", confirmed: false }));
    expect(params.filter((p) => p.source !== "case_hints").every((p) => p.confirmed)).toBe(true);
  });

  it("case-lookup-insufficient returns fewer than 2 params and no results", () => {
    const steps = run("case-lookup-insufficient");
    expect(find(steps, "retrieval")!.data.params!.length).toBeLessThan(2);
    expect(eventNames(steps)).not.toContain("tool_result");
  });

  it("case-results with confirmed params returns five cases with use_count and standard flags", () => {
    const steps = run("case-results", "fr", { caseParams: CONFIRMED });
    expect(checkInvariants(steps)).toEqual([]);
    expect(find(steps, "tool_call")?.data.toolId).toBe("find_similar_cases");
    const cases = find(steps, "tool_result")!.data.outputs.cases as { use_count: number; isCurrentStandard: boolean; verdict: string }[];
    expect(cases).toHaveLength(5);
    expect(cases.every((c) => c.verdict === "pass" && c.use_count >= 1)).toBe(true);
    expect(cases.some((c) => !c.isCurrentStandard)).toBe(true);
  });

  it("case-results with fewer than 2 confirmed params behaves like insufficient", () => {
    const steps = run("case-results", "fr", { caseParams: CONFIRMED.slice(0, 1) });
    expect(eventNames(steps)).not.toContain("tool_result");
  });

  it("pickScenarioName routes a request carrying caseParams to case-results", () => {
    expect(pickScenarioName("Tra", undefined, { caseParams: CONFIRMED })).toBe("case-results");
    expect(pickScenarioName("Tra /mock:refusal", undefined, { caseParams: CONFIRMED })).toBe("refusal");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/scenarios-tools.test.ts`
Expected: FAIL. `SCENARIOS["calc"]` is undefined, so `SCENARIOS[name]!(…)` throws "is not a function".

- [ ] **Step 3: Write the tool scenarios**

`mock-server/src/scenarios/tools.ts`:

```ts
import type { CaseParam, CaseRecord } from "../contract.ts";
import type { Step } from "../player.ts";
import {
  answer,
  chunk,
  citations,
  cite,
  DELAY,
  finish,
  insertBeforeDone,
  retrieval,
  status,
  tx,
  warning,
  type Scenario,
  type ScenarioContext,
  type Segment,
} from "./build.ts";

const SHEAR_DESIGN = chunk("en1992-1-1", 88, "6.2.3");
const SHEAR_MIN = chunk("en1992-1-1", 164, "9.2.2");
const STANDARD = "NF EN 1992-1-1:2005/NA:2016";

type VerdictMode = "pass" | "fail" | "none";

const routing = (ctx: ScenarioContext): Step => status("routing", tx(ctx, { fr: "Analyse de la question…", en: "Reading the question…" }));
const calculating = (ctx: ScenarioContext): Step =>
  status("calculating", tx(ctx, { fr: "Calcul de la poutre B12…", en: "Calculating beam B12…" }));

const shearCall = (): Step => ({
  delayMs: DELAY.status,
  event: "tool_call",
  data: {
    toolId: "calc.beam.shear",
    version: "3.2.0",
    inputs: { memberId: "B12", b: 300, h: 600, d: 550, fck: 30, fywk: 500, aswPerS: 0.503, VEd: 162.5 },
  },
});

function shearResult(ctx: ScenarioContext, mode: VerdictMode, delayMs: number = DELAY.tool): Step {
  const VRds = mode === "fail" ? 145.1 : 184.2;
  const utilization = mode === "fail" ? 1.12 : 0.88;
  return {
    delayMs,
    event: "tool_result",
    data: {
      toolRunId: ctx.toolRunId,
      outputs: {
        VEd: 162.5,
        VRds,
        VRdmax: 612.0,
        utilization,
        ...(mode === "none" ? {} : { verdict: { pass: mode === "pass", field: "utilization", value: utilization } }),
      },
      units: { VEd: "kN", VRds: "kN", VRdmax: "kN", utilization: "-" },
      standard: STANDARD,
    },
  };
}

const shearCitation = (): Step =>
  citations([cite(1, SHEAR_DESIGN, "VRd,s = (Asw / s)·z·fywd·cot θ (6.8)")]);

function calcSegments(ctx: ScenarioContext, mode: VerdictMode): Segment[] {
  if (ctx.locale === "fr") {
    const intro: Segment = { text: "Voici la vérification à l'effort tranchant de la poutre B12. " };
    if (mode === "fail")
      return [
        intro,
        { text: "Avec VEd = 162,5 kN et VRd,s = 145,1 kN, le taux d'utilisation atteint 1,12 [1]. ", whole: true },
        { text: "Il faut augmenter la section d'armatures transversales ou réduire l'espacement des cadres." },
      ];
    return [
      intro,
      { text: "Avec VEd = 162,5 kN et VRd,s = 184,2 kN, le taux d'utilisation est de 0,88 [1]. ", whole: true },
      { text: "La carte de calcul ci-dessus donne le détail des valeurs." },
    ];
  }
  const intro: Segment = { text: "Here is the shear check for beam B12. " };
  if (mode === "fail")
    return [
      intro,
      { text: "With VEd = 162.5 kN and VRd,s = 145.1 kN, utilisation reaches 1.12 [1]. ", whole: true },
      { text: "Increase the transverse reinforcement or reduce the link spacing." },
    ];
  return [
    intro,
    { text: "With VEd = 162.5 kN and VRd,s = 184.2 kN, utilisation is 0.88 [1]. ", whole: true },
    { text: "The calculation card above shows every value." },
  ];
}

const calcScenario =
  (mode: VerdictMode): Scenario =>
  (ctx) =>
    finish(ctx, [routing(ctx), calculating(ctx), shearCall(), shearResult(ctx, mode), ...answer(calcSegments(ctx, mode), 800), shearCitation()]);

export const calcPass = calcScenario("pass");
export const calcFail = calcScenario("fail");
export const calcNoVerdict = calcScenario("none");

export const riskFlags: Scenario = (ctx) =>
  finish(ctx, [
    routing(ctx),
    calculating(ctx),
    shearCall(),
    shearResult(ctx, "pass"),
    ...answer(
      ctx.locale === "fr"
        ? [
            { text: "Voici la vérification à l'effort tranchant de la poutre B12. " },
            { text: "La résistance vaut VRd,s = 194,2 kN, la poutre est donc largement dimensionnée [1]. ", risk: "mismatch" },
            { text: "Le coefficient partiel γs = 1,15 s'applique à l'acier. ", risk: "unverified" },
          ]
        : [
            { text: "Here is the shear check for beam B12. " },
            { text: "The resistance is VRd,s = 194.2 kN, so the beam is comfortably sized [1]. ", risk: "mismatch" },
            { text: "The partial factor γs = 1.15 applies to the steel. ", risk: "unverified" },
          ],
      800,
    ),
    shearCitation(),
    warning("unverified_number"),
  ]);

export const unverifiedVerdict: Scenario = (ctx) =>
  finish(ctx, [
    routing(ctx),
    calculating(ctx),
    shearCall(),
    shearResult(ctx, "fail"),
    ...answer(
      ctx.locale === "fr"
        ? [
            { text: "Voici la vérification à l'effort tranchant de la poutre B12. " },
            { text: "La vérification est satisfaite avec un taux d'utilisation de 1,12 [1]. ", risk: "mismatch" },
          ]
        : [
            { text: "Here is the shear check for beam B12. " },
            { text: "The check passes with a utilisation of 1.12 [1]. ", risk: "mismatch" },
          ],
      800,
    ),
    shearCitation(),
    warning("unverified_verdict"),
  ]);

export const slowTool: Scenario = (ctx) => {
  const still = (fr: string, en: string): Step => status("calculating", tx(ctx, { fr, en }), 3500);
  return finish(ctx, [
    routing(ctx),
    calculating(ctx),
    shearCall(),
    still("Le moteur traite les combinaisons ELU…", "The engine is processing the ULS combinations…"),
    still("Le moteur vérifie les sections critiques…", "The engine is checking the critical sections…"),
    still("Le moteur assemble les résultats…", "The engine is assembling the results…"),
    shearResult(ctx, "pass", 2000),
    ...answer(calcSegments(ctx, "pass"), 800),
    shearCitation(),
  ]);
};

export const mixedPlan: Scenario = (ctx) =>
  finish(ctx, [
    status(
      "planning",
      tx(ctx, {
        fr: "Plan : calculer VRd,s de B12 avec calc.beam.shear, puis vérifier la clause 9.2.2.",
        en: "Plan: compute VRd,s for B12 with calc.beam.shear, then check clause 9.2.2.",
      }),
    ),
    calculating(ctx),
    shearCall(),
    shearResult(ctx, "pass"),
    status("retrieving", tx(ctx, { fr: "Recherche de la clause 9.2.2…", en: "Looking up clause 9.2.2…" })),
    retrieval([SHEAR_MIN], { delayMs: 800 }),
    ...answer(calcSegments(ctx, "pass"), 800),
    citations([
      cite(1, SHEAR_DESIGN, "VRd,s = (Asw / s)·z·fywd·cot θ (6.8)"),
      cite(2, SHEAR_MIN, "Le taux d'armatures d'effort tranchant ne doit pas être inférieur à ρw,min = (0,08·√fck) / fyk (9.5N)."),
    ]),
  ]);

/** Opt-in only: v1.2 never emits approval_required for cases (AD-28); kept for group C tools. */
export const approval: Scenario = (ctx) =>
  insertBeforeDone(calcPass(ctx), {
    delayMs: DELAY.tail,
    event: "approval_required",
    data: {
      toolRunId: ctx.toolRunId,
      summary: tx(ctx, {
        fr: "Enregistrer cette configuration de B12 comme cas de référence ?",
        en: "Save this B12 configuration as a reference case?",
      }),
    },
  });

const FULL_PARAMS: CaseParam[] = [
  { key: "span", value: 12, unit: "m", source: "case_hints", confirmed: false },
  { key: "fck", value: 30, unit: "MPa", source: "pageContext", confirmed: true },
  { key: "b", value: 300, unit: "mm", source: "tool_run", confirmed: true },
];

const chips = (params: CaseParam[]): Step => ({ delayMs: DELAY.retrieval, event: "retrieval", data: { chunks: [], scores: [], params } });

export const caseLookup: Scenario = (ctx) => finish(ctx, [routing(ctx), chips(FULL_PARAMS)]);

export const caseLookupInsufficient: Scenario = (ctx) => finish(ctx, [routing(ctx), chips(FULL_PARAMS.slice(0, 1))]);

const CASE_UNITS = { span: "m", fck: "MPa", b: "mm", h: "mm", cover: "mm" };
const beamCase = (
  caseId: string,
  params: Record<string, number>,
  result: Record<string, number>,
  use_count: number,
  last_seen_at: string,
  standard_ref = STANDARD,
): CaseRecord => ({
  caseId,
  tool_id: "calc.beam.flexure",
  tool_version: "3.2.0",
  element_type: "beam",
  params,
  units: CASE_UNITS,
  result,
  verdict: "pass",
  standard_ref,
  use_count,
  last_seen_at,
  isCurrentStandard: standard_ref === STANDARD,
});

export const MOCK_CASES: CaseRecord[] = [
  beamCase("case-001", { span: 12, fck: 30, b: 300, h: 650, cover: 30 }, { MEd: 212.4, MRd: 248.9, utilization: 0.853 }, 7, "2026-09-12T09:30:00Z"),
  beamCase("case-002", { span: 12, fck: 30, b: 300, h: 650, cover: 35 }, { MEd: 212.4, MRd: 252.6, utilization: 0.841 }, 9, "2025-11-04T14:05:00Z", "NF EN 1992-1-1:2005/NA:2007"),
  beamCase("case-003", { span: 11.5, fck: 30, b: 300, h: 600, cover: 30 }, { MEd: 195.0, MRd: 214.3, utilization: 0.91 }, 4, "2026-08-28T10:12:00Z"),
  beamCase("case-004", { span: 12, fck: 35, b: 300, h: 600, cover: 30 }, { MEd: 212.4, MRd: 241.4, utilization: 0.88 }, 2, "2026-07-15T08:40:00Z"),
  beamCase("case-005", { span: 12.5, fck: 30, b: 350, h: 700, cover: 30 }, { MEd: 230.5, MRd: 295.5, utilization: 0.78 }, 3, "2026-06-02T16:20:00Z"),
];

export const caseResults: Scenario = (ctx) => {
  const params = ctx.context.caseParams ?? [];
  if (params.length < 2) return caseLookupInsufficient(ctx);
  return finish(ctx, [
    status("retrieving", tx(ctx, { fr: "Recherche de cas similaires…", en: "Searching similar cases…" })),
    {
      delayMs: DELAY.status,
      event: "tool_call",
      data: {
        toolId: "find_similar_cases",
        version: "1.0.0",
        inputs: { tool_id: "calc.beam.flexure", params: Object.fromEntries(params.map((p) => [p.key, p.value])) },
      },
    },
    {
      delayMs: 900,
      event: "tool_result",
      data: { toolRunId: ctx.toolRunId, outputs: { cases: MOCK_CASES }, units: CASE_UNITS, standard: STANDARD },
    },
    ...answer(
      ctx.locale === "fr"
        ? [
            { text: "Voici les configurations les plus proches, triées par similarité. " },
            { text: "La plus fréquente, une section 300 × 650 mm, a été utilisée 9 fois.", whole: true },
          ]
        : [
            { text: "Here are the closest configurations, sorted by similarity. " },
            { text: "The most frequent one, a 300 × 650 mm section, was used 9 times.", whole: true },
          ],
      600,
    ),
  ]);
};
```

- [ ] **Step 4: Register the scenarios and add the caseParams routing**

In `mock-server/src/scenarios/index.ts`, add `import * as tools from "./tools.ts";` below the `docs` import, and add these entries at the end of the `SCENARIOS` object literal:

```ts
  calc: tools.calcPass,
  "calc-fail": tools.calcFail,
  "calc-no-verdict": tools.calcNoVerdict,
  risk: tools.riskFlags,
  "unverified-verdict": tools.unverifiedVerdict,
  "slow-tool": tools.slowTool,
  mixed: tools.mixedPlan,
  approval: tools.approval,
  "case-lookup": tools.caseLookup,
  "case-lookup-insufficient": tools.caseLookupInsufficient,
  "case-results": tools.caseResults,
```

Replace the `pickScenarioName` function with:

```ts
/**
 * A trigger in the message wins because the BFF forwards the body untouched; then the
 * x-mock-scenario header; then a "Tra" re-submit carrying context.caseParams (MOCK-ONLY).
 */
export function pickScenarioName(message: string, header: string | undefined, context: PageContext): string {
  const match = TRIGGER.exec(message);
  if (match) return match[1]!;
  if (header) return header;
  if (Array.isArray(context.caseParams)) return "case-results";
  return DEFAULT_SCENARIO;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run && rtk pnpm typecheck`
Expected: all tests PASS. The invariant suite in `scenarios-docs.test.ts` now also covers the 11 new scenarios. tsc exits 0.

- [ ] **Step 6: Commit**

```bash
cd /home/vdloc/Documents/vfstructures-ai-solution
rtk git add mock-server/src/scenarios/tools.ts mock-server/src/scenarios/index.ts mock-server/test/scenarios-tools.test.ts
rtk git commit -m "feat(mock): add calc, risk-flag, mixed, approval and case-lookup scenarios"
```

---

### Task 6: `POST /v1/chat` — validation, pre-stream errors, turn lock, abort, persistence

**Files:**
- Create: `mock-server/src/errors.ts`, `mock-server/src/routes/chat.ts`
- Modify: `mock-server/src/server.ts` (register the chat route), `mock-server/test/helpers.ts` (add `chat`, `readEvents`, `waitFor`)
- Test: `mock-server/test/chat.test.ts`

**Interfaces:**
- Consumes: `play` and `Step` (Task 2); `MockState` and `statusFor` (Task 3); `authenticate`, `readJson`, `BadJsonError`, `sendJson`, `fail` (Task 3); `SCENARIOS` and `pickScenarioName` (Tasks 4–5); `RouteContext` and `ROUTES` (Task 3)
- Produces:
  - `errors.ts`: `interface PreStreamError { status; code; message; data?; headers? }`, `HTTP_TRIGGERS: Record<string, (now: Date) => PreStreamError>`, `nextUtcMidnight(now)`
  - `routes/chat.ts`: `parseChatRequest(body): { ok: true; value: ChatRequest } | { ok: false; error: string }` and `handleChat(ctx: RouteContext): Promise<void>`
  - `test/helpers.ts`: `chat(base, body, user?, init?)`, `interface ReceivedEvent { event; data; at }`, `readEvents(res, opts?)`, `waitFor(predicate, timeoutMs?)`

- [ ] **Step 1: Add the test helpers**

Append to `mock-server/test/helpers.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing test**

`mock-server/test/chat.test.ts`:

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/chat.test.ts`
Expected: FAIL. `POST /v1/chat` returns 404 `not_found`.

- [ ] **Step 4: Write the pre-stream error triggers**

`mock-server/src/errors.ts`:

```ts
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
```

- [ ] **Step 5: Write the chat route**

`mock-server/src/routes/chat.ts`:

```ts
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
```

- [ ] **Step 6: Register the route**

In `mock-server/src/server.ts`, add `import { handleChat } from "./routes/chat.ts";` to the imports, and add this entry at the end of the `ROUTES` array literal:

```ts
  { method: "POST", pattern: /^\/v1\/chat$/, handle: handleChat },
```

`routes/chat.ts` imports only the `RouteContext` type from `server.ts`, and `verbatimModuleSyntax` erases type-only imports, so there is no runtime import cycle.

- [ ] **Step 7: Run tests and typecheck**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run && rtk pnpm typecheck`
Expected: all tests PASS, and tsc exits 0.

- [ ] **Step 8: Commit**

```bash
cd /home/vdloc/Documents/vfstructures-ai-solution
rtk git add mock-server/src/errors.ts mock-server/src/routes/chat.ts mock-server/src/server.ts mock-server/test/helpers.ts mock-server/test/chat.test.ts
rtk git commit -m "feat(mock): stream /v1/chat scenarios with turn lock, abort handling and HTTP error triggers"
```

---

### Task 7: Side endpoints — conversations, feedback, approvals, capabilities, admin, mock controls

**Files:**
- Create: `mock-server/src/routes/side.ts`
- Modify: `mock-server/src/server.ts` (register the routes)
- Test: `mock-server/test/side.test.ts`

**Interfaces:**
- Consumes: `RouteContext` and `ROUTES`; `MockState`; `authenticate`, `readJson`, `BadJsonError`, `sendJson`, `ok`, `fail`
- Produces: `SIDE_ROUTES: Route[]`, covering:
  - `GET /v1/conversations/{id}`
  - `POST /v1/feedback`
  - `POST /v1/approvals/{toolRunId}`
  - `GET /v1/capabilities`
  - `GET|POST /v1/admin/corpus/*` (501)
  - `POST /__mock/state`
  - `POST /__mock/reset`

- [ ] **Step 1: Write the failing test**

`mock-server/test/side.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/side.test.ts`
Expected: FAIL, because these routes return 404.

- [ ] **Step 3: Write the side routes**

`mock-server/src/routes/side.ts`:

```ts
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
```

- [ ] **Step 4: Register the routes**

In `mock-server/src/server.ts`, add `import { SIDE_ROUTES } from "./routes/side.ts";` to the imports, and add `...SIDE_ROUTES,` at the end of the `ROUTES` array literal, after the chat entry.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run && rtk pnpm typecheck`
Expected: all tests PASS, and tsc exits 0.

- [ ] **Step 6: Commit**

```bash
cd /home/vdloc/Documents/vfstructures-ai-solution
rtk git add mock-server/src/routes/side.ts mock-server/src/server.ts mock-server/test/side.test.ts
rtk git commit -m "feat(mock): add conversations, feedback, approvals, capabilities and mock control endpoints"
```

---

### Task 8: Source viewer — `/v1/sources/{docId}` and generated PDFs

**Files:**
- Create: `mock-server/src/pdf.ts`, `mock-server/src/routes/sources.ts`
- Modify: `mock-server/src/server.ts` (register the routes)
- Test: `mock-server/test/sources.test.ts`

**Interfaces:**
- Consumes: `DOCUMENTS`, `findDocument` and `HIGHLIGHTS` (Task 4); `authenticate`, `sendJson`, `ok`, `fail`; `Route`
- Produces:
  - `buildPdf(title: string, pageCount: number): Buffer`
  - `SOURCE_ROUTES: Route[]`, covering `GET /v1/sources/{docId}?page=N` and `GET /__mock/files/{docId}.pdf?exp=<epoch ms>`

- [ ] **Step 1: Write the failing test**

`mock-server/test/sources.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildPdf } from "../src/pdf.ts";
import { authHeaders, startServer, type TestServer } from "./helpers.ts";

describe("buildPdf", () => {
  it("produces a structurally valid PDF with the requested page count", () => {
    const pdf = buildPdf("NF EN 1992-1-1", 3).toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Count 3");
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(startxref).startsWith("xref")).toBe(true);
    const firstOffset = Number(/0000000000 65535 f \n(\d{10}) 00000 n/.exec(pdf)![1]);
    expect(pdf.slice(firstOffset).startsWith("1 0 obj")).toBe(true);
  });
});

describe("GET /v1/sources/{docId}", () => {
  let srv: TestServer;
  beforeEach(async () => {
    srv = await startServer();
  });
  afterEach(async () => {
    await srv.close();
  });
  const get = (path: string) => fetch(`${srv.base}${path}`, { headers: authHeaders() });

  it("returns a short-lived URL, the page and the highlight region", async () => {
    const res = await get("/v1/sources/en1992-1-1?page=164");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ docId: "en1992-1-1", page: 164, highlight: { page: 164, bbox: [0.12, 0.41, 0.88, 0.47] } });
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const file = await fetch(data.url);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await file.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("returns highlight null for a page without a region", async () => {
    const { data } = await (await get("/v1/sources/en1992-1-1?page=3")).json();
    expect(data.highlight).toBeNull();
  });

  it.each(["page=0", "page=999", "page=abc", ""])("rejects %s with 400", async (query) => {
    expect((await get(`/v1/sources/en1992-1-1?${query}`)).status).toBe(400);
  });

  it("answers 404 for an unknown document", async () => {
    expect((await get("/v1/sources/nope?page=1")).status).toBe(404);
  });

  it("answers 403 for a document outside the user's scope without leaking its title", async () => {
    const res = await get("/v1/sources/restricted-internal-note?page=1");
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("confidentiel");
  });

  it("requires auth", async () => {
    expect((await fetch(`${srv.base}/v1/sources/en1992-1-1?page=1`)).status).toBe(401);
  });

  it("refuses an expired file URL", async () => {
    const res = await fetch(`${srv.base}/__mock/files/en1992-1-1.pdf?exp=${Date.now() - 1000}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run test/sources.test.ts`
Expected: FAIL. `../src/pdf.ts` does not exist.

- [ ] **Step 3: Write the PDF generator**

`mock-server/src/pdf.ts`:

```ts
const escapePdfText = (s: string): string => s.replace(/[\\()]/g, (m) => `\\${m}`).replace(/[^\x20-\x7e]/g, "?");

/** Minimal PDF 1.4: one Helvetica line per A4 page, "<title> - page n". Enough for a viewer to open and jump to a page. */
export function buildPdf(title: string, pageCount: number): Buffer {
  const objects: string[] = [];
  const pageIds = Array.from({ length: pageCount }, (_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pageIds.forEach((pageId, i) => {
    const stream = `BT /F1 18 Tf 72 770 Td (${escapePdfText(`${title} - page ${i + 1}`)}) Tj ET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out, "latin1");
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
```

- [ ] **Step 4: Write the source routes**

`mock-server/src/routes/sources.ts`:

```ts
import { findDocument, HIGHLIGHTS } from "../documents.ts";
import { authenticate, fail, ok, sendJson } from "../http.ts";
import { buildPdf } from "../pdf.ts";
import type { Route } from "../server.ts";

const URL_TTL_MS = 5 * 60 * 1000;
const pdfCache = new Map<string, Buffer>();

export const SOURCE_ROUTES: Route[] = [
  {
    method: "GET",
    pattern: /^\/v1\/sources\/([^/]+)$/,
    handle: ({ req, res, url, requestId }, [docId]) => {
      const auth = authenticate(req);
      if (auth.kind === "error") return sendJson(res, auth.status, fail(auth.code, auth.message, requestId));
      const doc = findDocument(docId!);
      if (!doc) return sendJson(res, 404, fail("source_not_found", "Source not found.", requestId));
      // The real service re-checks scope here (07 §4) and never names a blocked document.
      if (doc.restricted) return sendJson(res, 403, fail("source_forbidden", "This source is outside your access scope.", requestId));
      const page = Number(url.searchParams.get("page"));
      if (!Number.isInteger(page) || page < 1 || page > doc.pages) {
        return sendJson(res, 400, fail("validation_error", `page must be an integer between 1 and ${doc.pages}.`, requestId));
      }
      const expiresAt = Date.now() + URL_TTL_MS;
      const bbox = HIGHLIGHTS[`${doc.docId}:${page}`];
      sendJson(
        res,
        200,
        ok(
          {
            docId: doc.docId,
            title: doc.title,
            edition: doc.edition,
            url: `http://${req.headers.host}/__mock/files/${doc.docId}.pdf?exp=${expiresAt}`,
            page,
            expiresAt: new Date(expiresAt).toISOString(),
            highlight: bbox ? { page, bbox } : null,
          },
          requestId,
        ),
      );
    },
  },
  {
    method: "GET",
    pattern: /^\/__mock\/files\/([^/]+)\.pdf$/,
    handle: ({ res, url, requestId }, [docId]) => {
      const doc = findDocument(docId!);
      if (!doc || doc.restricted) return sendJson(res, 404, fail("source_not_found", "Source not found.", requestId));
      if (Number(url.searchParams.get("exp")) < Date.now()) return sendJson(res, 403, fail("url_expired", "Signed URL expired.", requestId));
      let pdf = pdfCache.get(doc.docId);
      if (!pdf) {
        pdf = buildPdf(doc.title, doc.pages);
        pdfCache.set(doc.docId, pdf);
      }
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": String(pdf.length), "Cache-Control": "no-store" });
      res.end(pdf);
    },
  },
];
```

- [ ] **Step 5: Register the routes**

In `mock-server/src/server.ts`, add `import { SOURCE_ROUTES } from "./routes/sources.ts";` to the imports, and add `...SOURCE_ROUTES,` at the end of the `ROUTES` array literal, after `...SIDE_ROUTES,`.

- [ ] **Step 6: Run tests and typecheck**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run && rtk pnpm typecheck`
Expected: all tests PASS, and tsc exits 0.

- [ ] **Step 7: Commit**

```bash
cd /home/vdloc/Documents/vfstructures-ai-solution
rtk git add mock-server/src/pdf.ts mock-server/src/routes/sources.ts mock-server/src/server.ts mock-server/test/sources.test.ts
rtk git commit -m "feat(mock): serve source viewer URLs with highlight regions and generated PDFs"
```

---

### Task 9: Acceptance script, README, repo index

**Files:**
- Create: `mock-server/scripts/acceptance.sh`, `mock-server/README.md`
- Modify: `/home/vdloc/Documents/vfstructures-ai-solution/README.md` (add one row to the table)

**Interfaces:**
- Consumes: the running server (`pnpm start`) and every route from Tasks 3–8
- Produces: nothing that code depends on

- [ ] **Step 1: Write the acceptance script**

`mock-server/scripts/acceptance.sh`:

```bash
#!/usr/bin/env bash
# Mirrors the acceptance in ship/02-hop-dong.md §7 against the mock.
# Usage: BASE=http://localhost:8787 ./scripts/acceptance.sh   (server started with MOCK_DELAY_SCALE=1)
set -euo pipefail
BASE="${BASE:-http://localhost:8787}"
TOKEN="${TOKEN:-dev-user}"
fail() { echo "FAIL: $*" >&2; exit 1; }

echo "== 1. Events arrive spaced out, not in one flush =="
stamps=$(curl -sN -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"conversationId":"c-accept-1","message":"ping","context":{}}' \
  "$BASE/v1/chat" | while IFS= read -r line; do
    [[ $line == event:* ]] && echo "$(date +%s%3N) ${line#event: }"
  done)
echo "$stamps"
first=$(echo "$stamps" | head -1 | cut -d' ' -f1)
last=$(echo "$stamps" | tail -1 | cut -d' ' -f1)
(( last - first > 1500 )) || fail "stream took $((last - first)) ms; events were buffered"
echo "$stamps" | tail -1 | grep -q ' done$' || fail "last event is not done"

echo "== 2. Disconnect mid-stream is stored as aborted =="
timeout 3 curl -sN -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"conversationId":"c-accept-2","message":"/mock:long","context":{}}' \
  "$BASE/v1/chat" >/dev/null || true
sleep 0.5
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/v1/conversations/c-accept-2" | grep -q '"status":"aborted"' \
  || fail "conversation c-accept-2 has no aborted message"

echo "== 3. Refusal has no token =="
events=$(curl -sN -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"conversationId":"c-accept-3","message":"/mock:refusal","context":{}}' "$BASE/v1/chat" | grep '^event:' | tr '\n' ' ')
[[ $events == "event: status event: refusal event: done " ]] || fail "refusal sequence was: $events"

echo "OK"
```

Run: `chmod +x /home/vdloc/Documents/vfstructures-ai-solution/mock-server/scripts/acceptance.sh`

- [ ] **Step 2: Run the acceptance script against a live server**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && (MOCK_DELAY_SCALE=1 timeout 60 pnpm start &) ; sleep 2; ./scripts/acceptance.sh`
Expected: three sections of output, the event timestamps visibly spread over more than 1.5 s, and a final `OK`.

- [ ] **Step 3: Write the README**

`mock-server/README.md` is written in Vietnamese to match the rest of the repo. Keep the heading structure below, and run the `vietnamese-tech-writing` skill over the prose before committing:

````markdown
# Mock `Assistant.Api` cho Frontend

Server giả lập các đường dẫn `/v1` theo hợp đồng ở `ship/02-hop-dong.md`. Frontend dựng toàn bộ panel AI trên server này trước khi Backend có endpoint nào chạy: đủ 11 sự kiện SSE, các mã lỗi HTTP đến trước luồng, lịch sử hội thoại, trình xem nguồn và trạng thái kill switch.

## Chạy

```bash
cd mock-server
pnpm install
pnpm start                      # http://localhost:8787, độ trễ thật
MOCK_DELAY_SCALE=0.2 pnpm dev   # nhanh gấp 5, tự nạp lại khi sửa mã
pnpm test                       # vitest, độ trễ 0
```

`MOCK_DELAY_SCALE=1` giữ đúng ba mốc của hợp đồng: `status` đầu tiên ≲ 300 ms, `retrieval` ≲ 1,5 s, `token` đầu tiên ≲ 3 s. Lỗi bố cục chỉ lộ ra khi chữ dài dần, nên khi soát giao diện thì giữ nguyên độ trễ thật.

## Nối vào BFF

Route BFF của Next.js trỏ `ASSISTANT_URL=http://localhost:8787`. Mock không kiểm JWT: giá trị sau `Bearer` được dùng làm mã người dùng. Có hai giá trị dành riêng:

| Token | Kết quả |
| --- | --- |
| `expired` | `401 token_expired`, để thử luồng refresh rồi gọi lại |
| `no-assistant` | `403 forbidden`, để thử việc ẩn panel |

Hai hành vi của mock cũng là hai điều route BFF phải làm đúng ở production. Đóng kết nối thì lượt bị hủy và lưu với trạng thái `aborted`. Hai lượt cùng lúc của một người dùng thì lượt sau nhận `429 concurrent_turn`. BFF không truyền `req.signal` xuống upstream thì lượt vẫn chạy tới hết sau khi tab đã đóng, và `scripts/acceptance.sh` sẽ báo lỗi.

## Chọn kịch bản

Viết `/mock:<tên>` ở bất kỳ đâu trong `message`. Chuỗi này đi nguyên trong body qua BFF. Header `x-mock-scenario: <tên>` chỉ được xét khi message không có chuỗi này. Không chỉ định gì thì mock chạy `doc-qa`.

| Tên | Chuỗi sự kiện, trạng thái cần dựng |
| --- | --- |
| `doc-qa` | `status → retrieval → token×n → citation → done`, có công thức KaTeX, citation có `bbox` |
| `app-help` | Hỏi cách dùng ứng dụng, trích từ tài liệu hướng dẫn |
| `long` | Câu trả lời dài, để thử tự cuộn và nút "Xuống câu mới nhất" |
| `refusal` | `status → refusal → done`, không có `token` nào |
| `refusal-no-basis` | Hiện nguồn gần nhất rồi từ chối |
| `error-mid-stream` | `token×3 → error` có `retryable: true` và `partial: true` |
| `error-fatal` | `status → error` có `retryable: false` |
| `warning-citation`, `warning-standard` | Banner `unverified_citation` và `standard_version_mismatch` đến sau chữ |
| `warning-unknown` | Mã `future_check_failed`, FE phải hiện banner chung |
| `degraded-routing` | Banner chế độ giảm |
| `degraded-retrieval-only` | Chỉ có danh sách nguồn, không có chữ |
| `truncated` | Chữ dở dang rồi đến `warning truncated` |
| `unknown-fields` | Mọi payload mang thêm field lạ, FE phải bỏ qua |
| `calc`, `calc-fail`, `calc-no-verdict` | Thẻ kết quả có nhãn đạt, không đạt, hoặc không có nhãn |
| `risk` | Cờ `mismatch` và `unverified` trong dòng, rồi `unverified_number` |
| `unverified-verdict` | Engine không đạt nhưng chữ viết là đạt |
| `slow-tool` | Tool chạy quá 10 giây, `status` báo tiến trình |
| `mixed` | Dòng kế hoạch trước khi tính rồi tra |
| `approval` | `approval_required`, v1.2 không phát sự kiện này nên chỉ có khi chủ động gọi |
| `case-lookup` | Chip tham số, có chip `case_hints` sửa được, dừng chờ bấm **Tra** |
| `case-lookup-insufficient` | Dưới 2 tham số |
| `case-results` | Năm case, có `use_count` và một case theo tiêu chuẩn cũ. Tự chạy khi request mang `context.caseParams` |
| `http-400`, `http-401`, `http-403`, `http-500`, `http-503` | Lỗi HTTP đến trước luồng |
| `http-429-rate` | `429` kèm `Retry-After: 30` |
| `http-429-concurrent` | `429 concurrent_turn` |
| `http-429-quota` | `429` kèm `resetAt` trong body |

## Endpoint khác

| Đường dẫn | Mock trả gì |
| --- | --- |
| `GET /v1/conversations/{id}` | Lịch sử của chủ hội thoại, message cuối `aborted` nếu lượt bị ngắt |
| `POST /v1/feedback` | `204` |
| `POST /v1/approvals/{toolRunId}` | `{ caseId }`, idempotent |
| `GET /v1/sources/{docId}?page=N` | URL có hạn 5 phút, trang và vùng tô sáng. `restricted-internal-note` trả `403` |
| `GET /v1/capabilities` | Mô hình, mô hình dự phòng, tool, phiên bản kho, kill switch |
| `/v1/admin/corpus/*` | `501 not_mocked`, trang quản trị nằm ngoài phạm vi mock |
| `POST /__mock/state` | Bật tắt `killSwitch` và `fallbackActive`, chỉ có ở mock |
| `POST /__mock/reset` | Xóa toàn bộ trạng thái, chỉ có ở mock |

## Câu hỏi mở cần hai đội ký

Hợp đồng chưa nói tới những điểm dưới đây. Mock tạm chọn một cách và đánh dấu `MOCK-ONLY` trong `src/contract.ts`. Không coi chúng là hợp đồng cho tới khi Backend và Frontend ký lại.

1. Tên field của `ApiResponse<T>`: mock dùng `success, code, message, data, requestId`.
2. Giá trị của `status.phase`: mock dùng `routing, planning, retrieving, calculating, writing`.
3. Dạng `bbox`: mock dùng `[x0, y0, x1, y1]` theo tỉ lệ trang, gốc ở góc trên bên trái.
4. Gửi lại tham số đã xác nhận khi bấm **Tra**: mock nhận `context.caseParams`.
5. Kết quả tra case: mock trả qua `tool_call find_similar_cases` rồi `tool_result.outputs.cases`. FE ghép `tool_result` với `tool_call` đứng trước nó.
6. Dưới 2 tham số: mock trả `retrieval` có một tham số rồi `done`.
7. Cờ case theo tiêu chuẩn cũ: mock thêm `isCurrentStandard`.
8. Dạng body của `GET /v1/conversations/{id}`, `POST /v1/feedback`, `GET /v1/capabilities` và `GET /v1/sources/{docId}`.
9. `/v1/admin/corpus/*`: chưa có schema, mock trả `501`.

## Nghiệm thu

```bash
MOCK_DELAY_SCALE=1 pnpm start &
./scripts/acceptance.sh
```

Script kiểm ba điều giống nghiệm thu ở §7 của hợp đồng: sự kiện đến rời rạc theo thời gian, ngắt kết nối giữa luồng thì hội thoại ghi `aborted`, và từ chối không có `token` nào. Khi chạy qua BFF, đổi `BASE` sang địa chỉ của BFF.
````

- [ ] **Step 4: Add the repo index row**

In `/home/vdloc/Documents/vfstructures-ai-solution/README.md`, add this row to the table, directly below the `cong-cu/` row:

```markdown
| [`mock-server/`](mock-server/README.md) | Server giả lập `Assistant.Api` `/v1` để Frontend dựng panel AI trước khi Backend chạy |
```

- [ ] **Step 5: Full verification**

Run: `cd /home/vdloc/Documents/vfstructures-ai-solution/mock-server && rtk pnpm vitest run && rtk pnpm typecheck`
Expected: all tests PASS, and tsc exits 0.

- [ ] **Step 6: Commit**

```bash
cd /home/vdloc/Documents/vfstructures-ai-solution
rtk git add mock-server/scripts/acceptance.sh mock-server/README.md README.md
rtk git commit -m "docs(mock): add acceptance script, scenario catalogue and open contract questions"
```
