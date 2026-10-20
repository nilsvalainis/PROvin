import { NextResponse } from "next/server";
import { requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { fetchAndParseLogisticsListing } from "@/lib/iriss-logistics-listing-parse-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const url = body && typeof body === "object" && "url" in body ? String((body as { url?: unknown }).url ?? "") : "";
  const parsed = await fetchAndParseLogisticsListing(url);
  return NextResponse.json({ ok: parsed.ok, parsed }, { headers: irissLogisticsScopeHeader() });
}
