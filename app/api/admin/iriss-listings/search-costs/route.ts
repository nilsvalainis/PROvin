import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { readListingSearchCostsSetting, writeListingSearchCostsSetting } from "@/lib/iriss-listings-search-costs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** LIST "Izmaksu pieņēmumi" servera kopija meklēšanas cenas robežām. */
export async function GET() {
  const gate = await requireIrissSectionApi("sludinajumi");
  if (!gate.ok) return gate.response;
  const costs = await readListingSearchCostsSetting();
  return NextResponse.json({ costs }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const gate = await requireIrissSectionApi("sludinajumi");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = body && typeof body === "object" && "costs" in body ? (body as { costs: unknown }).costs : body;
  try {
    const costs = await writeListingSearchCostsSetting(raw);
    return NextResponse.json({ ok: true, costs }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
}
