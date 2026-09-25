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
