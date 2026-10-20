import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { parseIrissPasutijumsListingLinks } from "@/lib/iriss-listing-link-lists";
import {
  appendEcarstradeLinksToPasutijums,
  previewEcarstradeLinksForPasutijums,
  replaceEcarstradeLinksOnPasutijums,
} from "@/lib/iriss-pasutijumi-ecarstrade-links";
import { irissPasutijumsToListRow } from "@/lib/iriss-pasutijumi-list-row";
import { IRISS_STALE_REVISION } from "@/lib/iriss-pasutijumi-save-safety";
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
    productionYears: str("productionYears"),
    totalBudget: str("totalBudget"),
    engineType: str("engineType"),
    transmission: str("transmission"),
    bodyType: str("bodyType"),
    driveType: str("driveType"),
    seatCount: str("seatCount"),
    maxMileage: str("maxMileage"),
    preferredColors: str("preferredColors"),
    nonPreferredColors: str("nonPreferredColors"),
    equipmentRequired: str("equipmentRequired"),
    dealVat21Required: o.dealVat21Required === true,
    ...parseIrissPasutijumsListingLinks(o),
  };
}

function previewOf(rec: IrissPasutijumsRecord, replace: boolean) {
  return replace ? replaceEcarstradeLinksOnPasutijums(rec).preview : previewEcarstradeLinksForPasutijums(rec);
}

function summarize(previews: ReturnType<typeof previewEcarstradeLinksForPasutijums>[]) {
  return {
    results: previews,
    addedCount: previews.reduce((n, p) => n + p.added.length, 0),
    updatedCount: previews.filter((p) => p.changed).length,
    skippedCount: previews.filter((p) => !p.changed).length,
  };
}

export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
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
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  if (!isIrissPasutijumiStoreEnabled()) return NextResponse.json({ error: "store_disabled" }, { status: 503 });

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const apply = body.apply !== false;
  const replace = body.replace === true;
  const applyLinks = replace ? replaceEcarstradeLinksOnPasutijums : appendEcarstradeLinksToPasutijums;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const draft = recordFromBody(body.record);
  if (draft && !id) {
    if (!apply) {
      return NextResponse.json({ applied: false, replace, ...summarize([previewOf(draft, replace)]) });
    }
    const next = applyLinks(draft);
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
    if (!apply) {
      previews.push(previewOf(rec, replace));
      continue;
    }
    const next = applyLinks(rec);
    previews.push(next.preview);
    if (!next.preview.changed) continue;
    const w = await writeIrissPasutijums(next.record, { expectedWorkspaceRevision: rec.workspaceRevision });
    if (!w.ok) {
      if (w.stale || w.error === IRISS_STALE_REVISION) {
        next.preview.added = [];
        next.preview.changed = false;
        next.preview.skippedReason = "konflikts saglabājot, mēģini vēlreiz";
        continue;
      }
      return NextResponse.json({ error: w.error }, { status: 500 });
    }
    const stored = w.record ?? (await readIrissPasutijums(next.record.id)) ?? next.record;
    saved.push(irissPasutijumsToListRow(stored));
  }

  return NextResponse.json({ applied: apply, replace, saved, ...summarize(previews) });
}
