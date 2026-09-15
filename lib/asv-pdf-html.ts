/**
 * ASV vēstures sadaļa klienta PDF — PROVIN noformējums.
 * VIN Audit / Carfax nosaukumi netiek drukāti.
 */

import { buildCcVinPdfInnerHtml, CC_VIN_PDF_CSS } from "@/lib/cc-vin-pdf-html";
import {
  ASV_SUBTITLES,
  asvBlockToCcVinView,
  asvRecordRowHasData,
  type AsvBlockState,
  type AsvRecordRow,
} from "@/lib/asv-report";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subhead(title: string): string {
  return `<p class="pdf-subhead">${escapeHtml(title)}</p>`;
}

function td(v: string): string {
  return `<td>${escapeHtml(v.trim() || "-")}</td>`;
}

function logTable(headings: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  const keep = headings.map((_, i) => rows.some((cells) => (cells[i] ?? "").trim().length > 0));
  if (!keep.some(Boolean)) return "";
  const head = headings
    .filter((_, i) => keep[i])
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("");
  const body = rows
    .map((cells) => `<tr>${cells.filter((_, i) => keep[i]).map(td).join("")}</tr>`)
    .join("");
  return `<table class="pdf-v1-kv pdf-v1-kv--outvin-log"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function recordTable(rows: AsvRecordRow[], labelHead: string): string {
  const data = rows.filter(asvRecordRowHasData);
  return logTable([labelHead, "Datums", "Detaļas"], data.map((r) => [r.label, r.date, r.detail]));
}

export function buildAsvPdfInnerHtml(b: AsvBlockState | null | undefined): string {
  if (!b) return "";
  const view = asvBlockToCcVinView(b);
  const parts: string[] = [];
  if (view) parts.push(buildCcVinPdfInnerHtml(view));

  const liens = recordTable(b.liens ?? [], "Ieraksts");
  if (liens) {
    parts.push(subhead(ASV_SUBTITLES.liens));
    parts.push(liens);
  }
  const thefts = recordTable(b.thefts ?? [], "Ieraksts");
  if (thefts) {
    parts.push(subhead(ASV_SUBTITLES.thefts));
    parts.push(thefts);
  }
  return parts.filter(Boolean).join("\n");
}

export const ASV_PDF_CSS = CC_VIN_PDF_CSS;
