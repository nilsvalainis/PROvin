/**
 * TheCarApi bildes no tās pašas cc-vin-photos krātuves, atslēga tc + VIN.
 * Nav TheCarApi API izsaukums.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeCcVinPhotoId, readCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { thecarapiArchivePhotoSession } from "@/lib/thecarapi-photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const vin = normalizeVin(url.searchParams.get("vin") ?? "");
  const photoId = (url.searchParams.get("photoId") ?? "").trim();
  if (!isValidVin(vin) || !isSafeCcVinPhotoId(photoId)) {
    return NextResponse.json({ error: "invalid_photo" }, { status: 400 });
  }
  const sessionId = thecarapiArchivePhotoSession(vin);
  const buf = await readCcVinPhotoJpeg(sessionId, photoId).catch(() => null);
  if (!buf) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
