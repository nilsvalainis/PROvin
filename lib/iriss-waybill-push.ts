/**
 * Paziņojums telefonā, kad pavadzīme izdota vai neizdevās (teksti: ~/pz-teksti.md 6. sadaļa).
 * Tīra loģika; sūta lib/iriss-waybill-requests-store.ts caur sendAdminPush tikai pieprasītāja ierīcēm.
 */
import type { AdminPushMessage } from "@/lib/admin-push-shared";
import { displayDealerPlate, formatRigaDateTimeComma } from "@/lib/iriss-waybill-plates";
import type { WaybillRequest, WaybillRequestStatus } from "@/lib/iriss-waybill-requests";

export const WAYBILL_PUSH_URL = "/admin/iriss/pavadzimes";

/** Kļūda pēc "Saglabāt": CSDD pavadzīme var jau būt izveidota (worker teksts "Pārbaudi CSDD"). */
export function waybillErrorNeedsCheck(errorReason: string): boolean {
  return /pārbaudi csdd/i.test(errorReason);
}

/** Pieprasītāja ierīces (tā pati atslēga kā adminPushUserKey). */
export function waybillPushUserKey(createdBy: string): string {
  return createdBy === "env-admin" ? "admin" : `staff:${createdBy}`;
}

/** Ziņa tikai, kad statuss tikko kļuva par Izdota vai Kļūda. */
export function waybillPushMessage(
  before: Pick<WaybillRequest, "status">,
  after: Pick<WaybillRequest, "id" | "status" | "vehicle" | "validUntil" | "errorReason">,
): AdminPushMessage | null {
  const changed = (s: WaybillRequestStatus) => after.status === s && before.status !== s;
  const car = after.vehicle.brandModel.trim() || "Auto";
  const plate = displayDealerPlate(after.vehicle.plate) || after.vehicle.plate;
  const head = [car, plate].filter(Boolean).join(" · ");
  const base = { url: WAYBILL_PUSH_URL, tag: `waybill-${after.id}`, audience: "iriss" as const };
  if (changed("issued")) {
    const until = formatRigaDateTimeComma(after.validUntil);
    return {
      ...base,
      title: "Pavadzīme izdota",
      body: `${head}${until ? ` · derīga līdz ${until}` : ""}. Atver PDF.`,
    };
  }
  if (changed("error")) {
    const reason = after.errorReason.trim().slice(0, 120);
    if (waybillErrorNeedsCheck(reason)) {
      return { ...base, title: "Pārbaudi pavadzīmi", body: `${head}: iespējams, CSDD jau ir izveidota. Pārbaudi, pirms atkārto.` };
    }
    return {
      ...base,
      title: "Pavadzīme nav izdota",
      body: `${head}${reason ? `: ${reason}` : ""}. Atver un spied "Atkārtot".`,
    };
  }
  return null;
}
