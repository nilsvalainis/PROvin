/**
 * OneAuto Image Search by VIN → saglabā foto oficiālā dīlera blokā.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import { fetchAndStoreOneautoVehicleImages, getOneautoApiConfig } from "@/lib/oneauto-api";
import { ONEAUTO_PHOTO_GROUP_TITLE } from "@/lib/oneauto-images";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function isPhotoStoreEnabled(): boolean {
  return Boolean(getOrderDraftStorageDir() || getOrderDraftBlobConfig());
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!getOneautoApiConfig()) {
    return NextResponse.json({ error: "missing_oneauto_credentials" }, { status: 503 });
  }
  if (!isPhotoStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionId = String(o.sessionId ?? "").trim();
  if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.checkoutLine === "provin_select") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const vin = normalizeVin(String(o.vin ?? ""));
  if (!isValidVin(vin)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }

  try {
    const fetched = await fetchAndStoreOneautoVehicleImages({ vin, sessionId });
    if (fetched.error === "insufficient_balance") {
      return NextResponse.json({ error: "insufficient_balance", ...fetched }, { status: 402 });
    }
    if (fetched.error === "api_unavailable") {
      return NextResponse.json({ error: "api_unavailable", ...fetched }, { status: 502 });
    }
    if (fetched.error === "no_images" || fetched.photoIds.length === 0) {
      return NextResponse.json(
        {
          error: "no_images",
          groupTitle: ONEAUTO_PHOTO_GROUP_TITLE,
          ...fetched,
        },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      groupTitle: ONEAUTO_PHOTO_GROUP_TITLE,
      ...fetched,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "missing_oneauto_credentials") {
      return NextResponse.json({ error: "missing_oneauto_credentials" }, { status: 503 });
    }
    console.error("[admin/sources/oneautoapi/images]", msg);
    return NextResponse.json({ error: "upstream_error", detail: msg }, { status: 502 });
  }
}
