import { NextResponse } from "next/server";
import { autoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2MainPhoto, setAutoparksV2MainPhoto } from "@/lib/iriss-autoparks-v2-photo";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";
import { isSafeDropboxFileId } from "@/lib/iriss-stock-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Galvenās bildes sīktēls (tikai no /STOCK mapes). Nav bildes - 404 (UI rāda vietturi).
 * J62: `?force=1` (tikai administratoram) apiet saglabāto bildi un `photoCheckedAt` TTL un
 * uzspiež Dropbox mapes pārlasīšanu - lietderīgi, ja bildes STOCK mapē iekopētas pēc pēdējās
 * (tukšas) pārbaudes un gaidīt līdz 24h/1h TTL beigām nav vēlams.
 */
export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const found = await readAutoparksV2Car(id);
  if (!found) return autoparksV2Json({ error: "not_found" }, 404);
  const force = gate.actor.kind === "admin" && new URL(req.url).searchParams.get("force") === "1";
  const bytes = await autoparksV2MainPhoto(found.car, found.v2, { force });
  if (!bytes) return autoparksV2Json({ error: "no_photo" }, 404);
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": force ? "private, no-store" : "private, max-age=3600" },
  });
}

/**
 * J29 B: "Iestatīt galveno bildi" - ar roku izvēlēta STOCK bilde (API; UI gaida Nila apstiprinātu maketu).
 * `dropboxId` jābūt starp šī auto `/STOCK` kandidātiem (sk. `foto/kandidati`) - citādi `not_found`.
 */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  const dropboxId = body.dropboxId;
  if (!isSafeDropboxFileId(dropboxId)) return autoparksV2Json({ error: "invalid_id" }, 400);
  const found = await readAutoparksV2Car(id);
  if (!found) return autoparksV2Json({ error: "not_found" }, 404);
  const res = await setAutoparksV2MainPhoto(found.car, dropboxId, { id: gate.actorId, name: gate.actorName });
  if (!res.ok) return autoparksV2Json({ error: res.reason }, res.reason === "not_found" ? 404 : 502);
  const after = await readAutoparksV2Car(id);
  return autoparksV2Json({ ok: true, basics: autoparksV2Basics(after!.car, after!.v2) });
}
