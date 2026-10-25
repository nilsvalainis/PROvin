/** Luksofors sākuma apļiem: 12-48 h zaļš, ~8 h oranžs, ~2 h sarkans. */

export type WaybillHomeRingTone = "ok" | "soon" | "urgent" | "free";

export const WAYBILL_HOME_RING: Record<Exclude<WaybillHomeRingTone, "free">, string> = {
  ok: "#34c759",
  soon: "#ff9f0a",
  urgent: "#ff3b30",
};

export const WAYBILL_HOME_RING_FREE = "#c7c7cc";

/** 12 h un vairāk = zaļš; zem 12 h = oranžs; 2 h un mazāk = sarkans. */
export function waybillHomeRingTone(hoursLeft: number, busy = true): WaybillHomeRingTone {
  if (!busy) return "free";
  if (hoursLeft <= 2) return "urgent";
  if (hoursLeft < 12) return "soon";
  return "ok";
}

export function waybillHomeRingColor(hoursLeft: number, busy = true): string {
  const tone = waybillHomeRingTone(hoursLeft, busy);
  return tone === "free" ? WAYBILL_HOME_RING_FREE : WAYBILL_HOME_RING[tone];
}
