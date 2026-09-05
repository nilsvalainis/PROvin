/**
 * Starptautiskās vēstures fotogrāfijas (JPEG — Blob + lokālais disks).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import {
  CC_VIN_PHOTO_MAX_BYTES,
  collectCcVinPhotoIdsFromWorkspace,
  deleteCcVinPhoto,
  isSafeCcVinPhotoId,
  makeCcVinPhotoId,
  readCcVinPhotoJpeg,
  writeCcVinPhotoJpeg,
} from "@/lib/admin-cc-vin-photo-store";
import { jpegFromAdminPhotoUpload } from "@/lib/admin-photo-normalize";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import { CC_VIN_MAX_PHOTOS } from "@/lib/cc-vin-photo-types";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";

export const maxDuration = 60;
export const runtime = "nodejs";

function isPhotoStoreEnabled(): boolean {
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
  return collectCcVinPhotoIdsFromWorkspace(draft?.workspace ?? null).size;
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
    if (!isSafeCcVinPhotoId(photoId)) {
      return NextResponse.json({ error: "invalid_photoId" }, { status: 400 });
    }

    const access = await assertOrderAccess(sessionId);
    if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const buf = await readCcVinPhotoJpeg(sessionId, photoId);
    if (!buf) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    console.error("[cc-vin-photo] GET", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    if (!isPhotoStoreEnabled()) {
      return NextResponse.json({ error: "store_disabled" }, { status: 503 });
    }

    const form = await req.formData();
    const sessionId = String(form.get("sessionId") ?? "").trim();
    const file = form.get("file");
    const countRaw = String(form.get("currentCount") ?? "").trim();
    const clientCount = Number.parseInt(countRaw, 10);

    if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    const orderOk = await assertOrderAccess(sessionId);
    if (!orderOk) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const persisted = await persistedPhotoCount(sessionId);
    const effectiveCount =
      Number.isFinite(clientCount) && clientCount >= 0 ? Math.max(persisted, clientCount) : persisted;
    if (effectiveCount >= CC_VIN_MAX_PHOTOS) {
      return NextResponse.json({ error: "photo_limit" }, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const normalized = await jpegFromAdminPhotoUpload(Buffer.from(ab), CC_VIN_PHOTO_MAX_BYTES);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    const buf = normalized.jpeg;

    const photoId = makeCcVinPhotoId();
    try {
      await writeCcVinPhotoJpeg(sessionId, photoId, buf);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[cc-vin-photo] POST write", sessionId, detail);
      return NextResponse.json({ error: "write_failed", detail }, { status: 503 });
    }

    return NextResponse.json({ ok: true, id: photoId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cc-vin-photo] POST", msg);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
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
    const deleteAll = b.deleteAll === true;
    const photoIdsRaw = b.photoIds;
    const photoIds =
      Array.isArray(photoIdsRaw) && photoIdsRaw.length > 0
        ? photoIdsRaw.filter((id): id is string => typeof id === "string" && isSafeCcVinPhotoId(id.trim()))
        : [];

    if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }

    const orderOk = await assertOrderAccess(sessionId);
    if (!orderOk) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (deleteAll) {
      const draft = await readOrderDraft(sessionId);
      const ids = [...collectCcVinPhotoIdsFromWorkspace(draft?.workspace ?? null)];
      await Promise.all(ids.map((id) => deleteCcVinPhoto(sessionId, id)));
      return NextResponse.json({ ok: true, deleted: ids.length });
    }

    if (photoIds.length > 0) {
      await Promise.all(photoIds.map((id) => deleteCcVinPhoto(sessionId, id.trim())));
      return NextResponse.json({ ok: true, deleted: photoIds.length });
    }

    if (!isSafeCcVinPhotoId(photoId)) {
      return NextResponse.json({ error: "invalid_photoId" }, { status: 400 });
    }

    await deleteCcVinPhoto(sessionId, photoId);
    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (e) {
    console.error("[cc-vin-photo] DELETE", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
