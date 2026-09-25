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
