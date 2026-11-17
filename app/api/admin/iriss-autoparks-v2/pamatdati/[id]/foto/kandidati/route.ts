import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2StockPhotoCandidates } from "@/lib/iriss-autoparks-v2-photo";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** J29 B: kandidātu saraksts "Iestatīt galveno bildi" izvēlei (UI gaida Nila apstiprinātu maketu). */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const found = await readAutoparksV2Car(id);
  if (!found) return autoparksV2Json({ error: "not_found" }, 404);
  const candidates = await autoparksV2StockPhotoCandidates(found.car);
  return autoparksV2Json({ ok: true, current: found.v2.mainPhoto?.dropboxId ?? "", candidates });
}
