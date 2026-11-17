/**
 * Admin: EU izsoļu arhīvs (TheCarApi). Tikai manuāla poga.
 * Bez THECARAPI_ADMIN_ENABLED atgriež 403 un neko nesauc.
 * Bez THECARAPI_API_KEY atgriež 503.
 */
import { NextResponse } from "next/server";

import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { getAdminSession } from "@/lib/admin-auth";
import { normalizeCcVinBlock } from "@/lib/cc-vin-report";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { fetchThecarapiCcVinMerge, thecarapiAdminStatus } from "@/lib/thecarapi-cc-vin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const vin = normalizeVin(new URL(req.url).searchParams.get("vin") ?? "");
  const status = await thecarapiAdminStatus(isValidVin(vin) ? vin : "");
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  const sessionRaw = typeof o.sessionId === "string" ? o.sessionId.trim() : "";
  if (sessionRaw && !isSafeOrderDraftSessionId(sessionRaw)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const sessionId = sessionRaw || undefined;
  const skipCache = o.skipCache === true;
  const prev = o.block ? normalizeCcVinBlock(o.block) : undefined;

  try {
    const result = await fetchThecarapiCcVinMerge({ vin, prev, sessionId, skipCache });
    if (result.error === "missing_thecarapi_credentials") {
      return NextResponse.json(
        { error: "missing_thecarapi_credentials", summary: result.parse.summary, used: result.used, cap: result.cap },
        { status: 503 },
      );
    }
    if (result.error === "thecarapi_disabled") {
      return NextResponse.json(
        { error: "thecarapi_disabled", summary: result.parse.summary, used: result.used, cap: result.cap },
        { status: 403 },
      );
    }
    const auctions = (result.parse.auctions ?? []).map((row) => ({
      date: row.date || "",
      venue: row.venue || "",
      odometer: row.odometer || "",
      price: row.price || "",
      lot: row.lot || "",
      link: result.parse.openUrl || "",
    }));
    if (result.parse.status === "unknown" || result.parse.status === "timeout") {
      return NextResponse.json(
        {
          error: "upstream_error",
          summary: result.parse.summary,
          parse: { status: result.parse.status, summary: result.parse.summary },
          block: result.block,
          fromCache: result.fromCache,
          cachedAt: result.cachedAt,
          billable: result.billable,
          used: result.used,
          cap: result.cap,
          auctions,
          records: result.records,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      vin,
      summary: result.parse.summary,
      parse: { status: result.parse.status, summary: result.parse.summary, detail: result.parse.detail || "" },
      block: result.block,
      fromCache: result.fromCache,
      cachedAt: result.cachedAt,
      billable: result.billable,
      used: result.used,
      cap: result.cap,
      auctions,
      records: result.records,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/sources/thecarapi]", msg);
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
