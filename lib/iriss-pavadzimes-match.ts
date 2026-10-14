import { formatIrissClientName } from "@/lib/iriss-pasutijumi-list-row";
import { isIrissPasutijumsWorkingStatus } from "@/lib/iriss-pasutijumi-types";
import type { IrissPasutijumsListRow } from "@/lib/iriss-pasutijumi-types";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import type { IrissPavadzimeOrderMatch } from "@/lib/iriss-pavadzimes-types";

function vinKey(raw: string): string {
  return normalizeVin(raw);
}

export function matchIrissPasutijumsByVin(
  vin: string,
  orders: readonly Pick<
    IrissPasutijumsListRow,
    "id" | "vin" | "updatedAt" | "listStatus" | "clientFirstName" | "clientLastName" | "brandModel"
  >[],
): IrissPavadzimeOrderMatch | null {
  const key = vinKey(vin);
  if (!key || !isValidVin(key)) return null;
  const hits = orders.filter((o) => vinKey(o.vin) === key);
  if (hits.length === 0) return null;
  hits.sort((a, b) => {
    const aw = isIrissPasutijumsWorkingStatus(a.listStatus ?? "active") ? 0 : 1;
    const bw = isIrissPasutijumsWorkingStatus(b.listStatus ?? "active") ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
  const hit = hits[0];
  if (!hit) return null;
  const name = formatIrissClientName(hit);
  const label = name !== "—" ? name : hit.brandModel.trim() || "Pasūtījums";
  return { id: hit.id, label };
}

export function matchIrissPavadzimesToOrders<T extends { vin: string }>(
  rows: readonly T[],
  orders: readonly IrissPasutijumsListRow[],
): Array<T & { order: IrissPavadzimeOrderMatch | null }> {
  return rows.map((row) => ({ ...row, order: matchIrissPasutijumsByVin(row.vin, orders) }));
}
