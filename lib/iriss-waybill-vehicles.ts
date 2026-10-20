import { toActiveWaybillRows } from "@/lib/iriss-pavadzimes-active";
import { readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";
import type { WaybillRequestVehicle } from "@/lib/iriss-waybill-requests";

export type WaybillVehicleChip = WaybillRequestVehicle & {
  chip: string;
};

function chipLabel(brandModel: string, plate: string): string {
  const brand = brandModel.trim().split(/\s+/).slice(0, 2).join(" ");
  if (brand) return brand.length > 18 ? brand.slice(0, 16) : brand;
  return plate.trim() || "Auto";
}

export async function listWaybillVehicleChips(now = new Date()): Promise<WaybillVehicleChip[]> {
  const rows = toActiveWaybillRows(await readIrissPavadzimesCached(), now);
  const out: WaybillVehicleChip[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const vin = row.vin.trim().toUpperCase();
    const plate = row.plate.trim().toUpperCase();
    const key = vin || plate || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      chip: chipLabel(row.brandModel, plate),
      brandModel: row.brandModel.trim(),
      vin,
      plate,
      orderId: row.order?.id ?? "",
    });
  }
  return out.slice(0, 12);
}
