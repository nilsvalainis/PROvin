import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import {
  addVinScanHistory,
  isVinScanHistoryStoreEnabled,
  readVinScanHistory,
  vinScanHistoryUserKey,
} from "@/lib/vin-scan/history-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pēdējie 15 VIN šim lietotājam. */
export async function GET() {
  const gate = await requireIrissSectionApi("vin");
  if (!gate.ok) return gate.response;
  const entries = await readVinScanHistory(vinScanHistoryUserKey(gate.actor)).catch(() => []);
  return NextResponse.json({ enabled: isVinScanHistoryStoreEnabled(), entries });
}

export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("vin");
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as { vin?: unknown } | null;
  const vin = normalizeVin(typeof body?.vin === "string" ? body.vin : "");
  if (!isValidVin(vin)) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  try {
    const entries = await addVinScanHistory(vinScanHistoryUserKey(gate.actor), vin, new Date().toISOString());
    return NextResponse.json({ enabled: isVinScanHistoryStoreEnabled(), entries });
  } catch {
    return NextResponse.json({ error: "store_failed" }, { status: 502 });
  }
}
