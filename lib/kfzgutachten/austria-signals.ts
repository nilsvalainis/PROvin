/**
 * Austrijas pazīmes VIN SCAN rezultātos (26.11, Nils: «Austrijas dati netika automātiski aizpildīti un pārbaudīti»).
 *
 * 26.11 vēlāk: kfzgutachten.at sarakstu relejs mēģina nolasīt VISIEM auto ar VIN + precīzu 1. reģ. datumu
 * (servera Chrome, reCAPTCHA neapiet). Ja neizdodas - «nav pārbaudīts» + saite ar VIN + datumu (+ pasūtījumu
 * Tampermonkey tiltam); Austrijas pazīmes (CSDD iepriekšējā valsts, vēsture, izsole) to iekrāso SARKANI.
 * Tīras funkcijas (bez tīkla) - tās pašas Ātrajā pārbaudē, pasūtījumā, manuālajā pasūtījumā un Ātrajos vērtējumos.
 */

import { kfzAtCountLv } from "@/lib/kfzgutachten/kfz-at-result";
import { KFZ_AT_GUTACHTEN_PRICE_EUR, kfzExactDateDdMmYyyy, kfzgutachtenSearchUrl } from "@/lib/kfzgutachten/kfzgutachten";

export const KFZ_AT_ROW_ID = "kfz_at";

type RowLike = {
  id: string;
  status: string;
  summary?: string;
  detail?: string;
  openUrl?: string | null;
  flags?: { registrationCountry?: string; countries?: readonly string[] } | null;
  auctions?: readonly { title?: string; venue?: string }[] | null;
  inspections?: readonly { date?: string }[] | null;
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
  /** Saraksts jau ielasīts pasūtījumā vai automātiski atrasts. */
  done: boolean;
  /** Automātiskās pārbaudes rezultāts: found / none / "" (nav pārbaudīts). */
  checked: "found" | "none" | "";
  /** Atzinumu (apskašu) skaits. */
  count: number;
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
  const listed = input.listed ?? 0;
  const austria = signals.length > 0;
  // 26.11: automātiskā pārbaude visiem auto ar VIN + 1. reģ. datumu (releja Chrome).
  const found = row?.status === "found" ? (row.inspections ?? []).filter((i) => i.date) : [];
  if (found.length > 0) {
    return {
      signals,
      date,
      url,
      status: kfzAtCountLv(found.length),
      detail: `${row?.summary ?? ""}${listed > 0 ? " · ielasīts pasūtījumā" : ""}`.trim(),
      risk: false,
      done: true,
      checked: "found",
      count: found.length,
    };
  }
  if (listed > 0) {
    return { signals, date, url, status: `${listed} apskates ielasītas`, detail: "", risk: false, done: true, checked: "", count: listed };
  }
  if (row?.status === "none") {
    return { signals, date, url, status: "nav ierakstu", detail: date ? `ar 1. reģ. ${date}` : "", risk: false, done: false, checked: "none", count: 0 };
  }
  if (!date) {
    return {
      signals,
      date,
      url,
      status: "nav pārbaudīts",
      detail: `${austria ? `${signals.join(", ")} · ` : ""}nav precīza 1. reģ. datuma (TT.MM.GGGG) - ievadi Citi avoti «Austrija»`,
      risk: austria,
      done: false,
      checked: "",
      count: 0,
    };
  }
  const reason = /nav pārbaudīts\s*\(([^)]*)\)/.exec(row?.summary ?? "")?.[1] ?? "";
  return {
    signals,
    date,
    url,
    status: "nav pārbaudīts",
    detail: `${austria ? `${signals.join(", ")} · ` : ""}${reason ? `${reason} - ` : ""}izmanto pārlūka joslu`,
    risk: austria,
    done: false,
    checked: "",
    count: 0,
  };
}

/** Push ziņas rinda pēc apmaksas: atrastie atzinumi vienmēr; nepārbaudīts - tikai, ja ir Austrijas pazīmes. */
export function kfzAtPushLine(state: KfzAtViewState): string {
  if (state.checked === "found" && state.count > 0) {
    return `Austrija §57a: ${kfzAtCountLv(state.count)} (atzinumus pērc pats, ${KFZ_AT_GUTACHTEN_PRICE_EUR} gab.)`;
  }
  if (!state.signals.length || state.done || state.checked === "none") return "";
  return state.date ? "Austrija §57a: nav pārbaudīts - atver sarakstu pasūtījumā" : "Austrija §57a: vajag precīzu 1. reģ. datumu";
}
