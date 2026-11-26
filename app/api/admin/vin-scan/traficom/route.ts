import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { readTraficomFiRelayConfig, startTraficomFiLookup } from "@/lib/traficom-fi-auto";
import { readTraficomFiAutoStatus } from "@/lib/traficom-fi-auto-store";
import { vinScanRelayRef } from "@/lib/vin-scan/v4-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** VIN SCAN v4: rindas «Traficom (FI)» stāvoklis vienam VIN (atsauce `vs_<vin>`). */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const vin = normalizeVin(new URL(req.url).searchParams.get("vin") ?? "");
  if (!isValidVin(vin)) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  const status = await readTraficomFiAutoStatus(vinScanRelayRef(vin)).catch(() => null);
  return NextResponse.json({ status, configured: readTraficomFiRelayConfig() !== null });
}

/**
 * POST {vin, trigger: "auto"|"manual", reason?, force?}: Traficom pēc VIN caur eParaksts (Nils apstiprina telefonā).
 * `auto` - tikai klienta atrastas FI pazīmes gadījumā un ar `TRAFICOM_AUTO_ENABLED=1` (vienreiz uz VIN);
 * `manual` - poga «Traficom (FI)». Bez maksas (tikai bezmaksas dati).
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const vin = normalizeVin(typeof body.vin === "string" ? body.vin : "");
  if (!isValidVin(vin)) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  const trigger = body.trigger === "auto" ? "auto" : "manual";
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 80) : "";
  if (trigger === "auto" && !reason) return NextResponse.json({ error: "no_signal" }, { status: 400 });
  const out = await startTraficomFiLookup(vinScanRelayRef(vin), { trigger, vin, force: body.force === true, reason });
  return NextResponse.json({ ok: out.ok, started: out.started, status: out.status, configured: readTraficomFiRelayConfig() !== null });
}
