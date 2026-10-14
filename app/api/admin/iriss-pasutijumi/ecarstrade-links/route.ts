import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { parseIrissPasutijumsListingLinks } from "@/lib/iriss-listing-link-lists";
import {
  appendEcarstradeLinksToPasutijums,
  hasOtherAuctionListingLinks,
  previewEcarstradeLinksForPasutijums,
} from "@/lib/iriss-pasutijumi-ecarstrade-links";
import { irissPasutijumsToListRow } from "@/lib/iriss-pasutijumi-list-row";
import {
  isIrissPasutijumiStoreEnabled,
  isSafeIrissPasutijumsId,
  listIrissPasutijumi,
  readIrissPasutijums,
  writeIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";
import { emptyIrissPasutijums, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export const runtime = "nodejs";
export const maxDuration = 120;

function recordFromBody(raw: unknown): IrissPasutijumsRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && isSafeIrissPasutijumsId(o.id) ? o.id : "11111111-1111-4111-8111-111111111111";
  const base = emptyIrissPasutijums(id, new Date().toISOString());
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  return {
    ...base,
    brandModel: str("brandModel"),
    vin: str("vin"),
    ...parseIrissPasutijumsListingLinks(o),
  };
}

function summarize(previews: ReturnType<typeof previewEcarstradeLinksForPasutijums>[]) {
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
  if (!isIrissPasutijumiStoreEnabled()) return NextResponse.json({ error: "store_disabled" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (id) {
    if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    const rec = await readIrissPasutijums(id);
    if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ applied: false, ...summarize([previewEcarstradeLinksForPasutijums(rec)]) });
  }

  const rows = await listIrissPasutijumi();
  const previews = [];
  for (const row of rows) {
    const rec = await readIrissPasutijums(row.id);
    if (rec) previews.push(previewEcarstradeLinksForPasutijums(rec));
  }
  return NextResponse.json({ applied: false, ...summarize(previews) });
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissPasutijumiStoreEnabled()) return NextResponse.json({ error: "store_disabled" }, { status: 503 });

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
  if (draft && !id) {
    if (!apply) {
      return NextResponse.json({ applied: false, ...summarize([previewEcarstradeLinksForPasutijums(draft)]) });
    }
    const next = appendEcarstradeLinksToPasutijums(draft);
    return NextResponse.json({
      applied: false,
      saved: [irissPasutijumsToListRow(next.record)],
      ...summarize([next.preview]),
    });
  }

  const rows: IrissPasutijumsRecord[] = [];
  if (id) {
    if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    const rec = await readIrissPasutijums(id);
    if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
    rows.push(rec);
  } else {
    const listed = await listIrissPasutijumi();
    for (const row of listed) {
      const rec = await readIrissPasutijums(row.id);
      if (rec) rows.push(rec);
    }
  }

  const previews = [];
  const saved = [];
  for (const rec of rows) {
    if (!hasOtherAuctionListingLinks(rec) && !rec.brandModel.trim()) {
      const preview = previewEcarstradeLinksForPasutijums(rec);
      previews.push(preview);
      continue;
    }
    if (!apply) {
      previews.push(previewEcarstradeLinksForPasutijums(rec));
      continue;
    }
    const next = appendEcarstradeLinksToPasutijums(rec);
    previews.push(next.preview);
    if (next.preview.added.length === 0) continue;
    const w = await writeIrissPasutijums(next.record, { expectedWorkspaceRevision: rec.workspaceRevision });
    if (!w.ok) return NextResponse.json({ error: w.error }, { status: 500 });
    const stored = w.record ?? (await readIrissPasutijums(next.record.id)) ?? next.record;
    saved.push(irissPasutijumsToListRow(stored));
  }

  return NextResponse.json({ applied: apply, saved, ...summarize(previews) });
}
