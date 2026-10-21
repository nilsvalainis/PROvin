import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { ocrVinFromCameraFrame } from "@/lib/vin-scan/camera-ocr-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 4_000_000;

/** Kameras kadrs (JPEG) → VIN. Bilde netiek saglabāta. */
export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("vin");
  if (!gate.ok) return gate.response;
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 500 || buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  try {
    const pick = await ocrVinFromCameraFrame(buf);
    return NextResponse.json({ vin: pick?.vin ?? "", checkDigitOk: pick?.checkDigitOk ?? false, alts: pick?.alts ?? [] });
  } catch {
    return NextResponse.json({ error: "ocr_failed" }, { status: 502 });
  }
}
