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
