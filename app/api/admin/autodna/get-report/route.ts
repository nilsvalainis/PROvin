/**
 * Admin: autoDNA POST /api/getReport (multipart: vin, deliveryByEmail).
 * Dokumentācija: Api_Sandbox_Business-tech_Documentation — 3.5 / 3.6.
 */
import { NextResponse } from "next/server";

import { getAutodnaConfig } from "@/lib/autodna-api";
import { autodnaGetReportIdempotent } from "@/lib/autodna-purchase";
import { autodnaResultToNextResponse } from "@/lib/autodna-admin-route";
import { getAdminSession } from "@/lib/admin-auth";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const maxDuration = 90;
export const runtime = "nodejs";
export const preferredRegion = "fra1";

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const config = getAutodnaConfig();
  if (!config) {
    return NextResponse.json({ error: "missing_autodna_credentials" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const o = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const vin = normalizeVin(String(o.vin ?? "").trim());
  if (!isValidVin(vin)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }

  const deliveryByEmail = o.deliveryByEmail === true || o.deliveryByEmail === "true";
  const force = o.force === true || o.force === "true";

  try {
    const result = await autodnaGetReportIdempotent({ vin, deliveryByEmail }, config, { force });
    return autodnaResultToNextResponse(result, "admin/autodna/get-report", { vin });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/autodna/get-report] unhandled exception", { vin, message: msg, error: e });
    return NextResponse.json({ error: "autodna_request_failed", detail: msg }, { status: 502 });
  }
}
