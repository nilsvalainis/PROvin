/**
 * AutoDNA fona pirkums - tīrā loģika (bez tīkla / krātuves), testējama.
 * Atlikuma noteikumi (< 5 sarkans, viens push Rīgas dienā, kešs 30 min) ir tie paši kā CarVertical.
 */
import { applyBalanceUpdate, balanceIsStale, isLowCredits, isPdfBytes, rigaDay } from "@/lib/carvertical-auto-logic";
import {
  AUTODNA_STATE_LABEL_LV,
  isAutodnaAutoActive,
  type AutodnaAutoPrecheck,
  type AutodnaAutoState,
  type AutodnaAutoStatus,
} from "@/lib/autodna-auto-types";

export { applyBalanceUpdate, balanceIsStale, isLowCredits, isPdfBytes, rigaDay };

export type AutodnaRelayJobState =
  | "queued"
  | "running"
  | "awaiting_login"
  | "checking"
  | "purchasing"
  | "waiting_report"
  | "downloading"
  | "result"
  | "error";

export type AutodnaRelayJobEvent = {
  kind: "job";
  jobId: string;
  ref: string;
  vin: string;
  jobKind: "purchase" | "report";
  state: AutodnaRelayJobState;
  at?: string;
  code?: string;
  message?: string;
  existing?: boolean;
  credits?: number;
  /** Rezultāta PDF izmērs; pats PDF tiek paņemts no releja `GET /jobs/:id/pdf`. */
  pdfSize?: number;
  /** Tikai testiem / maziem failiem: PDF tieši notikumā. */
  pdfBase64?: string;
  /** Releja priekšpārbaudes skaitļi (arhīva foto / vēsture). */
  precheck?: AutodnaAutoPrecheck;
};

export type AutodnaStartDecision =
  | { start: true }
  | { start: false; reason: "active" | "already_ready" | "same_request"; status: AutodnaAutoStatus };

/**
 * Idempotence: viens pirkums uz pasūtījumu / VIN.
 *  - tas pats `requestId` (dubultklikšķis / atkārtots POST) -> nekas jauns;
 *  - uzdevums jau iet -> nekas jauns;
 *  - šim pasūtījumam šī VIN atskaite jau saņemta -> pirkums netiek sākts (ielādēt var ar "report" bez pirkšanas).
 */
export function decideAutodnaStart(
  prev: AutodnaAutoStatus | null,
  req: { vin: string; kind: "purchase" | "report"; requestId: string },
): AutodnaStartDecision {
  if (!prev) return { start: true };
  if (req.requestId && prev.requestId === req.requestId) return { start: false, reason: "same_request", status: prev };
  if (isAutodnaAutoActive(prev)) return { start: false, reason: "active", status: prev };
  if (req.kind === "purchase" && prev.state === "ready" && prev.vin === req.vin) return { start: false, reason: "already_ready", status: prev };
  return { start: true };
}

const PROGRESS: Partial<Record<AutodnaRelayJobState, AutodnaAutoState>> = {
  queued: "queued",
  running: "checking",
  awaiting_login: "awaiting_login",
  checking: "checking",
  purchasing: "purchasing",
  waiting_report: "waiting_report",
  downloading: "downloading",
};

export const AUTODNA_ERROR_LV: Record<string, string> = {
  insufficient_credits: "AutoDNA kontā nav kredītu - papildini kontu",
  balance_unknown: "Kredītu atlikumu neizdevās nolasīt - nepirku",
  already_purchased: "Šis VIN jau tika pirkts, bet AutoDNA to nerāda kā nopirktu - pārbaudi AutoDNA kontā (otrreiz nepērku)",
  not_found: "Šim VIN AutoDNA kontā atskaites nav",
  login_timeout: "AutoDNA pieteikšanās neizdevās laikā",
  bad_credentials: "AutoDNA neņēma paroli - jāiestata parole (Aizmirsi paroli?) un jāieliek 1Password",
  captcha: "AutoDNA prasa captcha pieteikšanās brīdī - ielogojies pats",
  login_code: "AutoDNA prasa kodu pieteikšanās brīdī",
  login_page_changed: "AutoDNA pieteikšanās lapa mainījusies",
  login_unknown: "AutoDNA pieteikšanās neizdevās",
  turnstile: "AutoDNA prasa apstiprināt, ka esi cilvēks - atver AutoDNA saiti savā pārlūkā, apstiprini un spied vēlreiz",
  pending: "AutoDNA priekšpārbaude vēl nav gatava - mēģini pēc brīža",
  no_credit_option: "AutoDNA nepiedāvāja apmaksu ar kredītiem - pērc ar roku",
  credit_disabled: "AutoDNA kredītu apmaksa šim produktam nav pieejama - pērc ar roku",
  credit_not_selected: "Neizdevās izvēlēties apmaksu ar kredītiem - nepirku",
  pay_button_unclear: "AutoDNA pirkuma lapa izskatās citādi - pērc ar roku",
  vin_mismatch: "AutoDNA lapā cits VIN - nepirku",
  invalid_vin: "AutoDNA neatzīst šo VIN",
  dry_run: "Pirkuma solis pārbaudīts, bet tiešais pirkums vēl nav ieslēgts - pērc ar roku",
  purchase_unconfirmed: "Poga nospiesta, bet pirkums nav apstiprināts - pārbaudi AutoDNA kontā (otrreiz nepērku)",
  pay_click_failed: "AutoDNA pirkuma poga neizdevās - pērc ar roku",
  report_timeout: "Atskaite vēl top - nospied \"Ielādēt nopirkto\" vēlāk",
  precheck_no_records: "Pirkt nedrīkst - AutoDNA nav foto un vēstures ierakstu",
  precheck_unavailable: "Priekšpārbaude nav pieejama - atver AutoDNA saiti, pagaidi, kamēr ielādējas, tad spied vēlreiz",
};

/** Kļūdas, par kurām Nilam vajag push (vajag viņa rīcību). */
export const AUTODNA_PUSH_ERRORS = new Set(["turnstile", "bad_credentials", "captcha", "login_code", "purchase_unconfirmed", "insufficient_credits"]);

/** Releja progresa notikums -> stāvoklis (rezultātu apstrādā atsevišķi). */
export function reduceAutodnaProgress(prev: AutodnaAutoStatus | null, ev: AutodnaRelayJobEvent, now: string): AutodnaAutoStatus {
  const base: AutodnaAutoStatus = {
    ...(prev ?? { state: "queued", updatedAt: now }),
    vin: ev.vin || prev?.vin,
    jobId: ev.jobId,
    updatedAt: now,
    ...(ev.precheck ? { precheck: { ...ev.precheck, checkedAt: ev.at || now } } : {}),
  };
  if (ev.state === "error") {
    const code = (ev.code ?? "error").slice(0, 60);
    return { ...base, state: "error", code, message: AUTODNA_ERROR_LV[code] ?? ev.message?.slice(0, 200) ?? "AutoDNA kļūda" };
  }
  const state = PROGRESS[ev.state] ?? base.state;
  return { ...base, state, message: AUTODNA_STATE_LABEL_LV[state] };
}

/** Pēc saņemšanas dati blokā tiek ievietoti automātiski vienreiz (sapludina, ar roku labotu nepārraksta). */
export function autodnaAutoCanApply(s: AutodnaAutoStatus | null): boolean {
  return Boolean(s && s.state === "ready" && s.pdf && !s.appliedAt);
}

export function autodnaPdfFileName(vin: string): string {
  const v = String(vin ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
  return `AutoDNA - ${v || "atskaite"}.pdf`;
}

/** Turnstile gadījumā Nils atver šo saiti savā pārlūkā (priekšpārbaude AutoDNA pusē tad ir gatava). */
export function autodnaVinPageUrl(vin: string): string {
  return `https://www.autodna.lv/vin/${encodeURIComponent(String(vin ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17))}`;
}
