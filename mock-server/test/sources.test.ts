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
