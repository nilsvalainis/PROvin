import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { toActiveWaybillRows } from "@/lib/iriss-pavadzimes-active";
import { computeWaybillLifecycles, sortWaybillsNewestFirst } from "@/lib/iriss-pavadzimes-lifecycle";
import { matchIrissPavadzimesToOrders } from "@/lib/iriss-pavadzimes-match";
import { waybillValidityTone } from "@/lib/iriss-pavadzimes-parse";
import { listIrissPavadzimes, readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";

export type IrissPavadzimesPageData = {
  rows: IrissPavadzimeListRow[];
  pendingParse: number;
  dropboxConfigured: boolean;
  dropboxError: string | null;
};

export async function loadIrissPavadzimesPageData(now = new Date()): Promise<IrissPavadzimesPageData> {
  const listed = await listIrissPavadzimes();
  let orders: Awaited<ReturnType<typeof listIrissPasutijumi>> = [];
  try {
    orders = await listIrissPasutijumi();
  } catch {
    orders = [];
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
  return {
    rows: sortWaybillsNewestFirst(matched),
    pendingParse: listed.pendingParse,
    dropboxConfigured: listed.dropboxConfigured,
    dropboxError: listed.dropboxError,
  };
}

/** Sānjoslas karte: tikai kešs, bez Dropbox sync un bez pasūtījumu saskaņošanas. */
export async function loadIrissPavadzimesActiveCardData(now = new Date()): Promise<{
  rows: IrissPavadzimeListRow[];
}> {
  const cached = await readIrissPavadzimesCached();
  return { rows: toActiveWaybillRows(cached, now) };
}
