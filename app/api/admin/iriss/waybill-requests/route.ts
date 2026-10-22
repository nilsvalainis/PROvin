import { NextResponse, after } from "next/server";
import { wakeAivars } from "@/lib/iriss-aivars-wake";
import { parseCreateWaybillInput } from "@/lib/iriss-waybill-create";
import { emptyWaybillRequestsDoc, waybillChatPayload } from "@/lib/iriss-waybill-requests";
import { createWaybillRequest, readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";
import {
  displayDealerPlate,
  emptyWaybillPlateStates,
  waybillPlateOccupancy,
  type WaybillPlateState,
} from "@/lib/iriss-waybill-plates";
import { listWaybillVehicleChips } from "@/lib/iriss-waybill-vehicles";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

async function loadVehiclesSafe() {
  try {
    return await listWaybillVehicleChips();
  } catch (err) {
    console.error("[iriss-waybill] vehicles_failed", err instanceof Error ? err.message : err);
    return [];
  }
}

async function loadPlatesSafe(): Promise<WaybillPlateState[]> {
  try {
    return waybillPlateOccupancy(await readIrissPavadzimesCached());
  } catch (err) {
    console.error("[iriss-waybill] plates_failed", err instanceof Error ? err.message : err);
    return emptyWaybillPlateStates();
  }
}

function confirmBusy(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && !Array.isArray(body) && (body as { confirmBusy?: unknown }).confirmBusy === true);
}

export async function GET() {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  try {
    const [doc, vehicles, plates] = await Promise.all([
      readWaybillRequestsDoc(),
      loadVehiclesSafe(),
      loadPlatesSafe(),
    ]);
    return NextResponse.json({ ok: true, ...waybillChatPayload(doc), vehicles, plates }, NO_STORE);
  } catch (err) {
    console.error("[iriss-waybill] list_failed", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        error: "Neizdevās ielādēt pavadzīmju rindu.",
        ok: false,
        ...waybillChatPayload(emptyWaybillRequestsDoc()),
        vehicles: [],
        plates: emptyWaybillPlateStates(),
      },
      { status: 500, ...NO_STORE },
    );
  }
}

export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400, ...NO_STORE });
  }
  const parsed = parseCreateWaybillInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, ...NO_STORE });
  }
  try {
    const plates = await loadPlatesSafe();
    const plate = displayDealerPlate(parsed.value.plate);
    const occupancy = plates.find((row) => row.plate === plate);
    if (occupancy?.busy && !confirmBusy(body)) {
      return NextResponse.json(
        {
          error: "Numurs ir aizņemts.",
          busy: true,
          plate: occupancy.plate,
          current: occupancy.current,
        },
        { status: 409, ...NO_STORE },
      );
    }
    const actor = gate.actor;
    const createdBy = actor.kind === "admin" ? "env-admin" : actor.user.id;
    const createdByName = actor.kind === "admin" ? actor.name : actor.user.name;
    const request = await createWaybillRequest({
      createdBy,
      createdByName,
      payload: parsed.value,
    });
    after(() => wakeAivars(request.id));
    const doc = await readWaybillRequestsDoc();
    return NextResponse.json(
      { ok: true, request, ...waybillChatPayload(doc), plates },
      NO_STORE,
    );
  } catch (err) {
    console.error("[iriss-waybill] create_failed", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Neizdevās nosūtīt pavadzīmes pieprasījumu." },
      { status: 500, ...NO_STORE },
    );
  }
}
