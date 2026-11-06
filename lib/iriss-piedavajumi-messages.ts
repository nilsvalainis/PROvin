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
      return [{ id, at, from, kind, by, text }];
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

/** Klienta jautājumi, uz kuriem pēc tam nav admina piezīmes (sarakstā - zīme). */
export function irissPdOpenQuestionCount(messages: readonly IrissPdMessage[]): number {
  let n = 0;
  for (const m of messages) {
    if (m.from === "admin") n = 0;
    else if (m.kind === "question") n += 1;
  }
  return n;
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

/** Klienta jautājumi saitē (tikai paša klienta teksts; admina piezīmes nekad). */
export function irissPdPublicQuestions(messages: readonly IrissPdMessage[]): { at: string; text: string }[] {
  return messages
    .filter((m) => m.from === "client" && m.kind === "question")
    .slice(-IRISS_PD_PUBLIC_QUESTIONS)
    .map((m) => ({ at: m.at, text: m.text }));
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

/** Admina atbilde / iekšēja piezīme. Klientam netiek sūtīta un saitē nav redzama. */
export function applyIrissPdAdminNote(
  rec: IrissPiedavajums,
  textRaw: unknown,
  ctx: IrissPdMessageCtx,
): { ok: true; record: IrissPiedavajums } | { ok: false; error: "empty" } {
  const text = cleanIrissPdMessageText(textRaw, IRISS_PD_NOTE_MAX);
  if (!text) return { ok: false, error: "empty" };
  let next = appendMessage({ ...rec, updatedAt: ctx.at }, { id: ctx.id, at: ctx.at, from: "admin", kind: "note", by: ctx.by, text });
  next = appendHistory(next, ctx.at, ctx.by, "Piezīme pie klienta ziņām (iekšēja)");
  return { ok: true, record: next };
}
