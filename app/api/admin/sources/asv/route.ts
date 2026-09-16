/**
 * ASV vēsture — VIN Audit ielāde caur One Auto API (admin).
 * Servera env: `ONEAUTO_API_KEY`, opcionāli `ONEAUTO_ASV_VHR_PATH` / `ONEAUTO_ASV_VHR_LITE_PATH`.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { fetchAsvProducts } from "@/lib/asv-oneauto-api";
import { parseAsvProductIds } from "@/lib/asv-catalog";
import { getOneautoApiConfig } from "@/lib/oneauto-api";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!getOneautoApiConfig()) {
    return NextResponse.json({ error: "missing_oneauto_credentials" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const vin = normalizeVin(String(o.vin ?? ""));
  if (!isValidVin(vin)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }
  const products = parseAsvProductIds(o.products);
  if (products.length === 0) {
    return NextResponse.json({ error: "no_products_selected" }, { status: 400 });
  }
  const sessionRaw = typeof o.sessionId === "string" ? o.sessionId.trim() : "";
  const sessionId = sessionRaw && isSafeOrderDraftSessionId(sessionRaw) ? sessionRaw : undefined;
  const reportId = typeof o.reportId === "string" ? o.reportId.trim().slice(0, 80) : "";

  try {
    const fetched = await fetchAsvProducts({
      vin,
      products,
      sessionId,
      reportId: reportId || undefined,
    });
    const allFailed = products.every((id) => fetched.results[id]?.ok === false);
    const failCodes = products.map((id) => fetched.results[id]?.error ?? "upstream_error");
    const allPending = failCodes.every((c) => c === "pending");
    const balanceFail = failCodes.includes("insufficient_balance");
    if (allFailed && balanceFail) {
      return NextResponse.json({ error: "insufficient_balance", ...fetched }, { status: 402 });
    }
    if (allFailed && allPending) {
      return NextResponse.json({ error: "pending", ...fetched }, { status: 202 });
    }
    if (allFailed && failCodes.every((c) => c === "service_not_enabled")) {
      return NextResponse.json({ error: "service_not_enabled", ...fetched }, { status: 403 });
    }
    if (allFailed && failCodes.every((c) => c === "api_unavailable")) {
      return NextResponse.json({ error: "api_unavailable", ...fetched }, { status: 502 });
    }
    if (allFailed) {
      return NextResponse.json({ error: "upstream_error", ...fetched }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...fetched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "missing_oneauto_credentials") {
      return NextResponse.json({ error: "missing_oneauto_credentials" }, { status: 503 });
    }
    console.error("[admin/sources/asv]", msg);
    return NextResponse.json({ error: "upstream_error", detail: msg }, { status: 502 });
  }
}
