/**
 * Sludinājuma analīzes fotogrāfijas (JPEG — Blob + lokālais disks).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import {
  collectListingAnalysisPhotoIdsFromWorkspace,
  deleteListingAnalysisPhoto,
  isJpegMagicBuffer,
  isSafeListingAnalysisPhotoId,
  LISTING_ANALYSIS_PHOTO_MAX_BYTES,
  makeListingAnalysisPhotoId,
  readListingAnalysisPhotoJpeg,
  writeListingAnalysisPhotoJpeg,
} from "@/lib/admin-listing-analysis-photo-store";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import { LISTING_ANALYSIS_MAX_PHOTOS } from "@/lib/listing-analysis-photo-types";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";

export const maxDuration = 60;
export const runtime = "nodejs";

function isListingPhotoStoreEnabled(): boolean {
  return Boolean(getOrderDraftStorageDir() || getOrderDraftBlobConfig());
}

async function assertOrderAccess(sessionId: string) {
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) return null;
  if (order.checkoutLine === "provin_select") return null;
  return order;
}

async function persistedPhotoCount(sessionId: string): Promise<number> {
  const draft = await readOrderDraft(sessionId);
  return collectListingAnalysisPhotoIdsFromWorkspace(draft?.workspace ?? null).size;
}

export async function GET(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
    const photoId = (url.searchParams.get("photoId") ?? "").trim();
    if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    if (!isSafeListingAnalysisPhotoId(photoId)) {
      return NextResponse.json({ error: "invalid_photoId" }, { status: 400 });
    }

    const access = await assertOrderAccess(sessionId);
    if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const buf = await readListingAnalysisPhotoJpeg(sessionId, photoId);
    if (!buf) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    console.error("[listing-analysis-photo] GET", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    if (!isListingPhotoStoreEnabled()) {
      return NextResponse.json({ error: "store_disabled" }, { status: 503 });
    }

    const form = await req.formData();
    const sessionId = String(form.get("sessionId") ?? "").trim();
    const file = form.get("file");

    if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    const orderOk = await assertOrderAccess(sessionId);
    if (!orderOk) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const count = await persistedPhotoCount(sessionId);
    if (count >= LISTING_ANALYSIS_MAX_PHOTOS) {
      return NextResponse.json({ error: "photo_limit" }, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length === 0 || buf.length > LISTING_ANALYSIS_PHOTO_MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }
    if (!isJpegMagicBuffer(buf)) {
      return NextResponse.json({ error: "invalid_jpeg" }, { status: 400 });
    }

    const photoId = makeListingAnalysisPhotoId();
    await writeListingAnalysisPhotoJpeg(sessionId, photoId, buf);

    return NextResponse.json({ ok: true, id: photoId });
  } catch (e) {
    console.error("[listing-analysis-photo] POST", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
    const photoId = typeof b.photoId === "string" ? b.photoId.trim() : "";
    if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    if (!isSafeListingAnalysisPhotoId(photoId)) {
      return NextResponse.json({ error: "invalid_photoId" }, { status: 400 });
    }

    const orderOk = await assertOrderAccess(sessionId);
    if (!orderOk) return NextResponse.json({ error: "not_found" }, { status: 404 });

    await deleteListingAnalysisPhoto(sessionId, photoId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[listing-analysis-photo] DELETE", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
