/**
 * OneAutoAPI avota ielāde (admin).
 * Servera env: `ONEAUTO_API_KEY` (obligāts), `ONEAUTO_API_BASE_URL`
 * (noklusējums `https://api.oneautoapi.com`). Atslēga paliek tikai serverī.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { fetchOneautoProducts, getOneautoApiConfig } from "@/lib/oneauto-api";
import { parseOneautoProductIds } from "@/lib/oneauto-catalog";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

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
  const products = parseOneautoProductIds(o.products);
  if (products.length === 0) {
    return NextResponse.json({ error: "no_products_selected" }, { status: 400 });
  }

  try {
    const fetched = await fetchOneautoProducts({ vin, products });
    const allFailed = products.every((id) => fetched.results[id]?.ok === false);
    const allPending = products.every((id) => fetched.results[id]?.error === "pending");
    const balanceFail = Object.values(fetched.results).some((r) => r?.error === "insufficient_balance");
    if (allFailed && balanceFail) {
      return NextResponse.json({ error: "insufficient_balance", ...fetched }, { status: 402 });
    }
    if (allFailed && allPending) {
      return NextResponse.json({ error: "pending", ...fetched }, { status: 202 });
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
    console.error("[admin/sources/oneautoapi]", msg);
    return NextResponse.json({ error: "upstream_error", detail: msg }, { status: 502 });
  }
}
