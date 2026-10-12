import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { defaultVinScanSourceIds } from "@/lib/vin-scan/catalog";
import { runVinScan, sanitizeVinScanSourceIds } from "@/lib/vin-scan/run";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const vin = normalizeVin(String(body.vin ?? ""));
  if (!isValidVin(vin)) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });

  const requested = sanitizeVinScanSourceIds(body.sources) ?? defaultVinScanSourceIds();
  const indicators = await runVinScan(vin, requested);
  return NextResponse.json({
    ok: true,
    vin,
    scannedAt: new Date().toISOString(),
    indicators,
  });
}
