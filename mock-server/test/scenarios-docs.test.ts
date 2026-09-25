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
