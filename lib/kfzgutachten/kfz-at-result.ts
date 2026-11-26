/**
 * kfzgutachten.at automātiskās pārbaudes teksti un datu pārveide (tīras funkcijas, der arī klientā).
 * Vienas formas visās vietās: VIN SCAN v4 «Ārvalstu reģistri → Austrija», pasūtījuma «Austrija · §57a apskates»,
 * Ātrie vērtējumi. Atzinumus (1,19 €) sistēma nepērk - te tikai bezmaksas saraksts (skaits, datumi).
 */

import type { KfzSearchListRow } from "@/lib/kfzgutachten/apply-citi";

/** «1 atzinums», «6 atzinumi», «21 atzinums». */
export function kfzAtCountLv(n: number, one = "atzinums", many = "atzinumi"): string {
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`;
}

const MAX_DATES = 12;

/** «kfzgutachten.at: 6 atzinumi (13.11.2015, 04.08.2016, …)». */
export function kfzAtFoundSummary(dates: readonly string[]): string {
  const list = dates.filter(Boolean);
  const shown = list.slice(0, MAX_DATES).join(", ");
  const more = list.length > MAX_DATES ? `, +${list.length - MAX_DATES}` : "";
  return `kfzgutachten.at: ${kfzAtCountLv(list.length)}${shown ? ` (${shown}${more})` : ""}`;
}

export function kfzAtNoneSummary(date: string): string {
  return `kfzgutachten.at: nav ierakstu${date ? ` (1. reģ. ${date})` : ""}`;
}

/** «kfzgutachten.at: nav pārbaudīts (rindā 1. - nolasīs ap 21:02) - izmanto pārlūka joslu». */
export function kfzAtUncheckedSummary(reason: string): string {
  const r = reason.replace(/\s*-\s*(izmanto|pārbaudi) pārlūka joslu\.?$/i, "").trim();
  return `kfzgutachten.at: nav pārbaudīts${r ? ` (${r})` : ""} - izmanto pārlūka joslu`;
}

type InspectionLike = { date?: string; plate?: string; model?: string; result?: string };

/** VIN SCAN kfz_at rindas apskates -> Citi avoti saraksta rindas (tā pati forma kā ielīmēšanai). */
export function kfzAtListRowsFromInspections(vin: string, inspections: readonly InspectionLike[] | null | undefined): KfzSearchListRow[] {
  const v = vin.trim().toUpperCase();
  const out: KfzSearchListRow[] = [];
  for (const i of inspections ?? []) {
    const date = /^\d{2}\.\d{2}\.\d{4}$/.test(i.date ?? "") ? i.date! : "";
    if (!date) continue;
    out.push({ date, plate: (i.plate ?? "").trim(), vin: v, model: (i.model ?? "").trim() });
  }
  return out;
}
