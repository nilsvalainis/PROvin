import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { toActiveWaybillRows } from "@/lib/iriss-pavadzimes-active";
import { computeWaybillLifecycles, sortWaybillsNewestFirst } from "@/lib/iriss-pavadzimes-lifecycle";
import { matchIrissPavadzimesToOrders } from "@/lib/iriss-pavadzimes-match";
import { waybillValidityTone } from "@/lib/iriss-pavadzimes-parse";
import { listIrissPavadzimes, readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";
import type { IrissPavadzimeListRow, IrissPavadzimeRecord } from "@/lib/iriss-pavadzimes-types";
import { isAllowlistedWaybillPlate, waybillPlateOccupancy, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import { mergeCsddActiveRows, mergeCsddPlateStates } from "@/lib/iriss-waybill-csdd-plates";
import { withWaybillRequestStates } from "@/lib/iriss-waybill-live-plates";
import { readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { readCsddPlatesDocSafe } from "@/lib/iriss-waybill-csdd-plates-store";
import type { IrissSection } from "@/lib/staff-roles";

export type IrissPavadzimesPageData = {
  rows: IrissPavadzimeListRow[];
  pendingParse: number;
  dropboxConfigured: boolean;
  dropboxError: string | null;
};

/** Pasūtījuma saiti (klienta vārdu) pie pavadzīmes redz tikai administrators vai darbinieks ar sadaļu Pasūtījumi. */
export function canSeeWaybillOrders(actor: { kind: "admin" } | { kind: "staff"; user: { sections: readonly IrissSection[] } }): boolean {
  return actor.kind === "admin" || actor.user.sections.includes("pasutijumi");
}

/** Darbiniekam bez Pasūtījumiem: tikai pavadzīmes lauki - bez pasūtījuma saites un krātuves (Dropbox/Blob) ceļiem. */
export function waybillRowWithoutOrder<T extends IrissPavadzimeListRow>(row: T): T {
  return { ...row, order: null, dropboxId: "", dropboxPath: "", dropboxRev: "", dropboxContentHash: "", blobPath: "" };
}

export async function loadIrissPavadzimesPageData(
  now = new Date(),
  opts: { withOrders?: boolean } = {},
): Promise<IrissPavadzimesPageData> {
  const withOrders = opts.withOrders ?? true;
  const [listed, csdd] = await Promise.all([listIrissPavadzimes(), readCsddPlatesDocSafe()]);
  let orders: Awaited<ReturnType<typeof listIrissPasutijumi>> = [];
  if (withOrders) {
    try {
      orders = await listIrissPasutijumi();
    } catch {
      orders = [];
    }
  }
  const lifecycles = computeWaybillLifecycles(listed.rows, now, csdd);
  const matched = matchIrissPavadzimesToOrders(listed.rows, orders).map((row, i) => {
    const src = listed.rows[i];
    const info = src ? lifecycles.get(src) : undefined;
    return {
      ...row,
      validityTone: waybillValidityTone(row.validUntil, now),
      lifecycle: info?.lifecycle ?? "unknown",
      ...(info?.supersededBy ? { supersededBy: info.supersededBy } : {}),
    };
  });
  const sorted = sortWaybillsNewestFirst(matched);
  return {
    rows: withOrders ? sorted : sorted.map(waybillRowWithoutOrder),
    pendingParse: listed.pendingParse,
    dropboxConfigured: listed.dropboxConfigured,
    dropboxError: listed.dropboxError,
  };
}

/** Sānjosla / mobilā josla: tikai dzīvie dīlera nr., bez B861-6. */
export function selectActiveCardWaybills(
  rows: IrissPavadzimeRecord[],
  now = new Date(),
): IrissPavadzimeListRow[] {
  return toActiveWaybillRows(rows, now).filter((row) => isAllowlistedWaybillPlate(row.plate));
}

/** Sānjoslas karte: tikai kešs, bez Dropbox sync un bez pasūtījumu saskaņošanas. */
export async function loadIrissPavadzimesActiveCardData(
  now = new Date(),
  opts: { withOrders?: boolean } = {},
): Promise<{
  rows: IrissPavadzimeListRow[];
  /** Numuru stāvoklis - tas pats, ko rāda numura pogas (j25). Apļi to ņem par pamatu, rows tikai PDF saitei. */
  plates: WaybillPlateState[];
}> {
  const [cached, csdd, requests] = await Promise.all([readIrissPavadzimesCached(), readCsddPlatesDocSafe(), readWaybillRequestsSafe()]);
  // CSDD reģistrā aktīvas (arī ar roku izrakstītas) pavadzīmes, kuru nav indeksā - lai josla nerāda "brīvs".
  const rows = mergeCsddActiveRows(selectActiveCardWaybills(cached, now), csdd, now);
  const plates = withWaybillRequestStates(mergeCsddPlateStates(waybillPlateOccupancy(cached, now, csdd), csdd, now.getTime()), requests, now.getTime());
  return { rows: opts.withOrders ?? true ? rows : rows.map(waybillRowWithoutOrder), plates };
}

/** Pieprasījumu rinda apļiem; kļūda nav fatāla (tad tikai indekss + CSDD). */
async function readWaybillRequestsSafe() {
  try {
    return (await readWaybillRequestsDoc()).requests;
  } catch (err) {
    console.error("[iriss pavadzimes] requests_failed", err instanceof Error ? err.message : err);
    return [];
  }
}
