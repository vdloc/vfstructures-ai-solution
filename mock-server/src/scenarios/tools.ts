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
