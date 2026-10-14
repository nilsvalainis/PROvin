import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isIrissScanStoreEnabled, isSafeIrissScanId, listIrissScan, readIrissScan, writeIrissScan } from "@/lib/iriss-scan-store";
import { coerceIrissListingLinkList } from "@/lib/iriss-listing-link-lists";
import { appendEcarstradeLinksToScan, previewEcarstradeLinksForScan } from "@/lib/iriss-scan-ecarstrade-links";
import { emptyIrissScanRecord, type IrissScanRecord } from "@/lib/iriss-scan-types";

export const runtime = "nodejs";

function recordFromBody(raw: unknown): IrissScanRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && isSafeIrissScanId(o.id) ? o.id : "11111111-1111-4111-8111-111111111111";
  const base = emptyIrissScanRecord(id, new Date().toISOString());
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  return {
    ...base,
    brandModel: str("brandModel"),
    vin: str("vin"),
    listingLinkAuto1: coerceIrissListingLinkList(o.listingLinkAuto1),
    listingLinkOpenline: coerceIrissListingLinkList(o.listingLinkOpenline),
    listingLinkAutobid: coerceIrissListingLinkList(o.listingLinkAutobid),
    listingLinkEcarstrade: coerceIrissListingLinkList(o.listingLinkEcarstrade),
    listingLinkMobile: coerceIrissListingLinkList(o.listingLinkMobile),
    listingLinksOther: coerceIrissListingLinkList(o.listingLinksOther),
  };
}

function summarize(previews: ReturnType<typeof previewEcarstradeLinksForScan>[]) {
  return {
    results: previews,
    addedCount: previews.reduce((n, p) => n + p.added.length, 0),
    updatedCount: previews.filter((p) => p.added.length > 0).length,
    skippedCount: previews.filter((p) => p.added.length === 0).length,
  };
}

export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissScanStoreEnabled()) return NextResponse.json({ error: "store_disabled" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (id) {
    if (!isSafeIrissScanId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    const rec = await readIrissScan(id);
    if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ applied: false, ...summarize([previewEcarstradeLinksForScan(rec)]) });
  }

  const rows = await listIrissScan();
  return NextResponse.json({ applied: false, ...summarize(rows.map((row) => previewEcarstradeLinksForScan(row))) });
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissScanStoreEnabled()) return NextResponse.json({ error: "store_disabled" }, { status: 503 });

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const apply = body.apply !== false;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const draft = recordFromBody(body.record);
  const rows: IrissScanRecord[] = [];
  if (draft && !id) {
    if (!apply) {
      return NextResponse.json({ applied: false, ...summarize([previewEcarstradeLinksForScan(draft)]) });
    }
    const next = appendEcarstradeLinksToScan(draft);
    return NextResponse.json({ applied: false, saved: [next.record], ...summarize([next.preview]) });
  }
  if (id) {
    if (!isSafeIrissScanId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    const rec = await readIrissScan(id);
    if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
    rows.push(rec);
  } else {
    rows.push(...(await listIrissScan()));
  }

  const previews = [];
  const saved: IrissScanRecord[] = [];
  for (const rec of rows) {
    if (!apply) {
      previews.push(previewEcarstradeLinksForScan(rec));
      continue;
    }
    const next = appendEcarstradeLinksToScan(rec);
    previews.push(next.preview);
    if (next.preview.added.length === 0) continue;
    const w = await writeIrissScan(next.record);
    if (!w.ok) return NextResponse.json({ error: w.error }, { status: 500 });
    const stored = (await readIrissScan(next.record.id)) ?? next.record;
    saved.push(stored);
  }

  return NextResponse.json({ applied: apply, saved, ...summarize(previews) });
}
