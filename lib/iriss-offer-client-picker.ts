/**
 * "Klients ▾" piedāvājuma formā: Pasūtījumu klienti (katrs pasūtījums atsevišķi - Nila atbilde 7).
 * Tīra loģika - komponente tikai rāda.
 */

import type { IrissPasutijumsListRow } from "@/lib/iriss-pasutijumi-types";

/** statusHistory iemesls jaunam pasūtījumam no "+ Piedāvājums" / "Izveidot piedāvājumu" bez klienta. */
export const IRISS_OFFER_CREATED_REASON = "Izveidots kā piedāvājums";

export type IrissOfferClientOption = {
  /** Pasūtījuma id - piedāvājums tiek pievienots šim pasūtījumam. */
  orderId: string;
  name: string;
  /** "BMW 3 Touring · līdz 25 000 €" */
  sub: string;
  search: string;
};

const EUR = new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 0, useGrouping: true });

function budgetLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const n = Number.parseFloat(t.replace(/[\s ]/g, "").replace(",", "."));
  if (Number.isFinite(n) && /^[\d\s .,]+$/.test(t)) return `līdz ${EUR.format(Math.round(n)).replace(/\s/g, " ")} €`;
  return `līdz ${t}`;
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function irissOfferClientOptions(
  rows: readonly Pick<
    IrissPasutijumsListRow,
    "id" | "deletedAt" | "clientFirstName" | "clientLastName" | "phone" | "brandModel" | "totalBudget" | "updatedAt"
  >[],
): IrissOfferClientOption[] {
  return rows
    .filter((r) => !r.deletedAt)
    .map((r) => {
      const fullName = `${r.clientFirstName} ${r.clientLastName}`.replace(/\s+/g, " ").trim();
      const name = fullName || r.phone.trim();
      const sub = [r.brandModel.trim(), budgetLabel(r.totalBudget)].filter(Boolean).join(" · ");
      return { orderId: r.id, name, sub, search: fold(`${fullName} ${r.phone} ${r.phone.replace(/\D/g, "")} ${r.brandModel}`), at: r.updatedAt };
    })
    .filter((o) => o.name)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .map(({ at: _at, ...o }) => o);
}

/** Meklēšana pēc vārda, tālruņa vai auto (bez garumzīmēm, visiem vārdiem jāsakrīt). */
export function filterIrissOfferClientOptions(options: readonly IrissOfferClientOption[], query: string): IrissOfferClientOption[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...options];
  return options.filter((o) => words.every((w) => o.search.includes(w)));
}
