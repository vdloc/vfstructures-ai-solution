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
