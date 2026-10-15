import { waybillCountdownStatus } from "@/lib/iriss-pavadzimes-countdown";

const DAY_MS = 24 * 60 * 60 * 1000;

export type IrissWaybillMobileBarItem = {
  id: string;
  plate: string;
  daysLabel: string;
  urgent: boolean;
};

/** Kompakta mobilā josla: atlikušās dienas aktīvajām pavadzīmēm. Sarkans, ja drīz beidzas vai beigusies. */
export function irissWaybillMobileBarItems(
  rows: readonly { id: string; plate: string; validUntil: string }[],
  now = new Date(),
): IrissWaybillMobileBarItem[] {
  return rows.map((row) => {
    const status = waybillCountdownStatus(row.validUntil, now);
    const until = Date.parse(row.validUntil);
    const remaining = Number.isFinite(until) ? until - now.getTime() : -1;
    const days = remaining <= 0 ? 0 : Math.ceil(remaining / DAY_MS);
    const daysLabel = status === "expired" ? "0 d" : status === "soon" ? "šodien" : `${days} d`;
    return {
      id: row.id,
      plate: row.plate.trim() || "Pavadzīme",
      daysLabel,
      urgent: status !== "ok",
    };
  });
}
