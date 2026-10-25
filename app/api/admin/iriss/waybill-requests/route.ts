import { NextResponse, after } from "next/server";
import { wakeAivars } from "@/lib/iriss-aivars-wake";
import { autoWaybillReplaceEnabled, classifyWaybillForAuto, plateTakenByOtherRequest } from "@/lib/iriss-waybill-auto";
import { loadWaybillPlateOccupancy, waybillAutoContext } from "@/lib/iriss-waybill-auto-server";
import { parseCreateWaybillInput } from "@/lib/iriss-waybill-create";
import {
  emptyWaybillRequestsDoc,
  waybillChatPayload,
  waybillDocWithoutOrders,
  waybillRequestWithoutOrder,
} from "@/lib/iriss-waybill-requests";
import { createWaybillRequest, readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { readDismissedWaybillIds } from "@/lib/iriss-waybill-dismissed-store";
import { displayDealerPlate, emptyWaybillPlateStates, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import { withWaybillRequestStates } from "@/lib/iriss-waybill-live-plates";
import { listWaybillVehicleChips } from "@/lib/iriss-waybill-vehicles";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { waybillTradeCarsWithSource, type WaybillCarsSource, type WaybillTradeCar } from "@/lib/iriss-waybill-trade-cars";
import { canSeeWaybillOrders } from "@/lib/iriss-pavadzimes-list";
import { requireIrissSectionApi, waybillPdfViewer } from "@/lib/staff-auth";
import { withWaybillPdfAccess } from "@/lib/iriss-waybill-pdf";

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

/** Numuru stāvoklis: indekss + CSDD reģistrs (arī ar roku izrakstītās pavadzīmes). */
async function loadPlateOccupancySafe(): Promise<{ plates: WaybillPlateState[]; withdrawnNos: ReadonlySet<string> }> {
  try {
    return await loadWaybillPlateOccupancy();
  } catch (err) {
    console.error("[iriss-waybill] plates_failed", err instanceof Error ? err.message : err);
    return { plates: emptyWaybillPlateStates(), withdrawnNos: new Set() };
  }
}

function livePlates(
  occupancy: { plates: WaybillPlateState[]; withdrawnNos: ReadonlySet<string> },
  requests: Parameters<typeof withWaybillRequestStates>[1],
  nowMs = Date.now(),
): WaybillPlateState[] {
  return withWaybillRequestStates(occupancy.plates, requests, nowMs, occupancy.withdrawnNos);
}

/** "Dzēst" paslēptie (tikai šim lietotājam); kļūda nav fatāla - tad vienkārši nekas nav paslēpts. */
async function loadDismissedSafe(actorId: string): Promise<string[]> {
  try {
    return await readDismissedWaybillIds(actorId);
  } catch (err) {
    console.error("[iriss-waybill] dismissed_failed", err instanceof Error ? err.message : err);
    return [];
  }
}

function busyFromPlates(plates: WaybillPlateState[]): (plate: string) => boolean {
  const busy = new Set(plates.filter((row) => row.busy).map((row) => row.plate as string));
  return (plate) => busy.has(displayDealerPlate(plate));
}

function confirmBusy(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && !Array.isArray(body) && (body as { confirmBusy?: unknown }).confirmBusy === true);
}

/** Pavadzīme, ko lietotājs apstiprināja anulēt (redzēja logā). Tukšs - vecs klients. */
function confirmedWaybillNo(body: unknown): string {
  const v = body && typeof body === "object" ? (body as { confirmWaybillNo?: unknown }).confirmWaybillNo : "";
  return typeof v === "string" ? v.trim().toUpperCase().slice(0, 12) : "";
}

export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  // Auto sarakstu lasa tikai pēc pieprasījuma (?cars=1), nevis katrā 5 s atjaunošanā.
  const withCars = new URL(req.url).searchParams.get("cars") === "1";
  try {
    const [doc, vehicles, occupancy, tradeCars, dismissedIds] = await Promise.all([
      readWaybillRequestsDoc(),
      loadVehiclesSafe(),
      loadPlateOccupancySafe(),
      withCars ? loadTradeCarsSafe() : Promise.resolve(null),
      loadDismissedSafe(gate.actor.kind === "admin" ? "env-admin" : gate.actor.user.id),
    ]);
    // Tas pats stāvoklis, ko rāda apļi (j25): arī tikko izdotā pavadzīme, kuras vēl nav indeksā.
    const plates = livePlates(occupancy, doc.requests);
    const auto = await waybillAutoContext(doc, busyFromPlates(plates));
    const withOrders = canSeeWaybillOrders(gate.actor);
    return NextResponse.json(
      {
        ok: true,
        ...withWaybillPdfAccess(
          waybillChatPayload(withOrders ? doc : waybillDocWithoutOrders(doc), Date.now(), auto),
          waybillPdfViewer(gate.actor),
        ),
        autoMode: auto.mode,
        vehicles: withOrders ? vehicles : vehicles.map((v) => ({ ...v, orderId: "" })),
        plates,
        dismissedIds,
        ...(tradeCars ? { tradeCars: tradeCars.cars, tradeCarsSource: tradeCars.source } : {}),
      },
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
    const [base, docBefore] = await Promise.all([loadPlateOccupancySafe(), readWaybillRequestsDoc()]);
    const plates = livePlates(base, docBefore.requests);
    const plate = displayDealerPlate(parsed.value.plate);
    const occupancy = plates.find((row) => row.plate === plate);
    const confirmedNo = confirmedWaybillNo(body);
    // Apstiprināts cits numurs, nekā tagad aizņem (piem. Nils tikmēr izrakstīja ar roku) - jautā vēlreiz ar aktuālo.
    const confirmedOther = Boolean(confirmedNo && occupancy?.current?.number && occupancy.current.number.toUpperCase() !== confirmedNo);
    if (occupancy?.busy && (!confirmBusy(body) || confirmedOther)) {
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
      // "Vai tiešām anulēt iepriekšējo un izveidot jaunu?" -> Jā: anulēt drīkst TIKAI šo (tobrīd redzamo) pavadzīmi.
      replaceWaybillNo: occupancy?.busy ? (occupancy.current?.number ?? "") : "",
    });
    const doc = await readWaybillRequestsDoc();
    const classified = classifyWaybillForAuto(request, {
      plateBusyNow: Boolean(occupancy?.busy),
      plateInOtherRequest: plateTakenByOtherRequest(doc.requests, request),
      replaceEnabled: autoWaybillReplaceEnabled(),
    });
    const auto = await waybillAutoContext(doc, busyFromPlates(plates));
    // Standarta darbu ņem automātika tikai īstajā režīmā; testa režīmā vai nestandarta - uzreiz pamodina Aivaru.
    if (!(auto.mode === "live" && classified.standard)) after(() => wakeAivars(request.id));
    const withOrders = canSeeWaybillOrders(actor);
    return NextResponse.json(
      {
        ok: true,
        request: withOrders ? request : waybillRequestWithoutOrder(request),
        ...withWaybillPdfAccess(
          waybillChatPayload(withOrders ? doc : waybillDocWithoutOrders(doc), Date.now(), auto),
          waybillPdfViewer(actor),
        ),
        autoMode: auto.mode,
        plates: livePlates(base, doc.requests),
      },
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
