/**
 * CarVertical — laikposma un bojājumu grafiki (admin + PDF).
 */

import type { CarVerticalDamageDetailRow, CarVerticalTimelineRow } from "@/lib/carvertical-pdf-parse";
import { CARVERTICAL_TIMELINE_TITLE } from "@/lib/carvertical-pdf-parse";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCarVerticalTimelineHtml(
  rows: CarVerticalTimelineRow[],
  opts?: { compact?: boolean },
): string {
  const ev = rows.filter((r) => r.date.trim() || r.description.trim());
  if (ev.length === 0) return "";

  const compact = opts?.compact === true;
  const body = ev
    .map((e) => {
      const country = e.country.trim()
        ? `<span class="pdf-cv-timeline-country">${escapeHtml(e.country.trim())}</span>`
        : "";
      return `<div class="pdf-cv-timeline-event"><span class="pdf-cv-timeline-date">${escapeHtml(e.date)}</span>${country}<span class="pdf-cv-timeline-desc">${escapeHtml(e.description)}</span></div>`;
    })
    .join("");

  return `<div class="pdf-cv-timeline${compact ? " pdf-cv-timeline--compact" : ""}"><p class="pdf-cv-subsection-title">${escapeHtml(CARVERTICAL_TIMELINE_TITLE)}</p><div class="pdf-cv-timeline-events">${body}</div></div>`;
}

export function buildCarVerticalDamageDetailsHtml(rows: CarVerticalDamageDetailRow[]): string {
  const data = rows.filter((r) => r.date.trim() || r.lossAmount.trim() || r.damagedSides.trim());
  if (data.length === 0) return "";

  const body = data
    .map((r) => {
      const parts = [
        `<span class="pdf-cv-damage-date">${escapeHtml(r.date.trim() || "—")}</span>`,
        r.damagedSides.trim()
          ? `<span class="pdf-cv-damage-sides">${escapeHtml(r.damagedSides.trim())}</span>`
          : "",
        r.damageGroups.trim()
          ? `<span class="pdf-cv-damage-groups">${escapeHtml(r.damageGroups.trim())}</span>`
          : "",
      ].filter(Boolean);
      return `<div class="pdf-cv-damage-row">${parts.join("")}</div>`;
    })
    .join("");

  return `<div class="pdf-cv-damage-chart"><div class="pdf-cv-damage-chart-head"><span>Datums</span><span>Bojātā puse</span><span>Bojājumu grupas</span></div>${body}</div>`;
}
