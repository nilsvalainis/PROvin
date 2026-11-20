import "server-only";

import { autoparksCarTitle } from "@/lib/iriss-autoparks";
import { effectiveAutoparksCar } from "@/lib/iriss-autoparks-effective";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";
import { fmtKm } from "@/lib/iriss-autoparks-v2-format";
import {
  IRISS_CAR_SHARE_PUBLIC_BRAND,
  IRISS_CAR_SHARE_PUBLIC_LEGAL,
  type IrissCarSharePublicView,
} from "@/lib/iriss-car-share";
import { readIrissCarShareByToken } from "@/lib/iriss-car-share-store";
import { getLogisticsOrder } from "@/lib/iriss-logistics-store";

export async function loadIrissCarSharePublicView(token: string): Promise<IrissCarSharePublicView | null> {
  const rec = await readIrissCarShareByToken(token);
  if (!rec) return null;
  if (rec.autoparksCarId) {
    const found = await readAutoparksV2Car(rec.autoparksCarId).catch(() => null);
    if (found) {
      // Efektīvie Pamatdati (v2 labotais VIN/marka/gads/krāsa/nobraukums), kā kabinetā.
      const car = effectiveAutoparksCar(found.car, found.v2);
      const mileage = car.mileageKm != null ? fmtKm(car.mileageKm) : "";
      return {
        brand: IRISS_CAR_SHARE_PUBLIC_BRAND,
        legalName: IRISS_CAR_SHARE_PUBLIC_LEGAL,
        title: autoparksCarTitle(car),
        year: car.year,
        color: car.color,
        vin: car.vin,
        mileage,
        hasPhoto: Boolean(found.v2.mainPhoto?.dropboxId || found.v2.mainPhoto?.thumbBlobPath),
      };
    }
  }
  if (rec.logisticsOrderId) {
    const order = await getLogisticsOrder(rec.logisticsOrderId).catch(() => null);
    if (order) {
      return {
        brand: IRISS_CAR_SHARE_PUBLIC_BRAND,
        legalName: IRISS_CAR_SHARE_PUBLIC_LEGAL,
        title: (order.title || `${order.make} ${order.model}`).replace(/\s+/g, " ").trim() || "Auto",
        year: "",
        color: "",
        vin: order.vin,
        mileage: order.mileageKm != null ? fmtKm(order.mileageKm) : "",
        hasPhoto: false,
      };
    }
  }
  return null;
}
