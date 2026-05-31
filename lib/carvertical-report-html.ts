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

/** Divu kolonnu apakštabula zem CarVertical negadījuma rindas (bez datuma dublikāta). */
export function buildCarVerticalIncidentDamageSubHtml(
  detail: Pick<CarVerticalDamageDetailRow, "damagedSides" | "damageGroups">,
): string {
  const sides = detail.damagedSides.trim() || "—";
  const groups = detail.damageGroups.trim() || "—";
  return `<div class="pdf-cv-damage-sub"><div class="pdf-cv-damage-sub-head"><span>Bojātā puse</span><span>Bojājumu grupas</span></div><div class="pdf-cv-damage-sub-row"><span class="pdf-cv-damage-sides">${escapeHtml(sides)}</span><span class="pdf-cv-damage-groups">${escapeHtml(groups)}</span></div></div>`;
}

/** @deprecated Apvienotajā negadījumu tabulā izmanto buildCarVerticalIncidentDamageSubHtml zem rindas. */
export function buildCarVerticalDamageDetailsHtml(rows: CarVerticalDamageDetailRow[]): string {
  const data = rows.filter((r) => r.damagedSides.trim() || r.damageGroups.trim());
  if (data.length === 0) return "";
  return data.map((r) => buildCarVerticalIncidentDamageSubHtml(r)).join("");
}
