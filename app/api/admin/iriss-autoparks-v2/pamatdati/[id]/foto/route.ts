import { NextResponse } from "next/server";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2MainPhoto } from "@/lib/iriss-autoparks-v2-photo";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Galvenās bildes sīktēls (tikai no /STOCK mapes). Nav bildes - 404 (UI rāda vietturi). */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const found = await readAutoparksV2Car(id);
  if (!found) return autoparksV2Json({ error: "not_found" }, 404);
  const bytes = await autoparksV2MainPhoto(found.car, found.v2);
  if (!bytes) return autoparksV2Json({ error: "no_photo" }, 404);
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
