/** PRO pasūtījuma kartītes tonis telefonā: maigs fons + krāsaina svītra kreisajā malā (Nils 21.10). */
export type AdminOrderCardTone = "" | "new" | "dealer" | "mini" | "partner" | "pack";

const DAY_S = 24 * 60 * 60;

export function adminOrderCardTone(args: {
  createdUnix: number;
  nowMs: number;
  complete?: boolean;
  isPack?: boolean;
  partnerHighlight?: boolean;
  dealerHighlight?: boolean;
  miniHighlight?: boolean;
}): AdminOrderCardTone {
  if (args.isPack) return "pack";
  if (args.complete) return "";
  // Veids svarīgāks par "jauns": to redz uzreiz; "jauns" pārējiem auditiem pirmās 24 h.
  if (args.partnerHighlight) return "partner";
  if (args.dealerHighlight) return "dealer";
  if (args.miniHighlight) return "mini";
  const ageS = args.nowMs / 1000 - args.createdUnix;
  return ageS >= 0 && ageS < DAY_S ? "new" : "";
}

export const ADMIN_ORDER_CARD_TONE_LV: Record<Exclude<AdminOrderCardTone, "">, string> = {
  new: "Jauns (24 h)",
  dealer: "Dīlera dati",
  mini: "MINI",
  partner: "Partneris",
  pack: "Paka",
};
