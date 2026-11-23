import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { sendAdminPush } from "@/lib/admin-push";
import { listAdminOrders } from "@/lib/admin-orders";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { applyCsddPaidReportToOrderDraft } from "@/lib/csdd-paid-auto";
import { readCsddPaidAutoJob, updateCsddPaidAutoJob } from "@/lib/csdd-paid-auto-store";
import type { CsddPdfParseResult } from "@/lib/csdd-pdf-ingest";
import {
  CSDD_PDF_INBOX_MAX_BYTES,
  CSDD_PDF_INBOX_WINDOW_MS,
  csddPdfFileName,
  csddPdfIdentity,
  looksLikeCsddReportText,
  matchCsddPdfOrder,
  type CsddPdfOrderCandidate,
} from "@/lib/csdd-pdf-inbox-logic";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";
import { saveFileToOrderDropboxFolder } from "@/lib/order-dropbox";
import { ingestSourcePdfFile } from "@/lib/pdf-source-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ienākošā e.csdd izziņas PDF savākšana (Google Apps Script info@provin.lv kontā, docs/apps-script/csdd-pdf-inbox.md).
 * `Authorization: Bearer <CSDD_PDF_INBOX_TOKEN>` (bez env >= 24 zīmēm - izslēgts).
 * Body: { pdfBase64, fileName, messageId?, receivedAt? }.
 * -> { status: "attached", orderId, dropboxPath, duplicate } | { status: "no_order" } | { status: "not_csdd" }
 * Pasūtījumā: PDF Dropbox pasūtījuma mapē + teksts CSDD blokā (ar roku / jau ielasītie lauki netiek pārrakstīti).
 */

function verifyToken(header: string | null): boolean {
  const secret = (process.env.CSDD_PDF_INBOX_TOKEN ?? "").trim();
  if (secret.length < 24) return false;
  const given = extractBearerToken(header);
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function candidates(nowMs: number): Promise<CsddPdfOrderCandidate[]> {
  const { rows } = await listAdminOrders();
  const recent = rows.filter(
    (r) => !r.isDemo && (r.isManual || r.paymentStatus === "paid") && nowMs - r.created * 1000 <= CSDD_PDF_INBOX_WINDOW_MS && r.checkoutLine !== "provin_select",
  );
  return Promise.all(
    recent.slice(0, 200).map(async (r) => {
      const [draft, job] = await Promise.all([readOrderDraft(r.id).catch(() => null), readCsddPaidAutoJob(r.id)]);
      const csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
      return {
        id: r.id,
        createdMs: r.created * 1000,
        keys: [r.vin, draft?.orderEdits?.vin, draft?.orderEdits?.licensePlate, csdd.registrationNumber, csdd.vin, csdd.registry?.data?.registrationNumber, csdd.registry?.data?.vin],
        autoJobPlate: job?.plate ?? null,
      };
    }),
  );
}

export async function POST(req: Request) {
  if (!verifyToken(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 160) : "izzina.pdf";
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  if (bytes.byteLength < 100 || bytes.byteLength > CSDD_PDF_INBOX_MAX_BYTES || Buffer.from(bytes.slice(0, 5)).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ status: "not_csdd", reason: "not_pdf" });
  }

  let parsed: CsddPdfParseResult;
  let text = "";
  try {
    const ingest = await ingestSourcePdfFile({ target: "csdd", buffer: bytes.slice().buffer, fileName, preferAi: false });
    parsed = ingest.result as CsddPdfParseResult;
    text = ingest.extract.text;
  } catch (e) {
    console.error("[csdd-pdf-inbox] parse failed", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return NextResponse.json({ status: "not_csdd", reason: "unreadable" });
  }
  if (!looksLikeCsddReportText(text)) return NextResponse.json({ status: "not_csdd" });
  const id = csddPdfIdentity(parsed.fields);
  if (!id.plate && !id.vin) return NextResponse.json({ status: "not_csdd", reason: "no_identity" });

  const now = Date.now();
  const orderId = matchCsddPdfOrder(await candidates(now), id, now);
  if (!orderId) {
    await Promise.resolve()
      .then(() =>
        sendAdminPush({
          title: "CSDD PDF bez pasūtījuma",
          body: `Saņemta CSDD izziņa (${id.plate || id.vin}), bet pēdējās 7 dienās pasūtījums nav atrasts.`,
          url: "/admin",
          tag: "csdd-pdf-inbox",
          audience: "pro",
        }),
      )
      .catch(() => undefined);
    return NextResponse.json({ status: "no_order" });
  }

  const md5 = createHash("md5").update(bytes).digest("hex");
  const saved = await saveFileToOrderDropboxFolder(orderId, csddPdfFileName(id.plate || id.vin, md5), bytes);

  // Teksts CSDD blokā tikai, ja automātiskā izziņa to vēl nav ielikusi (tie paši dati).
  const job = await readCsddPaidAutoJob(orderId);
  const raw = parsed.rawUnprocessedData || text;
  let applied = Boolean(job?.appliedAt);
  if (!applied && !saved?.duplicate && raw.trim()) applied = await applyCsddPaidReportToOrderDraft(orderId, raw).catch(() => false);
  if (job) {
    await updateCsddPaidAutoJob(orderId, (c) =>
      c ? { ...c, ...(saved ? { pdfPath: saved.path } : {}), pdfReceivedAt: new Date().toISOString(), ...(applied && !c.appliedAt ? { appliedAt: new Date().toISOString() } : {}) } : null,
    ).catch(() => undefined);
  }
  console.info("[csdd-pdf-inbox] attached", { orderId: orderId.slice(-8), dropbox: Boolean(saved), duplicate: saved?.duplicate ?? false, applied });
  return NextResponse.json({ status: saved?.duplicate ? "duplicate" : "attached", orderId, dropboxPath: saved?.path ?? null, applied });
}
