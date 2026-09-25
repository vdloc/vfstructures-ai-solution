import { findDocument, HIGHLIGHTS } from "../documents.ts";
import { authenticate, fail, ok, sendJson } from "../http.ts";
import { buildPdf } from "../pdf.ts";
import type { Route } from "../server.ts";

const URL_TTL_MS = 5 * 60 * 1000;
const pdfCache = new Map<string, Buffer>();

export const SOURCE_ROUTES: Route[] = [
  {
    method: "GET",
    pattern: /^\/v1\/sources\/([^/]+)$/,
    handle: ({ req, res, url, requestId }, [docId]) => {
      const auth = authenticate(req);
      if (auth.kind === "error") return sendJson(res, auth.status, fail(auth.code, auth.message, requestId));
      const doc = findDocument(docId!);
      if (!doc) return sendJson(res, 404, fail("source_not_found", "Source not found.", requestId));
      // The real service re-checks scope here (07 §4) and never names a blocked document.
      if (doc.restricted) return sendJson(res, 403, fail("source_forbidden", "This source is outside your access scope.", requestId));
      const page = Number(url.searchParams.get("page"));
      if (!Number.isInteger(page) || page < 1 || page > doc.pages) {
        return sendJson(res, 400, fail("validation_error", `page must be an integer between 1 and ${doc.pages}.`, requestId));
      }
      const expiresAt = Date.now() + URL_TTL_MS;
      const bbox = HIGHLIGHTS[`${doc.docId}:${page}`];
      sendJson(
        res,
        200,
        ok(
          {
            docId: doc.docId,
            title: doc.title,
            edition: doc.edition,
            url: `http://${req.headers.host}/__mock/files/${doc.docId}.pdf?exp=${expiresAt}`,
            page,
            expiresAt: new Date(expiresAt).toISOString(),
            highlight: bbox ? { page, bbox } : null,
          },
          requestId,
        ),
      );
    },
  },
  {
    method: "GET",
    pattern: /^\/__mock\/files\/([^/]+)\.pdf$/,
    handle: ({ res, url, requestId }, [docId]) => {
      const doc = findDocument(docId!);
      if (!doc || doc.restricted) return sendJson(res, 404, fail("source_not_found", "Source not found.", requestId));
      if (Number(url.searchParams.get("exp")) < Date.now()) return sendJson(res, 403, fail("url_expired", "Signed URL expired.", requestId));
      let pdf = pdfCache.get(doc.docId);
      if (!pdf) {
        pdf = buildPdf(doc.title, doc.pages);
        pdfCache.set(doc.docId, pdf);
      }
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": String(pdf.length), "Cache-Control": "no-store" });
      res.end(pdf);
    },
  },
];
