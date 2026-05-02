/**
 * PROVIN SELECT konsultācijas slotu fotogrāfijas (JPEG uz diska, JSON satur tikai id + komentāru).
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getConsultationDraftStorageDir,
  isSafeConsultationDraftSessionId,
  readConsultationDraft,
} from "@/lib/admin-consultation-draft-store";
import { CONSULTATION_MAX_PHOTOS_PER_SLOT, CONSULTATION_SLOT_COUNT } from "@/lib/admin-consultation-draft-types";
import {
  CONSULTATION_PHOTO_MAX_BYTES,
  isJpegMagicBuffer,
  isSafeConsultationPhotoId,
  makeConsultationPhotoId,
  readConsultationSlotPhotoJpeg,
  writeConsultationSlotPhotoJpeg,
  deleteConsultationSlotPhoto,
} from "@/lib/admin-consultation-photo-fs";
import { getConsultationSessionDetail } from "@/lib/admin-orders";

export const maxDuration = 60;
export const runtime = "nodejs";

async function assertConsultationAccess(sessionId: string) {
  const order = await getConsultationSessionDetail(sessionId);
  if (!order || order.paymentStatus !== "paid") return null;
  return order;
}

export async function GET(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
    const photoId = (url.searchParams.get("photoId") ?? "").trim();
    if (!sessionId || !isSafeConsultationDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    if (!isSafeConsultationPhotoId(photoId)) {
      return NextResponse.json({ error: "invalid_photoId" }, { status: 400 });
    }
    const access = await assertConsultationAccess(sessionId);
    if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const dir = getConsultationDraftStorageDir();
    if (!dir) return NextResponse.json({ error: "store_disabled" }, { status: 503 });

    const draft = await readConsultationDraft(sessionId);
    const inDraft = draft?.workspace?.slots.some((s) => (s.photos ?? []).some((p) => p.id === photoId));
    if (!inDraft) return NextResponse.json({ error: "photo_not_in_workspace" }, { status: 404 });

    const buf = await readConsultationSlotPhotoJpeg(dir, sessionId, photoId);
    if (!buf) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    console.error("[consultation-slot-photo] GET", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const sessionId = String(form.get("sessionId") ?? "").trim();
    const slotRaw = String(form.get("slotIndex") ?? "").trim();
    const slotIndex = Number.parseInt(slotRaw, 10);
    const file = form.get("file");

    if (!sessionId || !isSafeConsultationDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex >= CONSULTATION_SLOT_COUNT) {
      return NextResponse.json({ error: "invalid_slotIndex" }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    const orderOk = await assertConsultationAccess(sessionId);
    if (!orderOk) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const dir = getConsultationDraftStorageDir();
    if (!dir) return NextResponse.json({ error: "store_disabled" }, { status: 503 });

    const draft = await readConsultationDraft(sessionId);
    const slotPhotos = draft?.workspace?.slots[slotIndex]?.photos ?? [];
    if (slotPhotos.length >= CONSULTATION_MAX_PHOTOS_PER_SLOT) {
      return NextResponse.json({ error: "slot_photo_limit" }, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length === 0 || buf.length > CONSULTATION_PHOTO_MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }
    if (!isJpegMagicBuffer(buf)) {
      return NextResponse.json({ error: "invalid_jpeg" }, { status: 400 });
    }

    const photoId = makeConsultationPhotoId();
    await writeConsultationSlotPhotoJpeg(dir, sessionId, photoId, buf);

    return NextResponse.json({ ok: true, id: photoId });
  } catch (e) {
    console.error("[consultation-slot-photo] POST", e);
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
    if (!sessionId || !isSafeConsultationDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    if (!isSafeConsultationPhotoId(photoId)) {
      return NextResponse.json({ error: "invalid_photoId" }, { status: 400 });
    }

    const orderOk = await assertConsultationAccess(sessionId);
    if (!orderOk) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const dir = getConsultationDraftStorageDir();
    if (!dir) return NextResponse.json({ error: "store_disabled" }, { status: 503 });

    await deleteConsultationSlotPhoto(dir, sessionId, photoId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[consultation-slot-photo] DELETE", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
