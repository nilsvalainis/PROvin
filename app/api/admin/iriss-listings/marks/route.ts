import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { applyIrissListingMarkPatch, parseIrissListingMarkPatch, type IrissListingMarkPatch } from "@/lib/iriss-listing-marks";
import { isIrissPasutijumiStoreEnabled, readIrissListingMarks, writeIrissListingMarks } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

/** GET - visas Sludinājumu piezīmes un favorīti (kopīgi visām ierīcēm). */
export async function GET() {
  const gate = await requireIrissSectionApi("sludinajumi");
  if (!gate.ok) return gate.response;
  if (!isIrissPasutijumiStoreEnabled()) return NextResponse.json({ error: "store_disabled" }, { status: 503, headers: noStore });
  return NextResponse.json({ ok: true, marks: await readIrissListingMarks() }, { headers: noStore });
}

/** PATCH { patches: [{ id, note?, fav? }] } - maina tikai nosauktos auto (citu ierīču izmaiņas paliek). */
export async function PATCH(req: Request) {
  const gate = await requireIrissSectionApi("sludinajumi");
  if (!gate.ok) return gate.response;
  if (!isIrissPasutijumiStoreEnabled()) return NextResponse.json({ error: "store_disabled" }, { status: 503, headers: noStore });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }
  const list = body && typeof body === "object" && Array.isArray((body as { patches?: unknown }).patches) ? (body as { patches: unknown[] }).patches : [body];
  const patches = list.slice(0, 200).map(parseIrissListingMarkPatch).filter((p): p is IrissListingMarkPatch => p !== null);
  if (patches.length === 0) return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  let marks = await readIrissListingMarks();
  for (const p of patches) marks = applyIrissListingMarkPatch(marks, p);
  const w = await writeIrissListingMarks(marks);
  if (!w.ok) return NextResponse.json({ error: w.error }, { status: 500, headers: noStore });
  return NextResponse.json({ ok: true, marks }, { headers: noStore });
}
