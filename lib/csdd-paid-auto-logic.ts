import { isEcsddPlate } from "@/lib/ecsdd-paid-logic";
import { isValidPlateNumber, normalizePlateNumber } from "@/lib/order-field-validation";

/**
 * Automātiskā CSDD maksas izziņa (1,50 €) apmaksātam AUDITS pasūtījumam - tīrā loģika (testējama bez servera).
 *
 * Plūsma: queued -> (e.csdd sesija aktīva, diena, zem griestiem) sms-link + "Sūtīt automātiski" e-pasts -> sms_sent
 * -> ik 30 s paid-report līdz 30 min -> found (ielasīts CSDD blokā) | awaiting_payment ("gaida apmaksu", SMS vairs nesūta).
 * Viena SMS uz pasūtījumu: `smsStartedAt` tiek ierakstīts PIRMS e-pasta, tāpēc pēc kļūmes SMS netiek sūtīta otrreiz.
 */

export type CsddPaidAutoState =
  /** Gaida nākamo soli (arī naktī, pēc dienas griestiem, kamēr e.csdd sesija nav aktīva). */
  | "queued"
  /** SMS e-pasts Īsceļam nosūtīts; gaida apmaksāto izziņu. */
  | "sms_sent"
  /** Izziņa saņemta. `appliedAt` - ielasīta CSDD blokā. */
  | "found"
  /** 30 min pagāja bez izziņas: "gaida apmaksu" (SMS otrreiz nesūta). */
  | "awaiting_payment"
  /** Gala kļūda (numurs e.csdd nav atrasts, nav pogas, nav konfigurēts u.c.). */
  | "error";

export type CsddPaidAutoDefer = "night" | "daily_cap" | "login" | "retry";

export type CsddPaidAutoJob = {
  sessionId: string;
  plate: string;
  state: CsddPaidAutoState;
  createdAt: string;
  updatedAt: string;
  /** Agrākais brīdis nākamajam solim (queued). */
  nextAttemptAt?: string;
  deferReason?: CsddPaidAutoDefer;
  /** Kad sākta SMS sūtīšana (ierakstīts pirms e-pasta) - no šī brīža SMS vairs nekad nesūta. */
  smsStartedAt?: string;
  smsSentAt?: string;
  /** Gaidīšanas loga sākums (SMS vai admina "Pārbaudīt vēlreiz"). */
  pollStartedAt?: string;
  lastPollAt?: string;
  polls?: number;
  foundAt?: string;
  paidAt?: string;
  /** Izziņas teksts (CSDD formāts) - ja ielasīšana blokā neizdevās, admin to ievieto pats. */
  rawText?: string;
  appliedAt?: string;
  /** Relejs nospieda "Nosūtīt uz reģistrēto epastu" (PDF arhīvam). */
  pdfEmailAt?: string;
  /** PDF saņemts no info@provin.lv (Apps Script) un saglabāts Dropbox. */
  pdfReceivedAt?: string;
  pdfPath?: string;
  /** Push Nilam par e.csdd sesiju (viens uz darbu). */
  loginPushAt?: string;
  attempts?: number;
  /** Īsa kļūda vai iemesls (adminam). */
  error?: string;
  /** Īslaicīga noma pret paralēlu palaišanu (webhook + cron). */
  leaseId?: string;
  leaseUntil?: string;
};

export const CSDD_PAID_POLL_INTERVAL_MS = 30_000;
export const CSDD_PAID_POLL_TOTAL_MS = 30 * 60_000;
export const CSDD_PAID_LEASE_MS = 2 * 60_000;
export const CSDD_PAID_MAX_ATTEMPTS = 3;
export const CSDD_PAID_RETRY_MS = 5 * 60_000;
/** Cik ilgi gaidīt e.csdd sesiju, pirms darbs kļūst par kļūdu (rīts + darba diena). */
export const CSDD_PAID_LOGIN_WAIT_MS = 24 * 60 * 60_000;

/** `CSDD_PAID_AUTO_ENABLED` - noklusējums izslēgts. */
export function csddPaidAutoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return /^(1|true|yes|on)$/i.test((env.CSDD_PAID_AUTO_ENABLED ?? "").trim());
}

/** `CSDD_PAID_AUTO_DAILY_MAX` - noklusējums 10, 0 = neviena. */
export function csddPaidAutoDailyMax(env: Record<string, string | undefined> = process.env): number {
  const raw = (env.CSDD_PAID_AUTO_DAILY_MAX ?? "").trim();
  if (!raw) return 10;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 200) : 10;
}

/**
 * Tikai PROVIN AUDITS (`checkout_line` audit/premium; vecās sesijas bez lauka = audit). NE dīlera dati, NE MINI,
 * NE Business, NE SELECT, NE B2B paka / maks / Telegram / augšpārdošana.
 */
export function csddPaidAutoProductEligible(args: {
  checkoutLine?: string | null;
  fulfillment?: string | null;
  isDealerData?: boolean;
  isTelegram?: boolean;
}): boolean {
  // Parasts pasūtījums vai klienta saite; B2B paka / maks / augšpārdošana / manuālā maksājuma saite - nē.
  if (!["", "client_link", "business_link"].includes((args.fulfillment ?? "").trim().toLowerCase())) return false;
  if (args.isDealerData || args.isTelegram) return false;
  const line = (args.checkoutLine ?? "").trim().toLowerCase();
  return line === "audit" || line === "premium" || line === "audits";
}

/**
 * LV numurzīme maksas izziņai (e.csdd tikai LV reģistrētiem auto). CSDD reģistra numurs (API atrada = LV) var būt arī
 * personalizēts; klienta ievadītam numuram jāatbilst LV formātam (2-3 burti + cipari).
 */
export function csddPaidAutoPlate(args: { registryPlate?: string | null; enteredPlates?: Array<string | null | undefined> }): string | null {
  const reg = normalizePlateNumber(args.registryPlate ?? "");
  if (reg && isEcsddPlate(reg)) return reg;
  for (const raw of args.enteredPlates ?? []) {
    const p = normalizePlateNumber(raw ?? "");
    if (p && isValidPlateNumber(p)) return p;
  }
  return null;
}

function rigaMinutes(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Riga", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(
    new Date(ms),
  );
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (h % 24) * 60 + m;
}

/** Nakts Rīgā 23:00-07:30: SMS nesūta (atliek uz rītu). */
export function isRigaNight(ms: number): boolean {
  const min = rigaMinutes(ms);
  return min >= 23 * 60 || min < 7 * 60 + 30;
}

/** Nākamais brīdis, kad Rīgā vairs nav nakts (07:30), minūtes precizitātē; DST droši. */
export function nextRigaMorning(ms: number): number {
  let t = Math.ceil(ms / 60_000) * 60_000;
  for (let i = 0; i < 24 * 12 && isRigaNight(t); i++) t += 5 * 60_000;
  // Precīzi uz pirmo dienas minūti (atpakaļ līdz 4 min).
  for (let i = 0; i < 4 && !isRigaNight(t - 60_000); i++) t -= 60_000;
  return t;
}

/** Rīgas kalendārā diena "YYYY-MM-DD" (dienas griestiem). */
export function rigaDayKey(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    new Date(ms),
  );
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** Nākamās Rīgas dienas rīts (pēc griestiem). */
export function nextRigaDayMorning(ms: number): number {
  const today = rigaDayKey(ms);
  let t = ms;
  for (let i = 0; i < 30 && rigaDayKey(t) === today; i++) t += 60 * 60_000;
  return nextRigaMorning(t);
}

const ms = (iso?: string) => {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : 0;
};

export type CsddPaidAutoAction =
  | { kind: "none" }
  | { kind: "wait"; until: number }
  | { kind: "defer"; reason: "night" | "daily_cap"; until: number }
  | { kind: "request_sms" }
  | { kind: "poll" }
  | { kind: "expire" }
  | { kind: "apply" };

/** Ko darīt ar darbu tagad. `dailyCount` - šodien jau sāktās SMS. */
export function decideCsddPaidAutoAction(job: CsddPaidAutoJob, now: number, opts: { dailyCount: number; dailyMax: number }): CsddPaidAutoAction {
  if (ms(job.leaseUntil) > now) return { kind: "wait", until: ms(job.leaseUntil) };
  switch (job.state) {
    case "queued": {
      // Pēc kļūmes SMS sūtīšanas vidū: nekad nesūta otrreiz, tikai gaida izziņu.
      if (job.smsStartedAt) return { kind: "poll" };
      if (ms(job.nextAttemptAt) > now) return { kind: "wait", until: ms(job.nextAttemptAt) };
      if (isRigaNight(now)) return { kind: "defer", reason: "night", until: nextRigaMorning(now) };
      if (opts.dailyCount >= opts.dailyMax) return { kind: "defer", reason: "daily_cap", until: nextRigaDayMorning(now) };
      return { kind: "request_sms" };
    }
    case "sms_sent": {
      const start = ms(job.pollStartedAt) || ms(job.smsSentAt) || ms(job.smsStartedAt);
      if (now - start > CSDD_PAID_POLL_TOTAL_MS) return { kind: "expire" };
      const next = ms(job.lastPollAt) + CSDD_PAID_POLL_INTERVAL_MS;
      return next > now ? { kind: "wait", until: next } : { kind: "poll" };
    }
    case "found":
      return job.appliedAt || !job.rawText ? { kind: "none" } : { kind: "apply" };
    default:
      return { kind: "none" };
  }
}

/** Vai darbs vēl jātur cron indeksā. */
export function csddPaidAutoJobOpen(job: CsddPaidAutoJob): boolean {
  if (job.state === "queued" || job.state === "sms_sent") return true;
  return job.state === "found" && !job.appliedAt && Boolean(job.rawText);
}

const STATE_LV: Record<CsddPaidAutoState, string> = {
  queued: "gaida",
  sms_sent: "SMS nosūtīta, gaida izziņu",
  found: "izziņa saņemta",
  awaiting_payment: "gaida apmaksu",
  error: "kļūda",
};

const DEFER_LV: Record<CsddPaidAutoDefer, string> = {
  night: "naktī nesūta - no rīta 07:30",
  daily_cap: "dienas griesti sasniegti - rīt",
  login: "gaida e.csdd pieslēgšanos",
  retry: "atkārtos pēc 5 min",
};

/** Īss statuss adminam. */
export function csddPaidAutoStatusLv(job: CsddPaidAutoJob): string {
  let s = STATE_LV[job.state];
  if (job.state === "queued" && job.deferReason) s = DEFER_LV[job.deferReason];
  if (job.state === "found") s = job.appliedAt ? "izziņa ielasīta CSDD blokā" : "izziņa saņemta, jāievieto";
  return job.error && (job.state === "error" || job.state === "queued") ? `${s} (${job.error})` : s;
}

export function normalizeCsddPaidAutoJob(raw: unknown, sessionId: string): CsddPaidAutoJob | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const states: CsddPaidAutoState[] = ["queued", "sms_sent", "found", "awaiting_payment", "error"];
  const state = states.includes(o.state as CsddPaidAutoState) ? (o.state as CsddPaidAutoState) : null;
  const plate = typeof o.plate === "string" ? normalizePlateNumber(o.plate) : "";
  if (!state || !plate) return null;
  const out: CsddPaidAutoJob = {
    sessionId,
    plate,
    state,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
  };
  const strKeys = [
    "nextAttemptAt",
    "smsStartedAt",
    "smsSentAt",
    "pollStartedAt",
    "lastPollAt",
    "foundAt",
    "paidAt",
    "appliedAt",
    "loginPushAt",
    "pdfEmailAt",
    "pdfReceivedAt",
    "pdfPath",
    "error",
    "leaseId",
    "leaseUntil",
  ] as const;
  for (const k of strKeys) if (typeof o[k] === "string" && o[k]) (out as Record<string, unknown>)[k] = String(o[k]).slice(0, 200);
  if (typeof o.rawText === "string" && o.rawText) out.rawText = o.rawText.slice(0, 80_000);
  if (o.deferReason === "night" || o.deferReason === "daily_cap" || o.deferReason === "login" || o.deferReason === "retry") out.deferReason = o.deferReason;
  if (typeof o.polls === "number" && Number.isFinite(o.polls)) out.polls = o.polls;
  if (typeof o.attempts === "number" && Number.isFinite(o.attempts)) out.attempts = o.attempts;
  return out;
}
