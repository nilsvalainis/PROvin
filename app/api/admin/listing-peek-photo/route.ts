/**
 * Ātrā vērtējuma fotogrāfijas: augšupielāde, priekšskats, noņemšana.
 * JPEG paliek pie ieraksta un aiziet klientam kopā ar e-pastu.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { jpegFromAdminPhotoUpload } from "@/lib/admin-photo-normalize";
import { readListingPeekPhotoJpeg } from "@/lib/listing-peek-photo-bytes";
import {
  LISTING_PEEK_PHOTO_STORED_MAX_BYTES,
  isSafeListingPeekId,
} from "@/lib/listing-peek-photos";
import { addListingPeekPhoto, getListingPeekById, removeListingPeekPhoto } from "@/lib/listing-peek-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  const photoId = (url.searchParams.get("photoId") ?? "").trim().toLowerCase();
  if (!id || !isSafeListingPeekId(photoId)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const entry = await getListingPeekById(id);
  if (!entry?.photos?.some((p) => p.id === photoId)) {
    return NextResponse.json({ error: "missing" }, { status: 404 });
  }
  const jpeg = await readListingPeekPhotoJpeg(entry.id, photoId);
  if (!jpeg) return NextResponse.json({ error: "missing" }, { status: 404 });
  return new NextResponse(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const id = String(form.get("id") ?? "").trim();
  const file = form.get("file");
  if (!id || !(file instanceof Blob)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const raw = Buffer.from(await file.arrayBuffer());
  const normalized = await jpegFromAdminPhotoUpload(raw, LISTING_PEEK_PHOTO_STORED_MAX_BYTES);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  const saved = await addListingPeekPhoto(id, normalized.jpeg);
  if (!saved.ok) {
    const status = saved.reason === "limit" ? 400 : 404;
    return NextResponse.json({ error: saved.reason }, { status });
  }
  return NextResponse.json({ ok: true, id: saved.photo.id });
}

export async function DELETE(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const id = typeof (body as { id?: unknown }).id === "string" ? (body as { id: string }).id.trim() : "";
  const photoId =
    typeof (body as { photoId?: unknown }).photoId === "string"
      ? (body as { photoId: string }).photoId.trim()
      : "";
  if (!id || !isSafeListingPeekId(photoId)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const removed = await removeListingPeekPhoto(id, photoId);
  if (!removed) return NextResponse.json({ error: "missing" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
