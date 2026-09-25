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
