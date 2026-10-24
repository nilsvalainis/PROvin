import { NextResponse } from "next/server";
import { getDropboxClient } from "@/lib/dropbox-client";
import { makeAutoparksThumbnail } from "@/lib/iriss-autoparks-files";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2StockPhotoCandidates } from "@/lib/iriss-autoparks-v2-photo";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";
import { isSafeDropboxFileId } from "@/lib/iriss-stock-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; dropboxId: string }> };

/**
 * J29 B: viena kandidāta priekšskats "Iestatīt galveno bildi" izvēlei (UI gaida Nila apstiprinātu maketu).
 * `dropboxId` jābūt starp šī auto STOCK kandidātiem - citādi 404 (nekāda cita Dropbox faila proxy).
 */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const { id, dropboxId } = await ctx.params;
  if (!isSafeDropboxFileId(dropboxId)) return autoparksV2Json({ error: "invalid_id" }, 400);
  const found = await readAutoparksV2Car(id);
  if (!found) return autoparksV2Json({ error: "not_found" }, 404);
  const candidates = await autoparksV2StockPhotoCandidates(found.car);
  if (!candidates.some((c) => c.id === dropboxId)) return autoparksV2Json({ error: "not_found" }, 404);
  const client = getDropboxClient();
  if (!client) return autoparksV2Json({ error: "no_photo" }, 404);
  const bytes = await client
    .download(dropboxId)
    .then((d) => makeAutoparksThumbnail(d.bytes, "image/jpeg"))
    .catch(() => null);
  if (!bytes) return autoparksV2Json({ error: "no_photo" }, 404);
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
