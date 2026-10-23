import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { toActiveWaybillRows } from "@/lib/iriss-pavadzimes-active";
import { computeWaybillLifecycles, sortWaybillsNewestFirst } from "@/lib/iriss-pavadzimes-lifecycle";
import { matchIrissPavadzimesToOrders } from "@/lib/iriss-pavadzimes-match";
import { waybillValidityTone } from "@/lib/iriss-pavadzimes-parse";
import { listIrissPavadzimes, readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";
import type { IrissPavadzimeListRow, IrissPavadzimeRecord } from "@/lib/iriss-pavadzimes-types";
import { isAllowlistedWaybillPlate } from "@/lib/iriss-waybill-plates";
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
  const listed = await listIrissPavadzimes();
  let orders: Awaited<ReturnType<typeof listIrissPasutijumi>> = [];
  if (withOrders) {
    try {
      orders = await listIrissPasutijumi();
    } catch {
      orders = [];
    }
  }
  const lifecycles = computeWaybillLifecycles(listed.rows, now);
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
}> {
  const cached = await readIrissPavadzimesCached();
  const rows = selectActiveCardWaybills(cached, now);
  return { rows: opts.withOrders ?? true ? rows : rows.map(waybillRowWithoutOrder) };
}
