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
