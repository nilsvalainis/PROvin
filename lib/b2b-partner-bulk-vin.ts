import {
  formatPartnerVinDuplicateDate,
  partnerArchiveReportHref,
} from "@/lib/b2b-partner-archive-rows";
import type { B2bPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const BULK_VIN_MAX = 20;

export type BulkVinKind = "valid" | "invalid" | "duplicate" | "already_ordered";

export type BulkVinAlreadyHit = {
  id: string;
  created: number;
  reportReady: boolean;
};

export type BulkVinClassified = {
  index: number;
  raw: string;
  vin: string;
  kind: BulkVinKind;
  charCount: number;
  alreadyOrderedAt?: string;
  alreadyOrderedLabel?: string;
  reportHref?: string | null;
  orderId?: string;
};

const HEADER_CELL =
  /^(vin|vin\s*code|vin\s*kods|kods|код\s*vin|fahrgestellnummer|chassis)$/i;

export function isBulkVinFormatValid(vin: string): boolean {
  const n = normalizeVin(vin);
  return isValidVin(n);
}

export function splitVinPaste(text: string): string[] {
  return (text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/[\n\r,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseCsvFirstColumn(text: string): string[] {
  const source = (text ?? "").replace(/^\uFEFF/, "");
  const cells: string[] = [];
  let i = 0;
  while (i < source.length) {
    const cell = readCsvFirstCell(source, i);
    if (cell.value.trim()) cells.push(cell.value.trim());
    i = cell.lineEnd;
  }
  return skipVinHeader(cells);
}

function readCsvFirstCell(source: string, start: number): { value: string; lineEnd: number } {
  let i = start;
  while (i < source.length && (source[i] === " " || source[i] === "\t")) i += 1;
  let value = "";
  if (source[i] === '"') {
    i += 1;
    while (i < source.length) {
      const ch = source[i] ?? "";
      if (ch === '"') {
        if (source[i + 1] === '"') {
          value += '"';
          i += 2;
          continue;
        }
        i += 1;
        break;
      }
      value += ch;
      i += 1;
    }
  } else {
    while (i < source.length && source[i] !== "," && source[i] !== ";" && source[i] !== "\n" && source[i] !== "\r") {
      value += source[i] ?? "";
      i += 1;
    }
  }
  while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i += 1;
  if (source[i] === "\r") i += 1;
  if (source[i] === "\n") i += 1;
  return { value, lineEnd: i };
}

export function skipVinHeader(cells: readonly string[]): string[] {
  const cleaned = cells.map((cell) => cell.trim()).filter(Boolean);
  if (cleaned.length && HEADER_CELL.test(cleaned[0] ?? "")) return cleaned.slice(1);
  return cleaned;
}

export function capBulkVinTokens(tokens: readonly string[], max = BULK_VIN_MAX): {
  tokens: string[];
  truncated: boolean;
} {
  const cleaned = tokens.map((token) => token.trim()).filter(Boolean);
  return {
    tokens: cleaned.slice(0, max),
    truncated: cleaned.length > max,
  };
}

export function classifyBulkVinTokens(
  tokens: readonly string[],
  already: ReadonlyMap<string, BulkVinAlreadyHit> = new Map(),
  max = BULK_VIN_MAX,
): { rows: BulkVinClassified[]; truncated: boolean } {
  const capped = capBulkVinTokens(tokens, max);
  const seen = new Set<string>();
  const rows = capped.tokens.map((raw, index) => classifyOneBulkVin(raw, index, seen, already));
  return { rows, truncated: capped.truncated };
}

function classifyOneBulkVin(
  raw: string,
  index: number,
  seen: Set<string>,
  already: ReadonlyMap<string, BulkVinAlreadyHit>,
): BulkVinClassified {
  const vin = normalizeVin(raw);
  const charCount = vin.length;
  if (!isBulkVinFormatValid(vin)) {
    return { index, raw, vin, kind: "invalid", charCount };
  }
  if (seen.has(vin)) {
    return { index, raw, vin, kind: "duplicate", charCount };
  }
  seen.add(vin);
  const hit = already.get(vin);
  if (hit) {
    const alreadyOrderedAt = new Date(hit.created * 1000).toISOString();
    return {
      index,
      raw,
      vin,
      kind: "already_ordered",
      charCount,
      alreadyOrderedAt,
      alreadyOrderedLabel: formatPartnerVinDuplicateDate(hit.created),
      reportHref: partnerArchiveReportHref(hit.id, hit.reportReady),
      orderId: hit.id,
    };
  }
  return { index, raw, vin, kind: "valid", charCount };
}

export type BulkVinKindCounts = {
  valid: number;
  invalid: number;
  duplicate: number;
  alreadyOrdered: number;
  orderable: number;
};

export function isBulkVinOrderable(row: { kind: BulkVinKind; reorder?: boolean }): boolean {
  return row.kind === "valid" || (row.kind === "already_ordered" && row.reorder === true);
}

export function summarizeBulkVinKinds(
  rows: readonly { kind: BulkVinKind; reorder?: boolean }[],
): BulkVinKindCounts {
  const counts: BulkVinKindCounts = {
    valid: 0,
    invalid: 0,
    duplicate: 0,
    alreadyOrdered: 0,
    orderable: 0,
  };
  for (const row of rows) {
    if (row.kind === "valid") counts.valid += 1;
    else if (row.kind === "invalid") counts.invalid += 1;
    else if (row.kind === "duplicate") counts.duplicate += 1;
    else counts.alreadyOrdered += 1;
    if (isBulkVinOrderable(row)) counts.orderable += 1;
  }
  return counts;
}

export function planBulkVinCredits(
  remaining: number,
  orderable: number,
): { used: number; from: number; to: number; shortfall: number; canOrder: boolean } {
  const used = Math.max(0, Math.floor(orderable));
  const from = Math.max(0, Math.floor(remaining));
  if (used < 1) {
    return { used: 0, from, to: from, shortfall: 0, canOrder: false };
  }
  if (used > from) {
    return { used, from, to: from, shortfall: used - from, canOrder: false };
  }
  return { used, from, to: from - used, shortfall: 0, canOrder: true };
}

export type BulkVinSubmitItem = {
  vin: string;
  auditPurpose: B2bPartnerAuditPurpose;
  listingUrl?: string;
  reorder?: boolean;
};

export function uniqueNormalizedVins(items: readonly { vin: string }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const vin = normalizeVin(item.vin);
    if (!vin || seen.has(vin)) continue;
    seen.add(vin);
    out.push(vin);
  }
  return out;
}
