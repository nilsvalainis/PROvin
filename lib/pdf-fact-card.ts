/**
 * PDF faktu karte - tas pats vizuālais kods kā dīlera „Transportlīdzekļa informācija”.
 */

import { capitalizeFactValue } from "@/lib/vin-sources/translate-lv";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FACT_LINE_RE = /^([^:]{2,60}):\s+(.+)$/;

const DROP_FACT_KEYS = new Set(["euronorma", "dpf", "sekundārais statuss"]);

export type PdfKvRow = {
  k: string;
  v: string;
  /** Gatavs HTML (CSDD datumi u.c.). Ja nav, izvada escape(v). */
  vHtml?: string;
};

export function parsePdfFactCardRows(text: string, unlabeledKey: string): { k: string; v: string }[] {
  const rows: { k: string; v: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const m = FACT_LINE_RE.exec(line);
    if (m) {
      rows.push({ k: m[1]!.trim(), v: m[2]!.trim().replace(/\.+$/, "") });
      continue;
    }
    rows.push({ k: unlabeledKey, v: line.replace(/\.+$/, "") });
  }
  return rows;
}

function factKeyNorm(k: string): string {
  return k.replace(/:$/, "").trim().toLocaleLowerCase("lv");
}

function stripOwnerCountNote(value: string): string {
  const n = value.trim().match(/^(\d{1,2})\b/);
  return n ? n[1]! : value.trim();
}

/** Dānijas / reģistra rindu tīrīšana atskaitē: bez birkām, bez iekavām pie skaita, lielais burts. */
export function polishPdfFactCardRows(rows: readonly { k: string; v: string }[]): { k: string; v: string }[] {
  const out: { k: string; v: string }[] = [];
  for (const row of rows) {
    const key = factKeyNorm(row.k);
    if (DROP_FACT_KEYS.has(key)) continue;
    let k = row.k.replace(/:$/, "").trim();
    let v = row.v.trim();
    if (key === "dānijas īpašnieku skaits" || key === "īpašnieku skaits dānijā") {
      k = "Īpašnieku skaits Dānijā";
      v = stripOwnerCountNote(v);
    } else if (key === "īpašnieku skaits" && /^\d{1,2}\b/.test(v) && /\(/.test(v)) {
      v = stripOwnerCountNote(v);
    }
    if (key === "izmantošanas veids" && /privāta\s+pasažieru\s+pārvadāšana/i.test(v)) {
      v = "Privāti";
    }
    v = capitalizeFactValue(v);
    if (!k || !v) continue;
    out.push({ k, v });
  }
  return out;
}

/** Īpašnieki + statusi + karogi vienā kv tabulā, bez komentāru kastēm. */
export function collectRegistryFactCardRows(input: {
  ownersSummary?: string;
  statusRecords?: string;
  autoNotes?: string;
}): { k: string; v: string }[] {
  return polishPdfFactCardRows([
    ...parsePdfFactCardRows(input.ownersSummary ?? "", "Īpašnieku skaits"),
    ...parsePdfFactCardRows(input.statusRecords ?? "", "Statuss"),
    ...parsePdfFactCardRows(input.autoNotes ?? "", "Piezīmes"),
  ]);
}

export function splitPdfKvPairRows<T>(rows: readonly T[]): { left: T[]; right: T[] } {
  const mid = Math.ceil(rows.length / 2);
  return { left: rows.slice(0, mid), right: rows.slice(mid) };
}

function kvTableHtml(rows: readonly PdfKvRow[]): string {
  if (rows.length === 0) return "";
  const body = rows
    .map((r) => `<tr><td>${escapeHtml(r.k)}</td><td>${r.vHtml ?? escapeHtml(r.v)}</td></tr>`)
    .join("");
  return `<table class="pdf-v1-kv"><tbody>${body}</tbody></table>`;
}

/** Divas kolonnas visiem faktiem (koncepts D). */
export function buildPdfKvPairHtml(rows: readonly PdfKvRow[]): string {
  if (rows.length === 0) return "";
  if (rows.length === 1) return kvTableHtml(rows);
  const { left, right } = splitPdfKvPairRows(rows);
  return `<div class="pdf-v1-kv-pair">${kvTableHtml(left)}${kvTableHtml(right)}</div>`;
}

export function buildPdfFactCardHtml(
  rows: { k: string; v: string }[],
  title = "Transportlīdzekļa informācija",
): string {
  if (rows.length === 0) return "";
  const head = title.trim()
    ? `<p class="pdf-subhead">${escapeHtml(title.trim())}</p>`
    : "";
  return `${head}${buildPdfKvPairHtml(rows)}`;
}
