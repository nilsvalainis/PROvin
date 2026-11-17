import { NextResponse } from "next/server";
import { isSafeIrissCarShareToken } from "@/lib/iriss-car-share";
import { readIrissCarShareByToken } from "@/lib/iriss-car-share-store";
import { autoparksV2MainPhoto } from "@/lib/iriss-autoparks-v2-photo";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { token: raw } = await ctx.params;
  const token = raw?.trim() ?? "";
  if (!isSafeIrissCarShareToken(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const rec = await readIrissCarShareByToken(token);
  if (!rec?.autoparksCarId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const found = await readAutoparksV2Car(rec.autoparksCarId).catch(() => null);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const bytes = await autoparksV2MainPhoto(found.car, found.v2);
  if (!bytes) return NextResponse.json({ error: "no_photo" }, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex, nofollow" },
  });
}
