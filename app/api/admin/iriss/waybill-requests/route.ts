import { NextResponse, after } from "next/server";
import { wakeAivars } from "@/lib/iriss-aivars-wake";
import { classifyWaybillForAuto, plateTakenByOtherRequest } from "@/lib/iriss-waybill-auto";
import { waybillAutoContext } from "@/lib/iriss-waybill-auto-server";
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
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { waybillTradeCarsWithSource, type WaybillCarsSource, type WaybillTradeCar } from "@/lib/iriss-waybill-trade-cars";
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

/** Telefona formas auto saraksts: tikai drošie lauki (bez cenām), arī lietotājam bez Autoparka tiesībām. */
async function loadTradeCarsSafe(): Promise<{ cars: WaybillTradeCar[]; source: WaybillCarsSource }> {
  try {
    return waybillTradeCarsWithSource((await readAutoparksState()).cars);
  } catch (err) {
    console.error("[iriss-waybill] trade_cars_failed", err instanceof Error ? err.message : err);
    return { cars: [], source: "registry" };
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

function busyFromPlates(plates: WaybillPlateState[]): (plate: string) => boolean {
  const busy = new Set(plates.filter((row) => row.busy).map((row) => row.plate as string));
  return (plate) => busy.has(displayDealerPlate(plate));
}

function confirmBusy(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && !Array.isArray(body) && (body as { confirmBusy?: unknown }).confirmBusy === true);
}

export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  // Auto sarakstu lasa tikai pēc pieprasījuma (?cars=1), nevis katrā 5 s atjaunošanā.
  const withCars = new URL(req.url).searchParams.get("cars") === "1";
  try {
    const [doc, vehicles, plates, tradeCars] = await Promise.all([
      readWaybillRequestsDoc(),
      loadVehiclesSafe(),
      loadPlatesSafe(),
      withCars ? loadTradeCarsSafe() : Promise.resolve(null),
    ]);
    const auto = await waybillAutoContext(doc, busyFromPlates(plates));
    return NextResponse.json(
      { ok: true, ...waybillChatPayload(doc, Date.now(), auto), autoMode: auto.mode, vehicles, plates, ...(tradeCars ? { tradeCars: tradeCars.cars, tradeCarsSource: tradeCars.source } : {}) },
      NO_STORE,
    );
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
    return NextResponse.json({ error: "Nederīgs pieprasījums." }, { status: 400, ...NO_STORE });
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
      plateBusyAtCreate: Boolean(occupancy?.busy),
    });
    const doc = await readWaybillRequestsDoc();
    const classified = classifyWaybillForAuto(request, {
      plateBusyNow: Boolean(occupancy?.busy),
      plateInOtherRequest: plateTakenByOtherRequest(doc.requests, request),
    });
    const auto = await waybillAutoContext(doc, busyFromPlates(plates));
    // Standarta darbu ņem automātika tikai īstajā režīmā; testa režīmā vai nestandarta - uzreiz pamodina Aivaru.
    if (!(auto.mode === "live" && classified.standard)) after(() => wakeAivars(request.id));
    return NextResponse.json(
      { ok: true, request, ...waybillChatPayload(doc, Date.now(), auto), autoMode: auto.mode, plates },
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
