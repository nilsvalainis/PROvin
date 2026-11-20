import { getAdminOrStaffActor } from "@/lib/staff-auth";
import { moveTransitCarsToStock } from "@/lib/iriss-autoparks-store";
import { listTransitWithoutLogistics, transitFixAdminOf } from "@/lib/iriss-autoparks-transit-fix";
import { autoparksV2Json } from "@/lib/iriss-autoparks-v2-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** P2 (Nils 20.11, 4A): «Ceļā» bez aktīva Loģistikas ieraksta - tikai lasīšana, tikai admins. */
export async function GET() {
  const admin = transitFixAdminOf(await getAdminOrStaffActor());
  if (!admin) return autoparksV2Json({ error: "forbidden" }, 403);
  const { rows } = await listTransitWithoutLogistics();
  return autoparksV2Json({ ok: true, cars: rows });
}

/** Pārcelt uz «Noliktavā» tikai admina apstiprinātos (`confirm: true`); serveris pārbauda katru id vēlreiz. */
export async function POST(req: Request) {
  const admin = transitFixAdminOf(await getAdminOrStaffActor());
  if (!admin) return autoparksV2Json({ error: "forbidden" }, 403);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string").slice(0, 500) : [];
  if (body.confirm !== true || ids.length === 0) return autoparksV2Json({ error: "missing_confirm" }, 400);
  const { eligible } = await listTransitWithoutLogistics();
  const moved = await moveTransitCarsToStock(ids, eligible, admin);
  return autoparksV2Json({ ok: true, moved });
}
