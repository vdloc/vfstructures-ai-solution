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
