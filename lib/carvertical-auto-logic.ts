/**
 * CarVertical fona pirkums - tīrā loģika (bez tīkla / krātuves), testējama.
 */
import {
  CARVERTICAL_BALANCE_TTL_MS,
  CARVERTICAL_LOW_CREDITS,
  CARVERTICAL_STATE_LABEL_LV,
  isCarverticalAutoActive,
  type CarverticalAutoState,
  type CarverticalAutoStatus,
  type CarverticalBalance,
} from "@/lib/carvertical-auto-types";

export type CarverticalRelayJobState =
  | "queued"
  | "running"
  | "awaiting_login"
  | "checking"
  | "purchasing"
  | "waiting_report"
  | "downloading"
  | "result"
  | "error";

export type CarverticalRelayJobEvent = {
  kind: "job";
  jobId: string;
  ref: string;
  vin: string;
  jobKind: "purchase" | "report";
  state: CarverticalRelayJobState;
  at?: string;
  code?: string;
  message?: string;
  reportId?: string;
  existing?: boolean;
  credits?: number;
  /** Rezultāta PDF izmērs; pats PDF tiek paņemts no releja `GET /jobs/:id/pdf`. */
  pdfSize?: number;
  /** Tikai testiem / maziem failiem: PDF tieši notikumā. */
  pdfBase64?: string;
};

export type StartDecision =
  | { start: true }
  | { start: false; reason: "active" | "already_ready" | "same_request"; status: CarverticalAutoStatus };

/**
 * Idempotence: viens pirkums uz pasūtījumu / VIN.
 *  - tas pats `requestId` (dubultklikšķis / atkārtots POST) -> nekas jauns;
 *  - uzdevums jau iet -> nekas jauns;
 *  - šim pasūtījumam šī VIN atskaite jau saņemta -> pirkums netiek sākts (ielādēt var ar "report" bez pirkšanas).
 */
export function decideStart(prev: CarverticalAutoStatus | null, req: { vin: string; kind: "purchase" | "report"; requestId: string }): StartDecision {
  if (!prev) return { start: true };
  if (req.requestId && prev.requestId === req.requestId) return { start: false, reason: "same_request", status: prev };
  if (isCarverticalAutoActive(prev)) return { start: false, reason: "active", status: prev };
  if (req.kind === "purchase" && prev.state === "ready" && prev.vin === req.vin) {
    return { start: false, reason: "already_ready", status: prev };
  }
  return { start: true };
}

const PROGRESS: Partial<Record<CarverticalRelayJobState, CarverticalAutoState>> = {
  queued: "queued",
  running: "checking",
  awaiting_login: "awaiting_login",
  checking: "checking",
  purchasing: "purchasing",
  waiting_report: "waiting_report",
  downloading: "downloading",
};

export const CARVERTICAL_ERROR_LV: Record<string, string> = {
  insufficient_credits: "CarVertical kontā nav kredītu - papildini kontu",
  balance_unknown: "Kredītu atlikumu neizdevās nolasīt - nepirku",
  already_purchased: "Šis VIN jau tika pirkts, bet atskaite kontā nav redzama - pārbaudi CarVertical (otrreiz nepērku)",
  not_found: "Šim VIN kontā atskaites nav",
  login_timeout: "CarVertical pieteikšanās kods netika ievadīts",
  captcha: "CarVertical prasa captcha - ielogojies pats",
  bad_credentials: "CarVertical neņēma paroli - pārbaudi 1Password ierakstu",
  no_credit_link: "CarVertical nepiedāvāja kredītu - pērc ar roku",
  no_credit_path: "CarVertical piedāvāja tikai apmaksu ar karti - nepirku",
  vin_confirm_needed: "CarVertical prasa apstiprināt VIN - pērc ar roku",
  report_timeout: "Atskaite vēl top - nospied \"Ielādēt nopirkto\" vēlāk",
  existing_report: "CarVertical rāda, ka atskaite jau ir - nospied \"Ielādēt nopirkto\"",
};

/** Releja progresa notikums -> stāvoklis (rezultātu apstrādā atsevišķi). */
export function reduceCarverticalProgress(prev: CarverticalAutoStatus | null, ev: CarverticalRelayJobEvent, now: string): CarverticalAutoStatus {
  const base: CarverticalAutoStatus = { ...(prev ?? { state: "queued", updatedAt: now }), vin: ev.vin || prev?.vin, jobId: ev.jobId, updatedAt: now };
  if (ev.state === "error") {
    const code = (ev.code ?? "error").slice(0, 60);
    return { ...base, state: "error", code, message: CARVERTICAL_ERROR_LV[code] ?? ev.message?.slice(0, 200) ?? "CarVertical kļūda" };
  }
  const state = PROGRESS[ev.state] ?? base.state;
  return { ...base, state, message: CARVERTICAL_STATE_LABEL_LV[state], ...(ev.reportId ? { reportId: ev.reportId } : {}) };
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

/** Rīgas kalendārā diena (YYYY-MM-DD). */
export function rigaDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function isLowCredits(credits: number | null | undefined): boolean {
  return typeof credits === "number" && credits < CARVERTICAL_LOW_CREDITS;
}

export function balanceIsStale(b: CarverticalBalance | null, now: Date): boolean {
  if (!b || !b.checkedAt) return true;
  const t = Date.parse(b.checkedAt);
  return !Number.isFinite(t) || now.getTime() - t >= CARVERTICAL_BALANCE_TTL_MS;
}

/**
 * Jauns atlikums -> ko saglabāt un vai sūtīt push (atlikums < 5, ne biežāk kā vienreiz Rīgas dienā).
 */
export function applyBalanceUpdate(
  prev: CarverticalBalance | null,
  credits: number,
  now: Date,
  checkedAt?: string,
): { next: CarverticalBalance; push: boolean } {
  const day = rigaDay(now);
  const low = isLowCredits(credits);
  const push = low && prev?.lowPushDay !== day;
  const at = checkedAt && Number.isFinite(Date.parse(checkedAt)) ? new Date(checkedAt).toISOString() : now.toISOString();
  return {
    next: { credits, checkedAt: at, ...(push ? { lowPushDay: day } : prev?.lowPushDay ? { lowPushDay: prev.lowPushDay } : {}) },
    push,
  };
}

/** Pēc saņemšanas dati blokā tiek ievietoti automātiski vienreiz (sapludina, ar roku labotu nepārraksta). */
export function carverticalAutoCanApply(s: CarverticalAutoStatus | null): boolean {
  return Boolean(s && s.state === "ready" && s.pdf && !s.appliedAt);
}

export function carverticalPdfFileName(vin: string): string {
  const v = String(vin ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
  return `CarVertical - ${v || "atskaite"}.pdf`;
}
