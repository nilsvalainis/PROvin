/**
 * IRISS pasūtījumu saraksta 01 skats: īsa specifikācija, nākamais solis,
 * jaunie atrastie, Zvanīt tikai telefonā, E-pasts tikai ar adresi.
 * Vecos pasūtījumu JSON neaiztiek.
 */

import { normalizeWhatsAppPhoneDigits } from "@/lib/admin-whatsapp-phone";
import { irissOrderRoomNextSteps } from "@/lib/iriss-order-room";
import {
  formatIrissClientName,
  irissListRowPowerKwLabel,
  irissPhoneTelHref,
} from "@/lib/iriss-pasutijumi-list-row";
import type { IrissPasutijumsListRow } from "@/lib/iriss-pasutijumi-types";

export const IRISS_LIST_SORT_LABEL = {
  created_desc: "Jaunākie vispirms",
  created_asc: "Vecākie vispirms",
  brand_asc: "Marka A-Z",
  brand_desc: "Marka Z-A",
  budget_asc: "Budžets: zemākā",
  budget_desc: "Budžets: augstākā",
} as const;

export function irissListShowCallAction(isPhoneViewport: boolean): boolean {
  return isPhoneViewport;
}

export function irissListShowEmailAction(email: string | null | undefined): boolean {
  const t = (email ?? "").trim();
  if (!t || t === "-" || t === "\u2014" || t === "\u2013") return false;
  const at = t.indexOf("@");
  if (at < 1) return false;
  const domain = t.slice(at + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

export function irissListMailtoHref(email: string): string | null {
  if (!irissListShowEmailAction(email)) return null;
  return `mailto:${email.trim()}`;
}

export function irissPhoneWhatsAppDigits(phone: string | null | undefined): string | null {
  const t = (phone ?? "").trim();
  if (!t || t === "-" || t === "\u2014" || t === "\u2013") return null;
  return normalizeWhatsAppPhoneDigits(t);
}

/** Nobraukums sarakstam: vienība vienmēr km, ja ir skaitlis. */
export function formatIrissListKm(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t || t === "-" || t === "\u2014" || t === "\u2013") return "";
  if (/\bkm\b/i.test(t)) return t.replace(/\s+/g, " ");
  const compact = t.replace(/\s/g, "").replace(",", ".");
  if (/^\d+(?:\.\d+)?$/.test(compact)) {
    const n = Number.parseFloat(compact);
    if (!Number.isFinite(n)) return t;
    const pretty = Number.isInteger(n)
      ? String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
      : t.replace(/\s+/g, " ");
    return `${pretty} km`;
  }
  return t;
}

/** Īsa rinda zem markas: gadi, jauda, dzinējs, nobraukums. */
export function formatIrissListSpecBrief(
  row: Pick<
    IrissPasutijumsListRow,
    "productionYears" | "engineType" | "maxMileage" | "equipmentRequired" | "brandModel"
  > & { powerKwLabel?: string },
): string {
  const parts: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t) parts.push(t);
  };
  const power = irissListRowPowerKwLabel(row);
  push(power);
  push(row.productionYears);
  const engine = (row.engineType ?? "").trim();
  if (engine && !power) push(engine);
  else if (engine && power && !engine.toLowerCase().includes(power.toLowerCase()) && !power.toLowerCase().includes(engine.toLowerCase())) {
    push(engine);
  }
  push(formatIrissListKm(row.maxMileage));
  return parts.join(" · ");
}

export function irissListRowHasOffer(row: Pick<IrissPasutijumsListRow, "hasExpiredOffer" | "latestOfferValidUntil">): boolean {
  return Boolean(row.hasExpiredOffer) || Boolean((row.latestOfferValidUntil ?? "").trim());
}

export function formatIrissListNextStep(
  row: Pick<IrissPasutijumsListRow, "phone" | "vin" | "hasExpiredOffer" | "latestOfferValidUntil">,
  newHits: number,
): string {
  const steps = irissOrderRoomNextSteps({
    newHits,
    offerCount: irissListRowHasOffer(row) ? 1 : 0,
    hasPhone: Boolean(irissPhoneTelHref(row.phone)),
    hasVin: Boolean((row.vin ?? "").trim()),
  });
  return steps[0]?.label ?? "";
}

export function formatIrissExpiredOfferLabel(validUntil: string | null | undefined): string {
  const raw = (validUntil ?? "").trim();
  if (!raw) return "Piedāvājums beidzies";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `Piedāvājums beidzies ${iso[3]}.${iso[2]}`;
  return `Piedāvājums beidzies ${raw.slice(0, 10)}`;
}

export function formatIrissListPhoneText(phone: string | null | undefined): string {
  const t = (phone ?? "").trim();
  if (!t || t === "-" || t === "\u2014" || t === "\u2013") return "";
  // Nils 28.10 (makets): Latvijas numuri vienotā formā "+371 29 796 840"; citi - kā ievadīti.
  const digits = t.replace(/[\s()-]/g, "");
  const m = digits.match(/^(?:\+?371|00371)?([26]\d{7})$/);
  if (m) {
    const n = m[1]!;
    return `+371 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
  }
  return t;
}

export function formatIrissListClientLine(row: Pick<IrissPasutijumsListRow, "clientFirstName" | "clientLastName" | "phone">): {
  name: string;
  phone: string;
} {
  return {
    name: formatIrissClientName(row),
    phone: formatIrissListPhoneText(row.phone),
  };
}

export function countIrissNewHitsByOrder(
  entries: readonly { orderId: string; status: string }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.status !== "jauns") continue;
    const id = (e.orderId ?? "").trim();
    if (!id) continue;
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

export function formatIrissListLinksLabel(count: number): string {
  if (count <= 0) return "Nav saišu";
  if (count === 1) return "1 saite";
  return `${count} saites`;
}

export function irissListBudgetText(budget: string | null | undefined): string {
  const t = (budget ?? "").trim();
  if (!t || t === "\u2014" || t === "\u2013") return "-";
  // Tikai skaitlis ("40000", "40 000", "40000.00") -> "40 000 €" (Nils 28.10); teksts paliek kā ievadīts.
  const plain = t.replace(/\s|€|eur/gi, "").replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(plain)) {
    const n = Math.round(Number(plain));
    return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
  }
  return t;
}

/** Telefonā "Kritēriji" (Nils 28.10): operatīva kritēriju apskate sarakstā; tukšās rindas izlaiž. */
export function irissListCriteriaRows(
  row: Pick<
    IrissPasutijumsListRow,
    | "productionYears"
    | "maxMileage"
    | "engineType"
    | "transmission"
    | "driveType"
    | "bodyType"
    | "seatCount"
    | "preferredColors"
    | "nonPreferredColors"
    | "interiorFinish"
  >,
): Array<{ label: string; value: string }> {
  const clean = (v: string | null | undefined) => {
    const t = (v ?? "").trim();
    return t === "-" || t === "\u2014" || t === "\u2013" ? "" : t;
  };
  const join = (...xs: string[]) => xs.map(clean).filter(Boolean).join(" · ");
  const colors = [clean(row.preferredColors), clean(row.nonPreferredColors) ? `ne ${clean(row.nonPreferredColors)}` : ""]
    .filter(Boolean)
    .join(" · ");
  const rows: Array<[string, string]> = [
    ["Gadi", clean(row.productionYears)],
    ["Nobraukums", formatIrissListKm(row.maxMileage)],
    ["Degviela · kārba", join(row.engineType, row.transmission)],
    ["Piedziņa", clean(row.driveType)],
    ["Virsbūve · sēdvietas", join(row.bodyType, row.seatCount)],
    ["Krāsas", colors],
    ["Salons", clean(row.interiorFinish)],
  ];
  return rows.filter(([, v]) => v).map(([label, value]) => ({ label, value }));
}
