/**
 * CheckCar.vin pilnās atskaites imports no operatora pārlūka (PROVIN userscript).
 *
 * Operators pats atver nopirkto atskaiti checkcar.vin savā pārlūkā un nospiež „Nosūtīt uz PROVIN”.
 * Serveris checkcar.vin neatver (Cloudflare) un neko nepērk.
 *
 * JSON POST { action: "prepare", vin, text, html?, data?, pageUrl?, groups: [{label, urls[]}], hint?: {kind, id}, confirmHint? }
 *   `data` - lapas datu stāvoklis (`__NUXT__` report.data, objekts vai JSON teksts): visi ieraksti, arī sakļautie
 *   un lapā nerenderētie (servera savācējs /opt/provin-checkcar/collect.mjs).
 *   -> mērķis pēc VIN (Stripe, melnraksts, CSDD/VIN SCAN bloki, meklēšanas indekss): atvērtā lapa, ja tai ir
 *      šis VIN (citādi 409 hint_vin_mismatch; ar confirmHint=true ieliek tur tik un tā); bez lapas - jaunākais,
 *      ieraksta `cc_vin` vēstures rindas + RAW tekstu, atgriež foto grupu plānu un jau zināmos foto URL.
 * multipart POST { action: "photo", kind, id, file } -> viens JPEG mērķa cc_vin krātuvē (ūdenszīmes kā ir).
 * JSON POST { action: "attach", kind, id, photos: [{title, id, sourceUrl}] } -> foto piesaiste grupām.
 * GET ?kind=quick_eval&id=&photoId= -> ātrā vērtējuma CheckCar foto (pasūtījumam - /api/admin/cc-vin-photo).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import {
  CC_VIN_PHOTO_MAX_BYTES,
  isSafeCcVinPhotoId,
  makeCcVinPhotoId,
  readCcVinPhotoJpeg,
  writeCcVinPhotoJpeg,
} from "@/lib/admin-cc-vin-photo-store";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { jpegFromAdminPhotoUpload } from "@/lib/admin-photo-normalize";
import { describeCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import { CC_VIN_MAX_PHOTOS, flattenCcVinPhotoGroups, normalizeCcVinPhotoGroups } from "@/lib/cc-vin-photo-types";
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
import type { CheckcarTargetKind } from "@/lib/checkcar-import-orders";
import {
  checkcarPhotoSession,
  checkcarTargetExists,
  findCheckcarTarget,
  readAutobidOriginalHint,
  writeCheckcarBlock,
} from "@/lib/checkcar-import-server";
import { CHECKCAR_REPORT_DATA_MAX } from "@/lib/checkcar-report-data";
import { loadEcbDailyRates } from "@/lib/currency-eur-convert";
import { isSafeListingPeekId } from "@/lib/listing-peek-photos";
import { readQuickEval } from "@/lib/quick-eval-store";

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

/** Mērķis no klienta: tikai zināmi veidi un drošs id. */
function parseTarget(kindRaw: unknown, idRaw: unknown): { kind: CheckcarTargetKind; id: string } | null {
  const kind = str(kindRaw);
  const id = str(idRaw).trim();
  if (kind === "order" && isSafeOrderDraftSessionId(id)) return { kind, id };
  if (kind === "quick_eval" && isSafeListingPeekId(id.toLowerCase())) return { kind, id: id.toLowerCase() };
  return null;
}

async function prepare(b: Record<string, unknown>) {
  const vin = str(b.vin).replace(/[\s-]/g, "").toUpperCase();
  if (!VIN_RE.test(vin)) return bad("invalid_vin");
  const html = str(b.html);
  const text = str(b.text);
  const pageUrl = str(b.pageUrl).slice(0, 500);
  if (text.length > CHECKCAR_IMPORT_TEXT_MAX || html.length > CHECKCAR_IMPORT_HTML_MAX) return bad("too_large", 413);
  const data = b.data == null ? undefined : b.data;
  if (data !== undefined && (typeof data === "string" ? data : JSON.stringify(data)).length > CHECKCAR_REPORT_DATA_MAX) {
    return bad("too_large", 413);
  }
  const readable = text.trim() ? text : checkcarHtmlToText(html);
  if (!readable.trim()) return bad("page_not_ready");
  if (checkcarPageVinMismatch(readable, pageUrl, vin)) return bad("vin_mismatch");

  const hintRaw = b.hint && typeof b.hint === "object" ? (b.hint as Record<string, unknown>) : {};
  const hint = parseTarget(hintRaw.kind, hintRaw.id);
  const { target, alternatives, hintMismatch } = await findCheckcarTarget(vin, hint, {
    confirmHint: b.confirmHint === true,
  });
  if (hintMismatch) {
    /* Atvērtā lapa ir cita auto (vai tai vēl nav VIN): userscript prasa operatoram apstiprinājumu. */
    return NextResponse.json(
      {
        ok: false,
        error: "hint_vin_mismatch",
        vin,
        hint: { kind: hintMismatch.kind, id: hintMismatch.id },
        hintVins: hintMismatch.vins,
        alternatives: alternatives.slice(0, 10).map((a) => ({ kind: a.kind, id: a.id })),
      },
      { status: 409 },
    );
  }
  if (!target) return NextResponse.json({ ok: false, error: "order_not_found", vin }, { status: 404 });
  if (b.confirmHint === true && !(await checkcarTargetExists(target.kind, target.id))) return bad("not_found", 404);

  await loadEcbDailyRates().catch(() => undefined);
  const imported = parseCheckcarImport({ vin, text, html, pageUrl, groups: b.groups as never, data });
  const written = await writeCheckcarBlock(target.kind, target.id, (prev) =>
    applyCheckcarImportToBlock(prev, imported, rigaToday()),
  );
  if (!written.ok) return bad(`write_failed:${written.error}`, 503);

  const autobid = await readAutobidOriginalHint(vin);
  return NextResponse.json({
    ok: true,
    target: { kind: target.kind, id: target.id },
    /** Saderība ar 1.28.0 skriptu: pasūtījuma id. */
    sessionId: target.kind === "order" ? target.id : "",
    alternatives: alternatives.slice(0, 10).map((a) => ({ kind: a.kind, id: a.id })),
    summary: describeCcVinParsedReport(imported.parsed),
    fallbackRows: imported.fallbackRows,
    notes: imported.parsed.notes.slice(0, 20),
    groups: imported.groups,
    knownUrls: knownCcVinSourceUrls(written.block),
    autobid,
  });
}

async function photo(form: FormData) {
  const target = parseTarget(form.get("kind"), form.get("id"));
  if (!target) return bad("invalid_target");
  if (!(await checkcarTargetExists(target.kind, target.id))) return bad("not_found", 404);
  const file = form.get("file");
  if (!(file instanceof Blob)) return bad("missing_file");
  if (target.kind === "quick_eval") {
    const doc = await readQuickEval(target.id);
    const block = doc?.sourceBlocks.cc_vin;
    const count = block ? flattenCcVinPhotoGroups(normalizeCcVinPhotoGroups(block.photoGroups, block.photos)).length : 0;
    if (count >= CC_VIN_MAX_PHOTOS) return bad("photo_limit");
  }
  const normalized = await jpegFromAdminPhotoUpload(Buffer.from(await file.arrayBuffer()), CC_VIN_PHOTO_MAX_BYTES, {
    coverCheckcarWatermark: false,
  });
  if (!normalized.ok) return bad(normalized.error);
  const photoId = makeCcVinPhotoId();
  try {
    await writeCcVinPhotoJpeg(checkcarPhotoSession(target.kind, target.id), photoId, normalized.jpeg);
  } catch (e) {
    return bad(`write_failed:${e instanceof Error ? e.message : "unknown"}`, 503);
  }
  return NextResponse.json({ ok: true, id: photoId });
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
  const target = parseTarget(b.kind ?? (b.sessionId ? "order" : ""), b.id ?? b.sessionId);
  if (!target) return bad("invalid_target");
  if (!(await checkcarTargetExists(target.kind, target.id))) return bad("not_found", 404);
  const photos = parsePhotos(b.photos);
  if (photos.length === 0) return NextResponse.json({ ok: true, added: 0 });
  let added = 0;
  const written = await writeCheckcarBlock(target.kind, target.id, (prev) => {
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
    if ((req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
      const form = await req.formData();
      if (String(form.get("action") ?? "") !== "photo") return bad("invalid_action");
      return await photo(form);
    }
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

export async function GET(req: Request) {
  try {
    if (!(await getAdminSession())) return bad("unauthorized", 401);
    const url = new URL(req.url);
    const target = parseTarget(url.searchParams.get("kind"), url.searchParams.get("id"));
    const photoId = (url.searchParams.get("photoId") ?? "").trim();
    if (!target || target.kind !== "quick_eval" || !isSafeCcVinPhotoId(photoId)) return bad("invalid_request");
    const buf = await readCcVinPhotoJpeg(checkcarPhotoSession(target.kind, target.id), photoId);
    if (!buf) return bad("not_found", 404);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" },
    });
  } catch (e) {
    console.error("[checkcar-import] GET", e instanceof Error ? e.message : e);
    return bad("server_error", 500);
  }
}
