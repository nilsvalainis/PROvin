/**
 * CheckCar.vin pilnās atskaites imports no operatora pārlūka (PROVIN userscript).
 *
 * Operators pats atver nopirkto atskaiti checkcar.vin savā pārlūkā un nospiež „Nosūtīt uz PROVIN”.
 * Serveris checkcar.vin neatver (Cloudflare) un neko nepērk.
 *
 * POST { action: "prepare", vin, text, html?, pageUrl?, groups: [{label, urls[]}] }
 *   -> atrod jaunāko pasūtījumu pēc VIN, ieraksta `cc_vin` vēstures rindas + RAW tekstu,
 *      atgriež foto grupu plānu (nosaukumi) un jau zināmos foto URL.
 * POST { action: "attach", sessionId, vin, photos: [{title, id, sourceUrl}] }
 *   -> foto, kas jau augšupielādēti ar `/api/admin/cc-vin-photo`, piesaista galerijas grupām.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeCcVinPhotoId } from "@/lib/admin-cc-vin-photo-store";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import {
  applyCheckcarImportToBlock,
  attachCheckcarPhotos,
  CHECKCAR_IMPORT_HTML_MAX,
  CHECKCAR_IMPORT_TEXT_MAX,
  checkcarHtmlToText,
  checkcarPageVinMismatch,
  knownCcVinSourceUrls,
  parseCheckcarImport,
  type CheckcarAttachPhoto,
} from "@/lib/checkcar-full-report";
import {
  findLatestOrderIdByVin,
  readAutobidOriginalHint,
  writeCcVinBlock,
} from "@/lib/checkcar-import-server";
import { describeCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import { loadEcbDailyRates } from "@/lib/currency-eur-convert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

function rigaToday(): string {
  const parts = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function orderOk(sessionId: string): Promise<boolean> {
  const order = await getCheckoutSessionDetail(sessionId).catch(() => null);
  return Boolean(order && order.checkoutLine !== "provin_select");
}

async function prepare(b: Record<string, unknown>) {
  const vin = str(b.vin).replace(/[\s-]/g, "").toUpperCase();
  if (!VIN_RE.test(vin)) return bad("invalid_vin");
  const html = str(b.html);
  const text = str(b.text);
  const pageUrl = str(b.pageUrl).slice(0, 500);
  if (text.length > CHECKCAR_IMPORT_TEXT_MAX || html.length > CHECKCAR_IMPORT_HTML_MAX) return bad("too_large", 413);
  const readable = text.trim() ? text : checkcarHtmlToText(html);
  if (!readable.trim()) return bad("page_not_ready");
  if (checkcarPageVinMismatch(readable, pageUrl, vin)) return bad("vin_mismatch");

  const sessionId = await findLatestOrderIdByVin(vin);
  if (!sessionId) return bad("order_not_found", 404);

  await loadEcbDailyRates().catch(() => undefined);
  const imported = parseCheckcarImport({ vin, text, html, pageUrl, groups: b.groups as never });
  const written = await writeCcVinBlock(sessionId, (prev) => applyCheckcarImportToBlock(prev, imported, rigaToday()));
  if (!written.ok) return bad(`write_failed:${written.error}`, 503);

  const autobid = await readAutobidOriginalHint(vin);
  return NextResponse.json({
    ok: true,
    sessionId,
    summary: describeCcVinParsedReport(imported.parsed),
    fallbackRows: imported.fallbackRows,
    notes: imported.parsed.notes.slice(0, 20),
    groups: imported.groups,
    knownUrls: knownCcVinSourceUrls(written.block),
    autobid,
  });
}

function parsePhotos(raw: unknown): CheckcarAttachPhoto[] {
  if (!Array.isArray(raw)) return [];
  const out: CheckcarAttachPhoto[] = [];
  for (const item of raw.slice(0, 100)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = str(o.id).trim();
    if (!isSafeCcVinPhotoId(id)) continue;
    const sourceUrl = str(o.sourceUrl).trim().slice(0, 2000);
    out.push({ id, title: str(o.title).slice(0, 120), sourceUrl: sourceUrl.startsWith("https://") ? sourceUrl : "" });
  }
  return out;
}

async function attach(b: Record<string, unknown>) {
  const sessionId = str(b.sessionId).trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return bad("invalid_session");
  if (!(await orderOk(sessionId))) return bad("not_found", 404);
  const photos = parsePhotos(b.photos);
  if (photos.length === 0) return NextResponse.json({ ok: true, added: 0 });
  let added = 0;
  const written = await writeCcVinBlock(sessionId, (prev) => {
    const r = attachCheckcarPhotos(prev, photos);
    added = r.added;
    return r.block;
  });
  if (!written.ok) return bad(`write_failed:${written.error}`, 503);
  return NextResponse.json({ ok: true, added });
}

export async function POST(req: Request) {
  try {
    if (!(await getAdminSession())) return bad("unauthorized", 401);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("invalid_json");
    }
    if (!body || typeof body !== "object") return bad("invalid_body");
    const b = body as Record<string, unknown>;
    if (b.action === "prepare") return await prepare(b);
    if (b.action === "attach") return await attach(b);
    return bad("invalid_action");
  } catch (e) {
    console.error("[checkcar-import] POST", e instanceof Error ? e.message : e);
    return bad("server_error", 500);
  }
}
