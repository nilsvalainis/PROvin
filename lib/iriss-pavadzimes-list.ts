import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { matchIrissPavadzimesToOrders } from "@/lib/iriss-pavadzimes-match";
import { waybillValidityTone } from "@/lib/iriss-pavadzimes-parse";
import { listIrissPavadzimes } from "@/lib/iriss-pavadzimes-store";
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
