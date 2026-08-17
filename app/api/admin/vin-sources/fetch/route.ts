import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { VIN_SOURCES_BROWSER_UNAVAILABLE, isVinSourcesBrowserAllowed } from "@/lib/vin-sources/browser";
import { fetchVinSource, VIN_SOURCE_NEEDS_BROWSER } from "@/lib/vin-sources";
import { vinSourceResultToBlock } from "@/lib/vin-sources/to-block";
import { isVinSourceId } from "@/lib/vin-sources/types";
import { buildCarinfoVinCheckUrl } from "@/lib/admin-vin-urls";

export const runtime = "nodejs";
/** lkf.ee reCAPTCHA var prasīt operatora klikšķi — atļaujam ilgu pieprasījumu. */
export const maxDuration = 300;

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const source = String(body.source ?? "").trim();
  if (!isVinSourceId(source)) return NextResponse.json({ error: "invalid_source" }, { status: 400 });

  const vin = normalizeVin(String(body.vin ?? ""));
  if (!isValidVin(vin)) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });

  const regMark = String(body.regMark ?? "").trim().slice(0, 20);

  if (VIN_SOURCE_NEEDS_BROWSER[source] && !isVinSourcesBrowserAllowed()) {
    return NextResponse.json(
      {
        error: "browser_required",
        detail: VIN_SOURCES_BROWSER_UNAVAILABLE,
        openUrl: source === "carinfo" ? buildCarinfoVinCheckUrl(vin) : null,
      },
      { status: 409 },
    );
  }

  try {
    const result = await fetchVinSource(source, vin, regMark);
    return NextResponse.json({
      ok: true,
      found: result.found,
      message: result.message,
      block: vinSourceResultToBlock(result),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "fetch_failed",
        detail: e instanceof Error ? e.message.slice(0, 300) : "unknown_error",
      },
      { status: 502 },
    );
  }
}
