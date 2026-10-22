import { NextResponse } from "next/server";
import { linkAutoparksCarToDropbox, runAutoparksDropboxSync } from "@/lib/iriss-autoparks-dropbox-sync";
import { irissLogisticsScopeHeader, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Manuāla Autoparks <-> Dropbox /STOCK sinhronizācija (bez UI; webhook dara to pašu automātiski).
 * `{ full: true }` = pārskatīt visu no jauna; `{ carId }` = sasaistīt vienu auto (atrod vai izveido mapi).
 */
export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (typeof body.carId === "string" && body.carId.trim()) {
    const r = await linkAutoparksCarToDropbox(body.carId.trim(), { create: body.create !== false });
    return NextResponse.json({ ok: r.linked, ...r }, { status: r.linked ? 200 : 409, headers: irissLogisticsScopeHeader() });
  }
  const r = await runAutoparksDropboxSync({ full: body.full === true });
  return NextResponse.json(r, { status: r.ok ? 200 : 502, headers: irissLogisticsScopeHeader() });
}
