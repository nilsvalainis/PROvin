import type { VendorAvotuBlockState } from "@/lib/admin-source-blocks";
import { ADMIN_MILEAGE_PASTE_RAW_MAX_LEN } from "@/lib/admin-raw-field-limits";

/**
 * Vendor PDF (AutoDNA / CarVertical) teksts AI kontekstā.
 *
 * Automātiski ielikto PDF tekstu iezīmē ar sākuma/beigu rindu, lai, ielasot jaunāku tā paša
 * avota PDF, nomainītu tikai šo daļu. Operatora un Copilot teksts ārpus marķieriem paliek neskarts.
 */

const MARKER_PREFIX = "=== PDF teksts (automātiski)";
const MARKER_END_PREFIX = "=== /PDF teksts (automātiski)";

export type VendorPdfAiContextOptions = {
  /** Avota nosaukums marķierī, piem. «AutoDNA» / «CarVertical». */
  sourceLabel: string;
  /** Ielases datums marķierī (DD.MM.YYYY); noklusēti šodiena Europe/Riga. */
  dateLabel?: string;
  /**
   * Iepriekš automātiski ieliktie PDF teksti (bez marķieriem, vecā loģika). Ja esošais teksts
   * tieši sakrīt ar kādu no tiem (vai ar jauno PDF tekstu), to aizstāj; citādi jauno bloku
   * pievieno beigās.
   */
  previousAutoTexts?: Array<string | null | undefined>;
  /** Kopējais limits (noklusēti 100 000 zīmju). */
  maxLen?: number;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeLabel(label: string): string {
  return label.replace(/[\r\n=·]+/g, " ").replace(/\s+/g, " ").trim() || "PDF";
}

export function rigaDateLabel(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}`;
}

function startLine(label: string, date: string): string {
  return `${MARKER_PREFIX}: ${label} · ${date} ===`;
}

function endLine(label: string): string {
  return `${MARKER_END_PREFIX}: ${label} ===`;
}

/** Visi šī avota automātiskie PDF bloki (ieskaitot marķieru rindas). */
function autoBlockRegex(label: string): RegExp {
  const l = escapeRegExp(label);
  return new RegExp(
    `${escapeRegExp(MARKER_PREFIX)}: ${l} · [^\\n]*===\\n[\\s\\S]*?\\n${escapeRegExp(MARKER_END_PREFIX)}: ${l} ===`,
    "g",
  );
}

function joinParts(a: string, b: string): string {
  const x = a.trim();
  const y = b.trim();
  if (!x) return y;
  if (!y) return x;
  return `${x}\n\n${y}`;
}

/**
 * Ieliek / atjauno automātisko PDF teksta bloku AI kontekstā.
 * - ir marķēts tā paša avota bloks -> nomaina tikai to;
 * - lauks tukšs -> ieliek bloku;
 * - vecs teksts bez marķieriem, tieši vienāds ar iepriekšējo automātisko tekstu -> aizstāj;
 * - citādi -> pievieno bloku beigās (neko nedzēš).
 * Ja kopā pārsniegts limits, saīsina PDF bloku, nevis operatora tekstu.
 */
export function upsertVendorPdfAiContext(
  block: VendorAvotuBlockState,
  rawText: string,
  opts: VendorPdfAiContextOptions,
): VendorAvotuBlockState {
  const raw = (rawText ?? "").trim();
  if (!raw) return block;
  const maxLen = opts.maxLen ?? ADMIN_MILEAGE_PASTE_RAW_MAX_LEN;
  const label = sanitizeLabel(opts.sourceLabel);
  const date = opts.dateLabel?.trim() || rigaDateLabel();
  const current = block.aiContextRaw ?? "";
  const currentTrim = current.trim();

  let before = "";
  let after = "";
  const re = autoBlockRegex(label);
  const matches = [...current.matchAll(re)];
  if (matches.length > 0) {
    const first = matches[0]!;
    const start = first.index ?? 0;
    before = current.slice(0, start);
    // Dublētos tā paša avota automātiskos blokus izņem.
    after = current
      .slice(start + first[0].length)
      .replace(re, "")
      .replace(/\n{3,}/g, "\n\n");
  } else if (currentTrim) {
    const legacy = [...(opts.previousAutoTexts ?? []), raw]
      .map((t) => (t ?? "").trim())
      .filter(Boolean)
      .flatMap((t) => [t, t.slice(0, maxLen).trim()]);
    if (!legacy.includes(currentTrim)) before = current;
  }

  const head = startLine(label, date);
  const tail = endLine(label);
  const beforeT = before.trim();
  const afterT = after.trim();
  const separators = (beforeT ? 2 : 0) + (afterT ? 2 : 0) + 2;
  const budget = maxLen - beforeT.length - afterT.length - separators - head.length - tail.length;
  if (budget <= 0) return block;
  const body = raw.slice(0, budget).trimEnd();
  const next = joinParts(joinParts(beforeT, `${head}\n${body}\n${tail}`), afterT);
  if (next === current) return block;
  return { ...block, aiContextRaw: next };
}
