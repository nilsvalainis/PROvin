/**
 * kfzgutachten.at - Austrijas §57a («Pickerl») tehnisko apskašu datubāze (ZBD Verwaltung GmbH).
 *
 * Kā lapa strādā (izpēte 25.11.2026):
 * - Meklēšana bez maksas: 1. reģistrācijas datums (TT.MM.GGGG) + VIN vai Austrijas numurzīme.
 *   Rezultāts - saraksts: marka/tips, atzinuma datums, numurzīme, VIN.
 * - Meklēšanu (`POST /Home/Search`) sargā Google reCAPTCHA Enterprise (neredzamā v3).
 *   Serveris bez īsta pārlūka saraksta nesaņem («Recaptcha validation failed»), tāpēc PROVIN
 *   to neapiet: saite atver lapu ar aizpildītu VIN un datumu, «Suchen» nospiež cilvēks.
 * - Katrs atzinums (Gutachten PDF) ir maksas - 1,19 € gabalā (24.11.2026), pērk Nils ar roku.
 *   Nopirkto PDF ielasa pasūtījumā (nobraukums, trūkumi, numurzīme, nākamā apskate).
 */

export const KFZ_AT_HOME_URL = "https://kfzgutachten.at/";

/** Citi avoti sadaļas nosaukums (arī PDF avotu sarakstā). */
export const KFZ_AT_SECTION_LABEL = "Austrija · §57a apskates (kfzgutachten.at)";

/** Viena atzinuma cena (rēķins 24.11.2026). */
export const KFZ_AT_GUTACHTEN_PRICE_EUR = "1,19 €";

export const KFZ_AT_COUNTRY_LV = "Austrija";

/** DD.MM.YYYY, ja datums ir precīzs (diena + mēnesis + gads) un reāls; citādi "". */
export function kfzExactDateDdMmYyyy(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  let d: number;
  let m: number;
  let y: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(t);
  const dot = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (dot) {
    d = Number(dot[1]);
    m = Number(dot[2]);
    y = Number(dot[3]);
  } else {
    return "";
  }
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

/** true: ir tikai mēnesis/gads (piem. «08.2004», «2004-08», «2004») - dienu neizdomājam. */
export function kfzDateIsPartial(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t || kfzExactDateDdMmYyyy(t)) return false;
  return /^(?:\d{1,2}[./])?\d{4}$|^\d{4}-\d{2}$/.test(t);
}

/**
 * Saite uz meklēšanas formu ar aizpildītu VIN un datumu.
 * Lapas skripts aizpilda formu no `?vin=&date=` (pēc pieteikšanās, ja sesija beigusies).
 * Bez datuma liekam tukšu `date=`, lai lapas skripts nekrīt un VIN tomēr ieliek.
 */
export function kfzgutachtenSearchUrl(vin: string, firstRegDate?: string | null): string {
  const v = vin.trim().toUpperCase();
  if (!v) return KFZ_AT_HOME_URL;
  const date = kfzExactDateDdMmYyyy(firstRegDate);
  return `${KFZ_AT_HOME_URL}?vin=${encodeURIComponent(v)}&date=${encodeURIComponent(date)}`;
}
