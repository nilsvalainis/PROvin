/**
 * VIN SCAN izsoļu JPEG ielāde AUCTION (cc_vin) blokā. Tikai bezmaksas avotu URL.
 * Saglabā kā esošās Blob/diska JPEG fotogrāfijas.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { collectCcVinPhotoIdsFromWorkspace } from "@/lib/admin-cc-vin-photo-store";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { CC_VIN_MAX_PHOTOS } from "@/lib/cc-vin-photo-types";
import { importVinScanAuctionPhotosToCcVin } from "@/lib/order-vin-scan-photo-import";
import { parseOrderVinScanRecord } from "@/lib/order-vin-scan";
import {
  collectVinScanAuctionPhotoUrls,
  vinScanAuctionPhotoGroupTitle,
} from "@/lib/order-vin-scan-photos";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!getOrderDraftStorageDir() && !getOrderDraftBlobConfig()) {
      return NextResponse.json({ error: "store_disabled" }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
    if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }

    const order = await getCheckoutSessionDetail(sessionId).catch(() => null);
    if (!order || order.checkoutLine === "provin_select") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const draft = await readOrderDraft(sessionId);
    const scan = parseOrderVinScanRecord(draft?.vinScan);
    const fromBody = Array.isArray(b.urls)
      ? b.urls.filter((u): u is string => typeof u === "string")
      : [];
    const urls = fromBody.length ? fromBody : collectVinScanAuctionPhotoUrls(scan?.indicators ?? []);
    if (urls.length === 0) {
      return NextResponse.json({ ok: true, photoIds: [], title: "", imported: 0, skipped: 0, failed: 0 });
    }

    const existing = collectCcVinPhotoIdsFromWorkspace(draft?.workspace ?? null).size;
    if (existing >= CC_VIN_MAX_PHOTOS) {
      return NextResponse.json({ error: "photo_limit" }, { status: 400 });
    }

    const result = await importVinScanAuctionPhotosToCcVin(sessionId, urls, existing);
    return NextResponse.json({
      ok: true,
      ...result,
      title: vinScanAuctionPhotoGroupTitle(scan?.indicators ?? []),
    });
  } catch (e) {
    console.error("[order-vin-scan-photos] POST", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
