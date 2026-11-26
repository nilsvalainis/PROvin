/**
 * Google atsauksmes lūgums - atsevišķs e-pasts pēc atskaites (Nila apstiprinātais makets 26.11.2026, variants A).
 *
 * - 0. diena: atskaite, bez lūguma.
 * - Nākamā diena (Nils 26.11): viens e-pasts ar vienu pogu «Novērtēt Google». Atgādinājuma nav.
 * - Sūta tikai darba dienās 10:00-18:00 pēc Rīgas laika (brīvdienā - pirmajā darba dienā).
 * - Nesūta: B2B, atmaksāts, atcelts, nav e-pasta, adminā «Nelūgt», klientam jau lūgts pēdējās 60 dienās.
 * - Nila lēmums 26.11: sūta TIKAI, ja indikators zaļš (`reviewIndicatorGreen`). Iestatījums ieslēgts pēc noklusējuma,
 *   adminā maināms (dokumenta `settings.onlyGreen`). Nav indikatora = nav zaļš = nesūta.
 *
 * Tīrā loģika (bez I/O): laiks, lēmums, teksti 4 valodās. Glabātuve - `review-ask-store.ts`, cron - `review-ask-cron.ts`.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { GOOGLE_REVIEW_URL } from "@/lib/messages/shared-blocks";
import { isValidOrderEmail, isValidVin, normalizeVin } from "@/lib/order-field-validation";

export { GOOGLE_REVIEW_URL };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ja lūgums nokavēts (piem. cron nestrādāja) un atskaite vecāka par šo - vairs nesūta. */
export const REVIEW_ASK_MAX_AGE_MS = 14 * DAY_MS;
/** Vienam klientam (e-pastam) ne biežāk kā reizi 60 dienās. */
export const REVIEW_CUSTOMER_COOLDOWN_MS = 60 * DAY_MS;
/** Sūtīšanas «aizņemšana»: ja vecāka - uzskata par nosūtītu (labāk nesūtīt nekā sūtīt divreiz). */
export const REVIEW_CLAIM_STALE_MS = 30 * 60 * 1000;
/** Pabeigtus ierakstus rindā tur 30 dienas (pasūtījuma atzīmes paliek pastāvīgi). */
export const REVIEW_DONE_KEEP_MS = 30 * DAY_MS;

/** Darba dienas (P-Pk), 10:00-18:00 Rīgā. */
export const REVIEW_SEND_FROM_HOUR = 10;
export const REVIEW_SEND_TO_HOUR = 18;


export type ReviewAskSkipReason =
  | "opt_out"
  | "b2b"
  | "refunded"
  | "cancelled"
  | "no_email"
  | "recent_other_order"
  | "already_asked"
  | "too_late"
  | "stale_claim"
  | "not_green";

export type ReviewAskEntry = {
  sessionId: string;
  /** Pirmās atskaites nosūtīšanas laiks (atkārtota sūtīšana to nemaina). */
  reportSentAt: string;
  email: string;
  lang: ClientReportLang;
  /** «VW Golf» - no pasūtījuma; nav = «Jūsu auto (VIN …1234)». */
  car?: string;
  vin?: string;
  askedAt?: string;
  /** Sūtīšana sākta (pret dubultsūtīšanu, ja divi cron vienlaikus). */
  claimAt?: string;
  doneAt?: string;
  skip?: ReviewAskSkipReason;
};

export type ReviewAskDoc = {
  version: 1;
  entries: Record<string, ReviewAskEntry>;
  /** Pēdējais lūgums pēc klienta e-pasta (mazie burti) - 60 dienu noteikumam. */
  lastAskByEmail: Record<string, { at: string; sessionId: string }>;
  /** Admina iestatījumi. `onlyGreen` nav = ieslēgts (Nila lēmums 26.11). */
  settings: { onlyGreen?: boolean; updatedAt?: string };
};

export function emptyReviewAskDoc(): ReviewAskDoc {
  return { version: 1, entries: {}, lastAskByEmail: {}, settings: {} };
}

const LANGS: readonly ClientReportLang[] = ["lv", "en", "ru", "de"];
const SKIPS: readonly ReviewAskSkipReason[] = [
  "opt_out",
  "b2b",
  "refunded",
  "cancelled",
  "no_email",
  "recent_other_order",
  "already_asked",
  "too_late",
  "stale_claim",
  "not_green",
];

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function iso(v: unknown): string | undefined {
  const s = str(v, 40);
  return s && Number.isFinite(Date.parse(s)) ? s : undefined;
}

function parseEntry(id: string, raw: unknown): ReviewAskEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const reportSentAt = iso(r.reportSentAt);
  if (!reportSentAt) return null;
  const lang = LANGS.includes(r.lang as ClientReportLang) ? (r.lang as ClientReportLang) : "lv";
  const out: ReviewAskEntry = { sessionId: id, reportSentAt, email: str(r.email, 254), lang };
  const car = str(r.car, 60);
  if (car) out.car = car;
  const vin = str(r.vin, 17);
  if (vin) out.vin = vin;
  const askedAt = iso(r.askedAt);
  if (askedAt) out.askedAt = askedAt;
  const doneAt = iso(r.doneAt);
  if (doneAt) out.doneAt = doneAt;
  if (SKIPS.includes(r.skip as ReviewAskSkipReason)) out.skip = r.skip as ReviewAskSkipReason;
  const claimAt = iso(r.claimAt);
  if (claimAt) out.claimAt = claimAt;
  return out;
}

export function parseReviewAskDoc(raw: unknown): ReviewAskDoc {
  const doc = emptyReviewAskDoc();
  if (!raw || typeof raw !== "object") return doc;
  const r = raw as Record<string, unknown>;
  if (r.entries && typeof r.entries === "object") {
    for (const [id, v] of Object.entries(r.entries as Record<string, unknown>)) {
      const e = parseEntry(id, v);
      if (e) doc.entries[id] = e;
    }
  }
  if (r.lastAskByEmail && typeof r.lastAskByEmail === "object") {
    for (const [email, v] of Object.entries(r.lastAskByEmail as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const at = iso((v as Record<string, unknown>).at);
      const sessionId = str((v as Record<string, unknown>).sessionId, 200);
      if (at && sessionId) doc.lastAskByEmail[email] = { at, sessionId };
    }
  }
  if (r.settings && typeof r.settings === "object") {
    const st = r.settings as Record<string, unknown>;
    if (typeof st.onlyGreen === "boolean") doc.settings.onlyGreen = st.onlyGreen;
    const updatedAt = iso(st.updatedAt);
    if (updatedAt) doc.settings.updatedAt = updatedAt;
  }
  return doc;
}

export function reviewEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

/* ---------------- Laiks ---------------- */

const RIGA_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function rigaParts(ms: number): Record<string, string> {
  return Object.fromEntries(RIGA_PARTS.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
}

/** «2026-11-26» pēc Rīgas kalendāra. */
export function rigaDateKey(ms: number): string {
  const p = rigaParts(ms);
  return `${p.year}-${p.month}-${p.day}`;
}

function isRigaWeekend(ms: number): boolean {
  const w = rigaParts(ms).weekday ?? "";
  return w === "Sat" || w === "Sun";
}

/** Lūgums pienācis: Rīgā jau ir nākamā kalendārā diena pēc atskaites. */
export function isReviewAskDayReached(reportSentAt: string, nowMs: number): boolean {
  const sent = Date.parse(reportSentAt);
  return Number.isFinite(sent) && rigaDateKey(nowMs) > rigaDateKey(sent);
}

/** Darba diena (P-Pk) un 10:00-17:59 pēc Rīgas laika. Svētdienas/sestdienas - nē. */
export function isReviewAskSendWindow(nowMs: number): boolean {
  if (isRigaWeekend(nowMs)) return false;
  const parts = rigaParts(nowMs);
  const hour = Number(parts.hour);
  return Number.isFinite(hour) && hour >= REVIEW_SEND_FROM_HOUR && hour < REVIEW_SEND_TO_HOUR;
}

/* ---------------- Rinda ---------------- */

export type ReviewAskEnqueueInput = {
  sessionId: string;
  reportSentAt: string;
  email: string;
  lang: ClientReportLang;
  car?: string | null;
  vin?: string | null;
};

/** Pievieno rindai pēc pirmās atskaites. Ja ieraksts jau ir (labota atskaite) - nemaina neko (`null`). */
export function enqueueReviewAsk(doc: ReviewAskDoc, input: ReviewAskEnqueueInput): ReviewAskDoc | null {
  if (doc.entries[input.sessionId]) return null;
  const entry: ReviewAskEntry = {
    sessionId: input.sessionId,
    reportSentAt: input.reportSentAt,
    email: input.email.trim(),
    lang: input.lang,
  };
  const car = (input.car ?? "").trim();
  if (car) entry.car = car.slice(0, 60);
  const vin = (input.vin ?? "").trim();
  if (vin && isValidVin(vin)) entry.vin = normalizeVin(vin);
  return { ...doc, entries: { ...doc.entries, [input.sessionId]: entry } };
}

/** Izmet vecus pabeigtus ierakstus un >60 d. vecus e-pastu laikus. */
export function pruneReviewAskDoc(doc: ReviewAskDoc, nowMs: number): ReviewAskDoc {
  const entries: Record<string, ReviewAskEntry> = {};
  for (const [id, e] of Object.entries(doc.entries)) {
    const doneMs = Date.parse(e.doneAt ?? "");
    if (Number.isFinite(doneMs) && nowMs - doneMs > REVIEW_DONE_KEEP_MS) continue;
    const sentMs = Date.parse(e.reportSentAt);
    if (!e.doneAt && Number.isFinite(sentMs) && nowMs - sentMs > 60 * DAY_MS) continue;
    entries[id] = e;
  }
  const lastAskByEmail: ReviewAskDoc["lastAskByEmail"] = {};
  for (const [k, v] of Object.entries(doc.lastAskByEmail)) {
    if (nowMs - Date.parse(v.at) <= REVIEW_CUSTOMER_COOLDOWN_MS) lastAskByEmail[k] = v;
  }
  return { ...doc, entries, lastAskByEmail };
}

/** Pasūtījuma fakti sūtīšanas brīdī (lasa cron no pasūtījuma, atzīmēm un atmaksām). */
export type ReviewAskOrderFacts = {
  b2b: boolean;
  refunded: boolean;
  cancelled: boolean;
  /** Adminā «Nelūgt» vai «Atcelt». */
  optOut: boolean;
  /** Pašreizējais klienta e-pasts (var būt labots pēc atskaites). */
  email: string;
  /** Lūgums jau nosūtīts citā ceļā (admina poga, dīlera «Sūtīt klientam» ar atsauksmi). */
  otherAskAt?: string | null;
  /** Vai pasūtījuma indikators ir zaļš (`reviewIndicatorGreen`). `null`/`false` - nav zaļš vai nav aprēķināts. */
  indicatorGreen?: boolean | null;
};

export type ReviewAskPolicy = {
  /** «Sūtīt tikai, ja indikators zaļš». Pēc noklusējuma ieslēgts (Nils 26.11, apzinoties Google noteikumu risku). */
  onlyGreen: boolean;
};

export const DEFAULT_REVIEW_ASK_POLICY: ReviewAskPolicy = { onlyGreen: true };

export function reviewAskPolicyFromDoc(doc: Pick<ReviewAskDoc, "settings">): ReviewAskPolicy {
  return { onlyGreen: doc.settings?.onlyGreen !== false };
}

/**
 * «Indikators zaļajā sektorā» pasūtījumam (tas pats, ko admins redz):
 * - dīlera datiem - «Atsauksmes iespēja» līmenis «Augsta» (`dealer-review-score.ts`, zaļais tonis `ok`, ≥60 punkti);
 * - jebkuram pasūtījumam - operatora «Rezultāts» krāsa «Zaļš» (`admin-audit-result-color`).
 * Nav neviena = nav zaļš.
 */
export function reviewIndicatorGreen(args: {
  auditResultColor?: "green" | "orange" | "red" | null;
  dealerReviewLevel?: "high" | "medium" | "low" | "none" | null;
}): boolean {
  return args.auditResultColor === "green" || args.dealerReviewLevel === "high";
}

export type ReviewAskDecision =
  | { kind: "wait" }
  | { kind: "send" }
  | { kind: "skip"; reason: ReviewAskSkipReason }
  /** Vēl nesūta un atzīmē iemeslu, bet pārbauda atkal (piem. indikators var kļūt zaļš līdz termiņam). */
  | { kind: "hold"; reason: ReviewAskSkipReason }
  | { kind: "done" };

export function decideReviewAsk(
  entry: ReviewAskEntry,
  facts: ReviewAskOrderFacts,
  doc: ReviewAskDoc,
  nowMs: number,
  policy: ReviewAskPolicy = DEFAULT_REVIEW_ASK_POLICY,
): ReviewAskDecision {
  if (entry.doneAt || entry.askedAt) return { kind: "done" };
  if (entry.claimAt) {
    if (nowMs - Date.parse(entry.claimAt) < REVIEW_CLAIM_STALE_MS) return { kind: "wait" };
    return { kind: "skip", reason: "stale_claim" };
  }
  if (facts.optOut) return { kind: "skip", reason: "opt_out" };
  if (facts.b2b) return { kind: "skip", reason: "b2b" };
  if (facts.refunded) return { kind: "skip", reason: "refunded" };
  if (facts.cancelled) return { kind: "skip", reason: "cancelled" };
  if (!facts.email || !isValidOrderEmail(facts.email)) return { kind: "skip", reason: "no_email" };
  if (facts.otherAskAt) return { kind: "skip", reason: "already_asked" };
  if (!isReviewAskDayReached(entry.reportSentAt, nowMs)) return { kind: "wait" };
  if (nowMs - Date.parse(entry.reportSentAt) > REVIEW_ASK_MAX_AGE_MS) {
    return { kind: "skip", reason: entry.skip === "not_green" ? "not_green" : "too_late" };
  }
  const last = doc.lastAskByEmail[reviewEmailKey(facts.email)];
  if (last && last.sessionId !== entry.sessionId && nowMs - Date.parse(last.at) < REVIEW_CUSTOMER_COOLDOWN_MS) {
    return { kind: "skip", reason: "recent_other_order" };
  }
  if (policy.onlyGreen && facts.indicatorGreen !== true) return { kind: "hold", reason: "not_green" };
  if (!isReviewAskSendWindow(nowMs)) return { kind: "wait" };
  return { kind: "send" };
}

/** Veiksmīgi nosūtīts: ieraksts pabeigts (atgādinājuma nav). */
export function withReviewAsked(entry: ReviewAskEntry, atIso: string): ReviewAskEntry {
  const { claimAt: _c, skip: _s, ...rest } = entry;
  void _c;
  void _s;
  return { ...rest, askedAt: atIso, doneAt: atIso };
}

export function withReviewSkipped(entry: ReviewAskEntry, reason: ReviewAskSkipReason, atIso: string): ReviewAskEntry {
  const { claimAt, ...rest } = entry;
  // Nokavēta «aizņemšana»: nezinām, vai aizgāja - uzskata par nosūtītu (nekad divreiz).
  if (reason === "stale_claim" && claimAt) return { ...withReviewAsked(rest, claimAt), skip: reason };
  return { ...rest, skip: reason, doneAt: atIso };
}

/** «hold»: atzīmē iemeslu, ieraksts paliek atvērts. */
export function withReviewHeld(entry: ReviewAskEntry, reason: ReviewAskSkipReason): ReviewAskEntry {
  return entry.skip === reason ? entry : { ...entry, skip: reason };
}

/* ---------------- Teksti ---------------- */

const SHORT_WORD = /^[A-Z0-9-]{1,3}$/;

/** «VOLKSWAGEN GOLF» -> «Volkswagen Golf»; «BMW X5» paliek; tukšs -> "". */
export function reviewCarLabel(make?: string | null, model?: string | null): string {
  const raw = [make ?? "", model ?? ""].join(" ").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const upper = raw === raw.toUpperCase();
  const words = raw.split(" ").map((w) => {
    if (!upper || SHORT_WORD.test(w) || /\d/.test(w)) return w;
    return w.charAt(0) + w.slice(1).toLowerCase();
  });
  return words.join(" ").slice(0, 40).trim();
}

function vinTail(vin?: string | null): string {
  const v = (vin ?? "").trim();
  return v.length >= 4 ? v.slice(-4).toUpperCase() : "";
}

/**
 * Auto nosaukums tekstā (bez prievārda, izņemot DE): ar marku/modeli «VW Golf»,
 * bez tā - «Jūsu auto (VIN …1234)» klienta valodā.
 */
export function reviewCarObject(lang: ClientReportLang, car?: string | null, vin?: string | null): string {
  const c = (car ?? "").trim();
  const tail = vinTail(vin);
  const vinPart = (label: string) => (tail ? ` (${label} …${tail})` : "");
  switch (lang) {
    case "en":
      return c ? `the ${c}` : `your car${vinPart("VIN")}`;
    case "ru":
      return c || `Вашему автомобилю${vinPart("VIN")}`;
    case "de":
      return c ? `zum ${c}` : `zu Ihrem Fahrzeug${vinPart("FIN")}`;
    default:
      return c || `Jūsu auto${vinPart("VIN")}`;
  }
}

type ReviewAskCopy = {
  greeting: string;
  askSubject: (car: string) => string;
  askPreheader: string;
  askBody: (car: string) => string;
  button: string;
  questions: string;
  signGreeting: string;
  /** WhatsApp W1 (sūta Nils ar pogu). */
  waBody: (car: string) => string;
  waThanks: string;
};

export const REVIEW_ASK_COPY: Record<ClientReportLang, ReviewAskCopy> = {
  lv: {
    greeting: "Labdien!",
    askSubject: (car) => `Kā Jums noderēja atskaite par ${car}?`,
    askPreheader: "Viena minūte, viena poga - Jūsu vērtējums palīdz citiem pircējiem.",
    askBody: (car) =>
      `Pirms dažām dienām nosūtījām Jums PROVIN atskaiti par ${car}. Būsim pateicīgi, ja veltīsiet minūti un novērtēsiet mūsu darbu Google - Jūsu godīgais viedoklis palīdz citiem auto pircējiem.`,
    button: "Novērtēt Google",
    questions: "Jautājumi par atskaiti? Atbildiet uz šo e-pastu.",
    signGreeting: "Ar cieņu,",
    waBody: (car) =>
      `Ceram, ka PROVIN atskaite par ${car} noderēja. Būsim pateicīgi, ja veltīsiet minūti un novērtēsiet mūsu darbu Google:`,
    waThanks: "Paldies!",
  },
  en: {
    greeting: "Hello!",
    askSubject: (car) => `How useful was your report on ${car}?`,
    askPreheader: "One minute, one button - your rating helps other buyers.",
    askBody: (car) =>
      `A few days ago we sent you a PROVIN report on ${car}. We would be grateful if you could take a minute to rate our work on Google - your honest opinion helps other car buyers.`,
    button: "Rate us on Google",
    questions: "Questions about the report? Just reply to this email.",
    signGreeting: "Best regards,",
    waBody: (car) =>
      `We hope the PROVIN report on ${car} was useful. We would be grateful if you could take a minute to rate our work on Google:`,
    waThanks: "Thank you!",
  },
  ru: {
    greeting: "Здравствуйте!",
    askSubject: (car) => `Насколько полезен был отчёт по ${car}?`,
    askPreheader: "Одна минута, одна кнопка - Ваша оценка помогает другим покупателям.",
    askBody: (car) =>
      `Несколько дней назад мы отправили Вам отчёт PROVIN по ${car}. Будем благодарны, если Вы уделите минуту и оцените нашу работу в Google - Ваше честное мнение помогает другим покупателям автомобилей.`,
    button: "Оценить в Google",
    questions: "Вопросы по отчёту? Просто ответьте на это письмо.",
    signGreeting: "С уважением,",
    waBody: (car) =>
      `Надеемся, что отчёт PROVIN по ${car} был полезен. Будем благодарны, если Вы уделите минуту и оцените нашу работу в Google:`,
    waThanks: "Спасибо!",
  },
  de: {
    greeting: "Guten Tag!",
    askSubject: (car) => `Wie hilfreich war der Bericht ${car}?`,
    askPreheader: "Eine Minute, ein Klick - Ihre Bewertung hilft anderen Käufern.",
    askBody: (car) =>
      `Vor einigen Tagen haben wir Ihnen einen PROVIN-Bericht ${car} geschickt. Wir wären dankbar, wenn Sie sich eine Minute Zeit nehmen und unsere Arbeit auf Google bewerten - Ihre ehrliche Meinung hilft anderen Autokäufern.`,
    button: "Auf Google bewerten",
    questions: "Fragen zum Bericht? Antworten Sie einfach auf diese E-Mail.",
    signGreeting: "Mit freundlichen Grüßen,",
    waBody: (car) =>
      `Wir hoffen, dass der PROVIN-Bericht ${car} hilfreich war. Wir wären dankbar, wenn Sie sich eine Minute Zeit nehmen und unsere Arbeit auf Google bewerten:`,
    waThanks: "Vielen Dank!",
  },
};

export type ReviewAskEmailContent = {
  subject: string;
  preheader: string;
  greeting: string;
  body: string;
  button: string;
  href: string;
  questions: string;
  signGreeting: string;
  text: string;
};

/** E-pasta saturs (temats, teksts, poga) klienta valodā. */
export function buildReviewAskEmail(opts: {
  lang: ClientReportLang;
  car?: string | null;
  vin?: string | null;
}): ReviewAskEmailContent {
  const c = REVIEW_ASK_COPY[opts.lang] ?? REVIEW_ASK_COPY.lv;
  const car = reviewCarObject(opts.lang, opts.car, opts.vin);
  const subject = c.askSubject(car);
  const body = c.askBody(car);
  const text = [
    c.greeting,
    "",
    body,
    "",
    `${c.button}: ${GOOGLE_REVIEW_URL}`,
    "",
    c.questions,
    "",
    c.signGreeting,
    "PROVIN.LV",
  ].join("\n");
  return {
    subject,
    preheader: c.askPreheader,
    greeting: c.greeting,
    body,
    button: c.button,
    href: GOOGLE_REVIEW_URL,
    questions: c.questions,
    signGreeting: c.signGreeting,
    text,
  };
}

/** WhatsApp ziņa (W1) - saite atsevišķā rindā, lai WhatsApp rāda kartīti. */
export function buildReviewAskWhatsappText(opts: {
  lang: ClientReportLang;
  car?: string | null;
  vin?: string | null;
}): string {
  const c = REVIEW_ASK_COPY[opts.lang] ?? REVIEW_ASK_COPY.lv;
  const car = reviewCarObject(opts.lang, opts.car, opts.vin);
  return [c.greeting, "", c.waBody(car), GOOGLE_REVIEW_URL, "", c.waThanks, "PROVIN.LV"].join("\n");
}

/* ---------------- Admins ---------------- */

const RIGA_DAY = new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit" });

function rigaDay(isoStr: string | null | undefined): string {
  const t = Date.parse(isoStr ?? "");
  if (!Number.isFinite(t)) return "";
  const p = Object.fromEntries(RIGA_DAY.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}`;
}

export const REVIEW_SKIP_LABEL_LV: Record<ReviewAskSkipReason, string> = {
  opt_out: "atcelts",
  b2b: "B2B - nesūta",
  refunded: "atmaksāts - nesūta",
  cancelled: "atcelts pasūtījums - nesūta",
  no_email: "nav e-pasta",
  recent_other_order: "klientam lūgts pēdējās 60 d.",
  already_asked: "lūgts citā veidā",
  too_late: "nokavēts - nesūta",
  stale_claim: "sūtīšana nepabeigta",
  not_green: "nav lūgta (indikators nav zaļš)",
};

/**
 * Rinda pasūtījumā: «Atsauksme: lūgta 29.11», «Atsauksme: plānota 27.11», «Atsauksme: nelūgt».
 */
export function reviewAskStatusLine(args: {
  askedAt?: string | null;
  optOutAt?: string | null;
  plannedAt?: string | null;
  skip?: ReviewAskSkipReason | null;
  channel?: "email" | "whatsapp" | null;
}): string {
  let part: string;
  if (args.askedAt) part = `lūgta ${rigaDay(args.askedAt)}${args.channel === "whatsapp" ? " (WhatsApp)" : ""}`;
  else if (args.optOutAt) part = "nelūgt";
  else if (args.skip) part = REVIEW_SKIP_LABEL_LV[args.skip];
  else if (args.plannedAt) part = `plānota ${rigaDay(args.plannedAt)}`;
  else part = "nav lūgta";
  return `Atsauksme: ${part}`;
}

/** Plānotā lūguma diena: nākamā diena pēc atskaites; brīvdienā - pirmā darba diena. */
export function reviewAskPlannedAt(reportSentAt: string | null | undefined): string | null {
  const t = Date.parse(reportSentAt ?? "");
  if (!Number.isFinite(t)) return null;
  const day = rigaDateKey(t);
  let ms = t;
  for (let i = 0; i < 10; i++) {
    ms += 6 * 60 * 60 * 1000;
    if (rigaDateKey(ms) > day && !isRigaWeekend(ms)) return new Date(ms).toISOString();
  }
  return null;
}
