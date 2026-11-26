/**
 * Austrijas pazīmes VIN SCAN rezultātos (26.11, Nils: «Austrijas dati netika automātiski aizpildīti un pārbaudīti»).
 *
 * kfzgutachten.at sarakstu serveris nolasīt nevar (Google reCAPTCHA Enterprise, to neapejam) un tam vajag
 * PRECĪZU 1. reģistrācijas datumu. Tāpēc automātika dara visu, ko var bez cilvēka: atrod Austrijas pazīmes,
 * saliek saiti ar VIN + datumu (+ pasūtījumu Tampermonkey tiltam) un SARKANI parāda, kas vēl jāizdara cilvēkam.
 * Tīras funkcijas (bez tīkla) - tās pašas Ātrajā pārbaudē, pasūtījumā, manuālajā pasūtījumā un Ātrajos vērtējumos.
 */

import { kfzExactDateDdMmYyyy, kfzgutachtenSearchUrl } from "@/lib/kfzgutachten/kfzgutachten";

export const KFZ_AT_ROW_ID = "kfz_at";

type RowLike = {
  id: string;
  status: string;
  summary?: string;
  detail?: string;
  openUrl?: string | null;
  flags?: { registrationCountry?: string; countries?: readonly string[] } | null;
  auctions?: readonly { title?: string; venue?: string }[] | null;
};

const AT_TEXT_RE = /austrij|\baustria|österreich|oesterreich/i;
const AT_CODE_RE = /^(?:at|aut)$/i;

function isAtCountry(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  return AT_CODE_RE.test(t) || AT_TEXT_RE.test(t);
}

function isAtListing(url: string | null | undefined): boolean {
  const raw = (url ?? "").trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host.endsWith(".at") || host.includes("willhaben");
  } catch {
    return false;
  }
}

/** Kāpēc auto varētu būt bijis Austrijā (īsi latviski). Tukšs - pazīmju nav. */
export function vinScanAustriaSignals(input: {
  rows: readonly RowLike[];
  /** CSDD «Iepriekšējā reģistrācijas valsts» (piem. «AUSTRIJA»). */
  previousCountry?: string | null;
  listingUrl?: string | null;
}): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };
  if (isAtCountry(input.previousCountry)) add("CSDD iepriekšējā valsts Austrija");
  if (isAtListing(input.listingUrl)) add("sludinājums Austrijā");
  for (const row of input.rows) {
    if (row.id === KFZ_AT_ROW_ID || row.status !== "found") continue;
    const f = row.flags;
    if (isAtCountry(f?.registrationCountry) || (f?.countries ?? []).some((c) => isAtCountry(c))) {
      add("vēsturē Austrija");
      continue;
    }
    if ((row.auctions ?? []).some((a) => AT_TEXT_RE.test(`${a.venue ?? ""} ${a.title ?? ""}`))) {
      add("izsole Austrijā");
      continue;
    }
    if (AT_TEXT_RE.test(`${row.summary ?? ""} ${row.detail ?? ""}`)) add("vēsturē Austrija");
  }
  return out;
}

export type KfzAtViewState = {
  /** Austrijas pazīmes (tukšs - auto, visticamāk, nav bijis Austrijā). */
  signals: string[];
  /** DD.MM.YYYY vai "". */
  date: string;
  url: string;
  /** Īss statuss rindai. */
  status: string;
  /** Kāpēc automātiski nevar (rāda zem nosaukuma). */
  detail: string;
  /** Sarkans: Austrijas auto, bet saraksts vēl nav ielasīts. */
  risk: boolean;
  /** Saraksts jau ielasīts pasūtījumā. */
  done: boolean;
};

/**
 * kfz_at rindas stāvoklis visās VIN SCAN vietās. Datums: pasūtījuma bloki -> CSDD API -> rindas saite.
 * Nekādu pirkumu: saraksts ir bez maksas, atzinumi (1,19 €) - tikai ar Nila roku.
 */
export function kfzAtViewState(input: {
  vin: string;
  rows: readonly RowLike[];
  previousCountry?: string | null;
  listingUrl?: string | null;
  /** Precīzs datums no pasūtījuma blokiem (resolveKfzFirstRegistration). */
  firstRegDate?: string | null;
  /** CSDD API `firstRegistrationIso` (Ātrā pārbaude). */
  csddFirstRegIso?: string | null;
  /** Pasūtījuma sessionId - Tampermonkey nosūta sarakstu atpakaļ šim pasūtījumam. */
  orderId?: string | null;
  /** Cik apskates jau ielasītas pasūtījumā (Citi avoti «Austrija»). */
  listed?: number;
}): KfzAtViewState {
  const signals = vinScanAustriaSignals(input);
  const row = input.rows.find((r) => r.id === KFZ_AT_ROW_ID);
  let rowUrl = row?.openUrl ?? "";
  try {
    rowUrl = decodeURIComponent(rowUrl);
  } catch {
    /* saite paliek kā ir */
  }
  const fromRow = /[?&]date=([0-9.]{10})/.exec(rowUrl)?.[1] ?? "";
  const date =
    kfzExactDateDdMmYyyy(input.firstRegDate) || kfzExactDateDdMmYyyy(input.csddFirstRegIso) || kfzExactDateDdMmYyyy(fromRow);
  const url = kfzgutachtenSearchUrl(input.vin, date, input.orderId);
  const done = (input.listed ?? 0) > 0;
  if (done) return { signals, date, url, status: `${input.listed} apskates ielasītas`, detail: "", risk: false, done };
  const austria = signals.length > 0;
  if (!date) {
    return {
      signals,
      date,
      url,
      status: "vajag 1. reģ. datumu",
      detail: austria
        ? `${signals.join(", ")} · automātiski nevar: nav precīza 1. reģ. datuma (TT.MM.GGGG) - ievadi Citi avoti «Austrija»`
        : "",
      risk: austria,
      done,
    };
  }
  return {
    signals,
    date,
    url,
    status: "atver sarakstu",
    detail: austria
      ? `${signals.join(", ")} · automātiski nevar: reCAPTCHA - atver sarakstu un nospied «Suchen»`
      : "bez maksas, tikai pārlūkā (reCAPTCHA)",
    risk: austria,
    done,
  };
}

/** Push ziņas rinda pēc apmaksas (tikai, ja ir Austrijas pazīmes). */
export function kfzAtPushLine(state: KfzAtViewState): string {
  if (!state.signals.length || state.done) return "";
  return state.date
    ? "Austrija §57a: atver sarakstu pasūtījumā (reCAPTCHA - tikai pārlūkā)"
    : "Austrija §57a: vajag precīzu 1. reģ. datumu";
}
