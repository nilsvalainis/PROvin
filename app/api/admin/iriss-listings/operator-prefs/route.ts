import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  readIrissListingsLatestView,
  readIrissListingsOperatorState,
  writeIrissListingsOperatorState,
  writeIrissListingsRun,
} from "@/lib/iriss-listings-aggregate-store";
import { applyListingMembership } from "@/lib/iriss-listings-membership";
import {
  mergeMigratedClientIds,
  operatorRejectedIds,
  withFavorite,
  withRejected,
} from "@/lib/iriss-listings-operator-state";
import { buildIrissListingSources } from "@/lib/iriss-listings-sources";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";
import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isVehicle(v: unknown): v is IrissListingVehicle {
  return Boolean(v) && typeof v === "object" && typeof (v as { id?: unknown }).id === "string";
}

async function persistVehicles(vehicles: IrissListingVehicle[]): Promise<void> {
  const latest = await readIrissListingsLatestView();
  if (!latest) return;
  await writeIrissListingsRun({
    ...latest,
    generatedAt: new Date().toISOString(),
    vehicles,
    summary: { ...latest.summary, vehicleCount: vehicles.length },
  });
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const state = await readIrissListingsOperatorState();
  return NextResponse.json({ fav: state.fav, rejected: state.rejected });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  const at = new Date().toISOString();
  let state = await readIrissListingsOperatorState();

  if (action === "migrate") {
    const fav = Array.isArray(body.fav) ? body.fav.filter((x): x is string => typeof x === "string") : [];
    const hidden = Array.isArray(body.hidden) ? body.hidden.filter((x): x is string => typeof x === "string") : [];
    const latest = await readIrissListingsLatestView();
    state = mergeMigratedClientIds(state, { fav, hidden, vehicles: latest?.vehicles ?? [], at });
    const write = await writeIrissListingsOperatorState(state);
    if (!write.ok) return NextResponse.json({ error: write.error }, { status: 500 });
    const rejectedIds = operatorRejectedIds(state);
    if (latest && rejectedIds.size > 0) {
      await persistVehicles(latest.vehicles.filter((v) => !rejectedIds.has(v.id)));
    }
    return NextResponse.json({ fav: state.fav, rejected: state.rejected });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  if (action === "fav" || action === "unfav") {
    state = withFavorite(state, id, action === "fav");
    const write = await writeIrissListingsOperatorState(state);
    if (!write.ok) return NextResponse.json({ error: write.error }, { status: 500 });
    return NextResponse.json({ fav: state.fav, rejected: state.rejected });
  }

  if (action === "reject" || action === "unreject") {
    const vehicle = isVehicle(body.vehicle) ? body.vehicle : null;
    const previousSnap = state.rejected.find((r) => r.id === id)?.vehicle ?? null;
    state = withRejected(state, id, action === "reject", at, vehicle ?? previousSnap);
    const write = await writeIrissListingsOperatorState(state);
    if (!write.ok) return NextResponse.json({ error: write.error }, { status: 500 });
    const latest = await readIrissListingsLatestView();
    if (latest) {
      if (action === "reject") {
        await persistVehicles(latest.vehicles.filter((v) => v.id !== id));
      } else {
        const snap = vehicle ?? previousSnap;
        const already = latest.vehicles.some((v) => v.id === id);
        if (!already && snap) {
          const rows = await listIrissPasutijumi();
          const { vehicles } = applyListingMembership({
            vehicles: [...latest.vehicles, snap],
            sources: buildIrissListingSources(rows),
            rejectedIds: operatorRejectedIds(state),
            nowMs: Date.now(),
          });
          await persistVehicles(vehicles);
        }
      }
    }
    return NextResponse.json({ fav: state.fav, rejected: state.rejected });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
