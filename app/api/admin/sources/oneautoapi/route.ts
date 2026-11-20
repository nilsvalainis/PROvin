/**
 * OneAutoAPI avota ielāde (admin).
 * Servera env: `ONEAUTO_API_KEY` (obligāts), `ONEAUTO_API_BASE_URL`
 * (noklusējums `https://api.oneautoapi.com`). Atslēga paliek tikai serverī.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { translateOneautoWorksOnIngest } from "@/lib/admin-ai-oneauto-translate";
import { fetchOneautoProducts, getOneautoApiConfig } from "@/lib/oneauto-api";
import { buildOneautoDisplay, parseOneautoProductIds, type OneautoProductId } from "@/lib/oneauto-catalog";
import {
  readStoredOneautoResults,
  recordManualOneautoPurchase,
  splitOneautoAlreadyPurchased,
} from "@/lib/oneauto-manual-purchase";
import { mergeOneautoProductResults } from "@/lib/oneauto-to-auto-records";
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

  // Jau nopirktais (automātika vai iepriekšēja manuāla ielāde) netiek pirkts vēlreiz bez «Pirkt vēlreiz».
  const sessionId = typeof o.sessionId === "string" ? o.sessionId.trim() : "";
  const force = o.force === true;
  const stored = sessionId ? await readStoredOneautoResults(sessionId, vin) : {};
  const { toFetch, reused } = splitOneautoAlreadyPurchased(products, stored, force);

  try {
    if (toFetch.length === 0) {
      const results: typeof stored = {};
      for (const id of reused) if (stored[id]) results[id] = stored[id];
      const payloads: Partial<Record<OneautoProductId, unknown>> = {};
      for (const id of Object.keys(stored) as OneautoProductId[]) payloads[id] = stored[id]?.payload;
      const original = buildOneautoDisplay(payloads);
      const display = await translateOneautoWorksOnIngest(original);
      return NextResponse.json({
        ok: true,
        source: "oneautoapi",
        vin,
        costEur: "0.00",
        costCents: 0,
        results: stored,
        reused,
        display,
        displayOriginal: original,
      });
    }
    const fetchedRaw = await fetchOneautoProducts({ vin, products: toFetch });
    if (sessionId) {
      // Uzreiz serverī: dati nepazūd, ja lapu aizver pirms melnraksta saglabāšanas.
      await recordManualOneautoPurchase({ sessionId, vin, results: fetchedRaw.results });
    }
    const fetched =
      reused.length > 0
        ? (() => {
            const results = mergeOneautoProductResults(stored, fetchedRaw.results);
            const payloads: Partial<Record<OneautoProductId, unknown>> = {};
            for (const id of Object.keys(results) as OneautoProductId[]) payloads[id] = results[id]?.payload;
            return { ...fetchedRaw, results, display: buildOneautoDisplay(payloads) };
          })()
        : fetchedRaw;
    const allFailed = toFetch.every(
      (id) => fetched.results[id]?.ok === false && fetched.results[id]?.error !== "no_data",
    );
    const allPending = toFetch.every((id) => fetched.results[id]?.error === "pending");
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
    const display = await translateOneautoWorksOnIngest(fetched.display);
    return NextResponse.json({
      ok: true,
      ...fetched,
      reused,
      display,
      displayOriginal: fetched.display,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "missing_oneauto_credentials") {
      return NextResponse.json({ error: "missing_oneauto_credentials" }, { status: 503 });
    }
    console.error("[admin/sources/oneautoapi]", msg);
    return NextResponse.json({ error: "upstream_error", detail: msg }, { status: 502 });
  }
}
