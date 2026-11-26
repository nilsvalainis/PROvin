/**
 * Latvijā reģistrācijas ilgums - tikai no reģistra notikumiem (CSDD, LTAB).
 */

import { isCsddNotRegisteredStatus } from "@/lib/csdd-registry-signals";
import {
  csddMileageRowHasData,
  ltabRowHasData,
  type AutoRecordsBlockState,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
} from "@/lib/admin-source-blocks";
import { formatSourceDatePreservingMonth } from "@/lib/auto-records-paste-parse";
import { isLatviaCountryName } from "@/lib/country-names-lv";
import { ownerFirstRegistrationInLatvia } from "@/lib/csdd-extended-parse";
import { parseMileageDateForSort } from "@/lib/unified-mileage";
import type { ClientReportLang } from "@/lib/client-report-i18n";

export type LatviaRegistrationTenure = {
  firstDateDisplay: string;
  daysRegistered: number;
  monthsRegistered: number;
  sentence: string;
  sourceLabels: string[];
  /**
   * false - CSDD «Pirmā reģistrācija Latvijā» nav; datums ir agrākais LV signāls (apskate, OCTA), ne reģistrācija.
   * 26.11 (Mercedes SE→DK→LV): «0 dienas, kopš 26.11.2026» no šodienas apskates bija maldinoši.
   */
  exact: boolean;
};

export type LatviaRegistrationTenureInput = {
  csddForm?: CsddFormFields | null;
  autoRecordsBlock?: AutoRecordsBlockState | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
  referenceDate?: Date;
};

type DateCandidate = { sortable: number; dateRaw: string; source: string };

function pushCandidate(out: DateCandidate[], dateRaw: string, source: string): void {
  const t = dateRaw.trim();
  if (!t) return;
  const sortable = parseMileageDateForSort(t);
  if (sortable === Number.NEGATIVE_INFINITY) return;
  out.push({ sortable, dateRaw: t, source });
}

function formatDisplayDate(raw: string): string {
  // Mēneša precizitāte („06.2023”) paliek mēnesis - nekad neizdomā „01.06.2023”.
  return formatSourceDatePreservingMonth(raw) || raw.trim();
}

function daysBetweenUtc(fromMs: number, toMs: number): number {
  const a = new Date(fromMs);
  const b = new Date(toMs);
  const from = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const to = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function monthsBetweenUtc(fromMs: number, toMs: number): number {
  const a = new Date(fromMs);
  const b = new Date(toMs);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function lvDienaLabel(days: number): string {
  return days === 1 ? "diena" : "dienas";
}

function lvMenesisForm(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "mēnesis";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "mēneši";
  return "mēnešu";
}

/** Saīsinātās vienības «Reģistrācija Latvijā» kartītei katrā atskaites valodā (26.11: EN bija «1 g. 5 mo.»). */
const TENURE_UNITS: Record<ClientReportLang, { y: string; m: string; day: (n: number) => string }> = {
  lv: { y: "g.", m: "mēn.", day: (n) => lvDienaLabel(n) },
  en: { y: "yr", m: "mo", day: (n) => (n === 1 ? "day" : "days") },
  ru: { y: "г.", m: "мес.", day: () => "дн." },
  de: { y: "J.", m: "Mon.", day: (n) => (n === 1 ? "Tag" : "Tage") },
};

/**
 * Kartītes «Reģistrācija Latvijā» vērtība (Nils 25.11): līdz 1 mēn. - «N dienas», tālāk «5 mēn.», «1 g. 3 mēn.», «2 g.».
 * Ar `lang` - uzreiz atskaites valodā: EN «1 yr 5 mo», RU «1 г. 5 мес.», DE «1 J. 5 Mon.».
 */
/** Kartītes vērtība, ja precīza LV reģistrācijas datuma nav un agrākais LV ieraksts ir šodien. */
export const LATVIA_TENURE_NO_EXACT_DATE: Record<ClientReportLang, string> = {
  lv: "Nav precīza datuma",
  en: "No exact date",
  ru: "Нет точной даты",
  de: "Kein genaues Datum",
};

export function formatLatviaTenureShort(days: number, months: number, lang: ClientReportLang = "lv"): string {
  const u = TENURE_UNITS[lang] ?? TENURE_UNITS.lv;
  const d = Math.max(0, Math.floor(days));
  const mo = Math.max(0, Math.floor(months));
  if (mo < 1) return `${d} ${u.day(d)}`;
  const y = Math.floor(mo / 12);
  const m = mo % 12;
  if (y === 0) return `${m} ${u.m}`;
  return m === 0 ? `${y} ${u.y}` : `${y} ${u.y} ${m} ${u.m}`;
}

/**
 * Tikai reģistra notikumi (CSDD, LTAB pēc LV numura). Sludinājumi, dīlera serviss un
 * CarVertical/AutoDNA rindas ar valsti „Latvija” NAV reģistrācija Latvijā.
 * Ja CSDD ir „Pirmā reģistrācija Latvijā” - tas ir precīzais sākuma datums.
 */
function collectLatviaFixedDates(input: LatviaRegistrationTenureInput): DateCandidate[] {
  const out: DateCandidate[] = [];
  const csdd = input.csddForm;

  const firstLv = csdd?.firstRegistrationLatvia?.trim() ?? "";
  if (firstLv) pushCandidate(out, firstLv, "CSDD");
  if (out.length > 0) return out;

  const firstLvEvent = ownerFirstRegistrationInLatvia(csdd?.ownerRegistrationEvents);
  if (firstLvEvent) pushCandidate(out, firstLvEvent.date, "CSDD");
  if (out.length > 0) return out;

  for (const e of csdd?.ownerRegistrationEvents ?? []) {
    pushCandidate(out, e.date, "CSDD");
  }

  for (const r of csdd?.mileageHistory ?? []) {
    if (!csddMileageRowHasData(r)) continue;
    if (isLatviaCountryName(r.country)) pushCandidate(out, r.date, "CSDD");
  }

  for (const r of input.manualLtabBlock?.rows ?? []) {
    if (!ltabRowHasData(r)) continue;
    pushCandidate(out, r.csngDate, "LTAB");
  }

  // LTAB izziņa meklē pēc LV numura: OCTA perioda sākums ir LV signāls (agrāks par šodienas apskati).
  const insuredFrom = input.manualLtabBlock?.certificate?.insuredFrom?.trim() ?? "";
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(insuredFrom) || /^\d{4}-\d{2}-\d{2}$/.test(insuredFrom)) {
    pushCandidate(out, insuredFrom, "LTAB");
  }

  return out;
}

function hasExactLatviaRegistrationDate(csdd: CsddFormFields | null | undefined): boolean {
  if (csdd?.firstRegistrationLatvia?.trim()) return true;
  if (ownerFirstRegistrationInLatvia(csdd?.ownerRegistrationEvents)) return true;
  return (csdd?.ownerRegistrationEvents ?? []).some((e) => Boolean(e.date?.trim()));
}

/** Aprēķina reģistrācijas ilgumu Latvijā; `null`, ja nav datu. */
export function computeLatviaRegistrationTenure(
  input: LatviaRegistrationTenureInput,
): LatviaRegistrationTenure | null {
  // „nav reģistrēts” - Latvijā nereģistrētam auto reģistrācijas ilgumu nerēķina (citādi „0 dienas”).
  if (isCsddNotRegisteredStatus(input.csddForm?.registrationStatus ?? "")) return null;
  const candidates = collectLatviaFixedDates(input);
  if (candidates.length === 0) return null;

  const oldest = candidates.reduce((a, b) => (a.sortable <= b.sortable ? a : b));
  const ref = input.referenceDate ?? new Date();
  const days = daysBetweenUtc(oldest.sortable, ref.getTime());
  const months = monthsBetweenUtc(oldest.sortable, ref.getTime());
  const firstDateDisplay = formatDisplayDate(oldest.dateRaw);
  const usedSources = [...new Set(candidates.map((c) => c.source))];

  const exact = hasExactLatviaRegistrationDate(input.csddForm);
  const sentence =
    !exact && days === 0
      ? `Precīzs reģistrācijas datums Latvijā nav zināms; agrākais Latvijas ieraksts ir ${firstDateDisplay}.`
      : `Saskaņā ar mūsu rīcībā esošajiem datiem transportlīdzeklis Latvijā ir reģistrēts ${days} ${lvDienaLabel(days)} (${months} ${lvMenesisForm(months)}).`;

  return {
    firstDateDisplay,
    daysRegistered: days,
    monthsRegistered: months,
    sentence,
    sourceLabels: usedSources,
    exact,
  };
}
