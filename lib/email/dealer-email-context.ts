/**
 * Dīlera / atskaites e-pasta kartītes dati sūtīšanas brīdī (variants A):
 * kopsavilkuma fakti no melnraksta dīlera ierakstiem un AUDITS piemaksas saites termiņš.
 * Tikai fakti - nekādu ieteikumu. Ja datu nav, atgriež tukšu (bloku nerāda).
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { dealerServiceWorksFromSources, type DealerFactsAutoRecords } from "@/lib/admin-ai-dealer-facts";
import type { EmailFact } from "@/lib/email/email-layout";
import { collectEngineOilChangeRows } from "@/lib/oil-change-intervals";
import { autoRecordsServiceWorkRowHasData } from "@/lib/auto-records-service-works";

function lvPlural(n: number, one: string, many: string): string {
  return n % 10 === 1 && n % 100 !== 11 ? one : many;
}

const LABELS: Record<
  ClientReportLang,
  { service: (n: number) => string; last: string; oil: (n: number) => string }
> = {
  lv: {
    service: (n) => lvPlural(n, "servisa ieraksts", "servisa ieraksti"),
    last: "pēdējais ieraksts",
    oil: (n) => lvPlural(n, "eļļas maiņa", "eļļas maiņas"),
  },
  en: {
    service: (n) => (n === 1 ? "service record" : "service records"),
    last: "last record",
    oil: (n) => (n === 1 ? "oil change" : "oil changes"),
  },
  de: {
    service: (n) => (n === 1 ? "Serviceeintrag" : "Serviceeinträge"),
    last: "letzter Eintrag",
    oil: () => "Ölwechsel",
  },
  ru: {
    service: () => "сервисные записи",
    last: "последняя запись",
    oil: () => "замены масла",
  },
};

function yearOf(date: string): number | null {
  const m = /(\d{4})\s*$/.exec(date.trim()) ?? /^(\d{4})-\d{2}/.exec(date.trim());
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1950 && y <= 2100 ? y : null;
}

/**
 * «N servisa ieraksti · pēdējais YYYY · N eļļas maiņas» - no melnraksta `auto_records`.
 * Bez servisa ierakstiem - [] (bloku nerāda).
 */
export function dealerEmailFacts(
  autoRecords: DealerFactsAutoRecords | null | undefined,
  lang: ClientReportLang = "lv",
): EmailFact[] {
  if (!autoRecords) return [];
  const rows = dealerServiceWorksFromSources({ autoRecords }).filter(autoRecordsServiceWorkRowHasData);
  if (rows.length === 0) return [];
  const L = LABELS[lang];
  const facts: EmailFact[] = [{ value: String(rows.length), label: L.service(rows.length) }];
  const years = rows.map((r) => yearOf(r.date ?? "")).filter((y): y is number => y != null);
  if (years.length > 0) facts.push({ value: String(Math.max(...years)), label: L.last });
  const oil = collectEngineOilChangeRows(rows).length;
  if (oil > 0) facts.push({ value: String(oil), label: L.oil(oil) });
  return facts;
}

/** Piemaksas saites termiņš, ja saites tokens ir operatora tekstā (citādi - nekas). */
export function upsellExpiryForText(
  text: string,
  offers: readonly { token: string; expiresAt: string; status?: string }[],
): string | null {
  for (const o of offers) {
    if (o.token && text.includes(`/papildinajums/${o.token}`) && o.expiresAt) return o.expiresAt;
  }
  return null;
}
