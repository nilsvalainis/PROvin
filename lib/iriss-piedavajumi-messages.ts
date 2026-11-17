/**
 * Nils 07.11: klienta «Noraidīt» un «Uzdot jautājumu» piedāvājuma saitē `/p/d/<token>` (tīra loģika, bez krātuves).
 * - Noraidīt: statuss «Noraidīts», neobligāts iemesls; pēc tam saitē vairs nevar apstiprināt (admins var atjaunot).
 * - Jautājums: saglabājas kā klienta ziņa, statuss nemainās.
 * - Admina atbilde: tikai iekšēja piezīme (klientam nekas automātiski netiek sūtīts un saitē nav redzams).
 */

import {
  IRISS_PD_DECLINE_REASON_MAX,
  IRISS_PD_MAX_HISTORY,
  IRISS_PD_MAX_MESSAGES,
  IRISS_PD_MESSAGE_KINDS,
  IRISS_PD_NOTE_MAX,
  IRISS_PD_QUESTION_MAX,
  type IrissPdMessage,
  type IrissPdMessageKind,
  type IrissPiedavajums,
} from "@/lib/iriss-piedavajumi-types";

/** Klienta jautājuma minimālais garums (pēc tukšumu noņemšanas). */
export const IRISS_PD_QUESTION_MIN = 3;
/** Tas pats teksts no klienta šajā laikā - dublikāts (dubultklikšķis, atkārtota sūtīšana). */
export const IRISS_PD_QUESTION_DEDUPE_MS = 24 * 60 * 60 * 1000;
/** Klientam saitē rāda pēdējos N paša jautājumus. */
export const IRISS_PD_PUBLIC_QUESTIONS = 5;

/**
 * Brīvs teksts: saglabā rindu pārnesumus, izmet vadības rakstzīmes, saspiež tukšas rindas, nogriež garumu.
 * Attēlojums vienmēr kā teksts (React), HTML netiek interpretēts.
 */
export function cleanIrissPdMessageText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
    .trim();
}

function cleanIsoAt(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim().slice(0, 40);
  return t && Number.isFinite(Date.parse(t)) ? t : "";
}

function maxFor(kind: IrissPdMessageKind): number {
  if (kind === "question") return IRISS_PD_QUESTION_MAX;
  if (kind === "decline") return IRISS_PD_DECLINE_REASON_MAX;
  return IRISS_PD_NOTE_MAX;
}

export function normalizeIrissPdMessages(raw: unknown): IrissPdMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((m): IrissPdMessage[] => {
      if (!m || typeof m !== "object") return [];
      const o = m as Record<string, unknown>;
      const kind = (IRISS_PD_MESSAGE_KINDS as readonly unknown[]).includes(o.kind) ? (o.kind as IrissPdMessageKind) : null;
      const from = o.from === "client" || o.from === "admin" ? o.from : null;
      const at = typeof o.at === "string" ? o.at.trim().slice(0, 40) : "";
      const id = typeof o.id === "string" && /^[\w-]{1,64}$/.test(o.id) ? o.id : "";
      if (!kind || !from || !at || !id) return [];
      const text = cleanIrissPdMessageText(o.text, maxFor(kind));
      // Noraidījums var būt bez iemesla; jautājums un piezīme - ne.
      if (!text && kind !== "decline") return [];
      const by = typeof o.by === "string" ? o.by.replace(/\s+/g, " ").trim().slice(0, 80) : "";
      const msg: IrissPdMessage = { id, at, from, kind, by, text };
      if (from === "admin" && kind === "note" && o.public === true) msg.public = true;
      if (from === "client" && kind === "question") {
        const answeredAt = cleanIsoAt(o.answeredAt);
        const reopenedAt = cleanIsoAt(o.reopenedAt);
        if (answeredAt) {
          msg.answeredAt = answeredAt;
          msg.answeredBy = typeof o.answeredBy === "string" ? o.answeredBy.replace(/\s+/g, " ").trim().slice(0, 80) : "";
        } else if (reopenedAt) {
          msg.reopenedAt = reopenedAt;
        }
      }
      return [msg];
    })
    .slice(-IRISS_PD_MAX_MESSAGES);
}

function appendMessage(rec: IrissPiedavajums, msg: IrissPdMessage): IrissPiedavajums {
  return { ...rec, messages: [...rec.messages, msg].slice(-IRISS_PD_MAX_MESSAGES) };
}

function appendHistory(rec: IrissPiedavajums, at: string, by: string, text: string): IrissPiedavajums {
  return { ...rec, history: [...rec.history, { at, by, text: text.slice(0, 300) }].slice(-IRISS_PD_MAX_HISTORY) };
}

function snippet(text: string, max = 160): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

export type IrissPdQuestionAnswer = { at: string; by: string };

/**
 * Nils 14.11: kad klienta jautājums atbildēts.
 * - `answeredAt` - atzīmēts ar pogu «Atzīmēt kā atbildētu» vai atbildot caur «Atbilde / piezīme».
 * - `reopenedAt` - «Atjaunot kā neatbildētu»: atvērts, arī ja pēc tā ir admina atbilde.
 * - Vecie ieraksti bez abiem laukiem: kā līdz šim - atbildēts, ja pēc jautājuma ir admina ziņa (laiks un vārds no tās).
 * Ne jautājumam - null.
 */
export function irissPdQuestionAnswer(messages: readonly IrissPdMessage[], index: number): IrissPdQuestionAnswer | null {
  const m = messages[index];
  if (!m || m.from !== "client" || m.kind !== "question") return null;
  if (m.answeredAt) return { at: m.answeredAt, by: m.answeredBy ?? "" };
  if (m.reopenedAt) return null;
  for (let i = index + 1; i < messages.length; i++) {
    const a = messages[i]!;
    if (a.from === "admin") return { at: a.at, by: a.by };
  }
  return null;
}

/** Neatbildēti klienta jautājumi (sarakstā - zīme). */
export function irissPdOpenQuestionCount(messages: readonly IrissPdMessage[]): number {
  let n = 0;
  messages.forEach((m, i) => {
    if (m.from === "client" && m.kind === "question" && !irissPdQuestionAnswer(messages, i)) n += 1;
  });
  return n;
}

function markAnswered(m: IrissPdMessage, ctx: { at: string; by: string }): IrissPdMessage {
  const { reopenedAt: _r, ...rest } = m;
  void _r;
  return { ...rest, answeredAt: ctx.at, answeredBy: ctx.by };
}

/** Visus neatbildētos jautājumus atzīmē kā atbildētus (admina atbilde caur «Atbilde / piezīme»). */
function markOpenQuestionsAnswered(messages: readonly IrissPdMessage[], ctx: { at: string; by: string }): IrissPdMessage[] {
  return messages.map((m, i) => (m.from === "client" && m.kind === "question" && !irissPdQuestionAnswer(messages, i) ? markAnswered(m, ctx) : m));
}

/**
 * Nils 14.11: «Atzīmēt kā atbildētu» / «Atjaunot kā neatbildētu» klienta jautājumam. Klientam nekas netiek sūtīts.
 * Ja stāvoklis jau tāds - ieraksts nemainās.
 */
export function setIrissPdQuestionAnswered(
  rec: IrissPiedavajums,
  messageId: unknown,
  answered: boolean,
  ctx: { at: string; by: string },
): { ok: true; record: IrissPiedavajums } | { ok: false; error: "not_found" } {
  const i = rec.messages.findIndex((m) => m.id === messageId && m.from === "client" && m.kind === "question");
  if (i < 0) return { ok: false, error: "not_found" };
  if (Boolean(irissPdQuestionAnswer(rec.messages, i)) === answered) return { ok: true, record: rec };
  const cur = rec.messages[i]!;
  let updated: IrissPdMessage;
  if (answered) {
    updated = markAnswered(cur, ctx);
  } else {
    const { answeredAt: _a, answeredBy: _b, ...rest } = cur;
    void _a;
    void _b;
    updated = { ...rest, reopenedAt: ctx.at };
  }
  const messages = rec.messages.map((m, j) => (j === i ? updated : m));
  const text = answered ? `Jautājums atzīmēts kā atbildēts: ${snippet(cur.text, 80)}` : `Jautājums atjaunots kā neatbildēts: ${snippet(cur.text, 80)}`;
  return { ok: true, record: appendHistory({ ...rec, messages, updatedAt: ctx.at }, ctx.at, ctx.by, text) };
}

const fold = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function isIrissPdDuplicateQuestion(messages: readonly IrissPdMessage[], text: string, nowMs: number): boolean {
  const t = fold(text);
  return messages.some((m) => {
    if (m.from !== "client" || m.kind !== "question" || fold(m.text) !== t) return false;
    const at = Date.parse(m.at);
    return Number.isFinite(at) && nowMs - at < IRISS_PD_QUESTION_DEDUPE_MS;
  });
}

export type IrissPdPublicThreadItem = { at: string; text: string; from: "client" | "admin" };

/**
 * Klientam saitē: paša jautājumi + admina atbildes, kas atzīmētas «Rādīt klientam saitē».
 * Iekšējās piezīmes un admina vārds nekad. Pēdējie ieraksti hronoloģiski.
 */
export function irissPdPublicQuestions(messages: readonly IrissPdMessage[]): IrissPdPublicThreadItem[] {
  return messages
    .filter((m) => (m.from === "client" && m.kind === "question") || (m.from === "admin" && m.kind === "note" && m.public === true))
    .slice(-IRISS_PD_PUBLIC_QUESTIONS * 2)
    .map((m) => ({ at: m.at, text: m.text, from: m.from }));
}

export type IrissPdMessageCtx = { at: string; by: string; id: string };

/** Klients noraida saitē: «Noraidīts», iemesls (ja ir) kā klienta ziņa, ieraksts vēsturē. */
export function applyIrissPdClientDecline(
  rec: IrissPiedavajums,
  reasonRaw: unknown,
  ctx: IrissPdMessageCtx,
): { ok: true; record: IrissPiedavajums } | { ok: false; error: "closed" } {
  if (rec.status !== "sent") return { ok: false, error: "closed" };
  const reason = cleanIrissPdMessageText(reasonRaw, IRISS_PD_DECLINE_REASON_MAX);
  let next: IrissPiedavajums = { ...rec, status: "declined", declinedByClient: true, decidedAt: ctx.at, updatedAt: ctx.at };
  next = appendMessage(next, { id: ctx.id, at: ctx.at, from: "client", kind: "decline", by: ctx.by, text: reason });
  next = appendHistory(next, ctx.at, ctx.by, reason ? `Klients noraidīja: ${snippet(reason)}` : "Klients noraidīja (bez iemesla)");
  return { ok: true, record: next };
}

export type IrissPdQuestionError = "empty" | "duplicate";

/** Klienta jautājums: statuss nemainās. */
export function applyIrissPdClientQuestion(
  rec: IrissPiedavajums,
  textRaw: unknown,
  ctx: IrissPdMessageCtx & { nowMs: number },
): { ok: true; record: IrissPiedavajums; text: string } | { ok: false; error: IrissPdQuestionError } {
  const text = cleanIrissPdMessageText(textRaw, IRISS_PD_QUESTION_MAX);
  if (text.replace(/\s/g, "").length < IRISS_PD_QUESTION_MIN) return { ok: false, error: "empty" };
  if (isIrissPdDuplicateQuestion(rec.messages, text, ctx.nowMs)) return { ok: false, error: "duplicate" };
  let next = appendMessage({ ...rec, updatedAt: ctx.at }, { id: ctx.id, at: ctx.at, from: "client", kind: "question", by: ctx.by, text });
  next = appendHistory(next, ctx.at, ctx.by, `Klienta jautājums: ${snippet(text)}`);
  return { ok: true, record: next, text };
}

/**
 * Admina atbilde. Pēc noklusējuma iekšēja; ar `public` - redzama klientam saitē (e-pasts/ziņa netiek sūtīta).
 */
export function applyIrissPdAdminNote(
  rec: IrissPiedavajums,
  textRaw: unknown,
  ctx: IrissPdMessageCtx & { public?: boolean },
): { ok: true; record: IrissPiedavajums } | { ok: false; error: "empty" } {
  const text = cleanIrissPdMessageText(textRaw, IRISS_PD_NOTE_MAX);
  if (!text) return { ok: false, error: "empty" };
  const msg: IrissPdMessage = { id: ctx.id, at: ctx.at, from: "admin", kind: "note", by: ctx.by, text };
  if (ctx.public) msg.public = true;
  // Nils 14.11: atbilde atzīmē visus neatbildētos jautājumus kā atbildētus.
  const answered = markOpenQuestionsAnswered(rec.messages, { at: ctx.at, by: ctx.by });
  let next = appendMessage({ ...rec, messages: answered, updatedAt: ctx.at }, msg);
  next = appendHistory(next, ctx.at, ctx.by, ctx.public ? "Atbilde klientam (redzama saitē)" : "Piezīme pie klienta ziņām (iekšēja)");
  return { ok: true, record: next };
}

/** Esošai admina atbildei ieslēdz/izslēdz «Rādīt klientam saitē». */
export function setIrissPdNoteVisibility(
  rec: IrissPiedavajums,
  messageId: unknown,
  visible: boolean,
  ctx: { at: string; by: string },
): { ok: true; record: IrissPiedavajums } | { ok: false; error: "not_found" } {
  const i = rec.messages.findIndex((m) => m.id === messageId && m.from === "admin" && m.kind === "note");
  if (i < 0) return { ok: false, error: "not_found" };
  const cur = rec.messages[i]!;
  if (Boolean(cur.public) === visible) return { ok: true, record: rec };
  const { public: _drop, ...rest } = cur;
  void _drop;
  const updated: IrissPdMessage = visible ? { ...rest, public: true } : rest;
  const messages = rec.messages.map((m, j) => (j === i ? updated : m));
  const next = appendHistory({ ...rec, messages, updatedAt: ctx.at }, ctx.at, ctx.by, visible ? "Atbilde parādīta klientam saitē" : "Atbilde paslēpta no klienta saites");
  return { ok: true, record: next };
}
