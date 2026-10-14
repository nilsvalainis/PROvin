import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { toActiveWaybillRows } from "@/lib/iriss-pavadzimes-active";
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
  const matched = matchIrissPavadzimesToOrders(listed.rows, orders);
  return {
    rows: matched.map((row) => ({
      ...row,
      validityTone: waybillValidityTone(row.validUntil, now),
    })),
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
