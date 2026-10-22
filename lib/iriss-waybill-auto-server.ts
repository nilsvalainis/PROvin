import "server-only";

import { readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";
import { displayDealerPlate, waybillPlateOccupancy } from "@/lib/iriss-waybill-plates";

/**
 * Aizņemtie numuri tieši tagad. Ja nevar nolasīt, visi skaitās aizņemti:
 * automātika labāk atdod darbu Aivaram, nekā riskē ar aktīvu pavadzīmi.
 */
export async function busyWaybillPlatesNow(): Promise<(plate: string) => boolean> {
  try {
    const busy = new Set(
      waybillPlateOccupancy(await readIrissPavadzimesCached())
        .filter((row) => row.busy)
        .map((row) => row.plate as string),
    );
    return (plate) => busy.has(displayDealerPlate(plate));
  } catch (err) {
    console.error("[iriss-waybill] auto_plates_failed", err instanceof Error ? err.message : err);
    return () => true;
  }
}
