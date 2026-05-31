/**
 * CSDD īpašnieku maiņu laika līnija (admin + PDF).
 */

import type { CsddOwnerChangeRow } from "@/lib/csdd-extended-parse";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Īpašnieku maiņu laika līnija. */
export function buildOwnerRegistrationTimelineHtml(
  ownerCount: string,
  events: CsddOwnerChangeRow[],
  opts?: { compact?: boolean },
): string {
  const ev = events.filter((e) => e.date.trim() || e.label.trim());
  if (!ownerCount.trim() && ev.length === 0) return "";

  const compact = opts?.compact === true;
  const countHtml = ownerCount.trim()
    ? `<p class="pdf-csdd-owner-count" style="margin:0 0 6px;font-size:11px;color:#1d1d1f;"><strong>${escapeHtml(ownerCount.trim())}</strong> īpašniek${ownerCount.trim() === "1" ? "s" : "i"} Latvijā</p>`
    : "";

  const rows = ev
    .map(
      (e) =>
        `<div class="pdf-csdd-owner-event" style="display:flex;gap:8px;font-size:11px;line-height:1.35;margin:0 0 2px;"><span class="pdf-csdd-owner-date" style="min-width:72px;font-weight:600;color:#475569;">${escapeHtml(e.date)}</span><span class="pdf-csdd-owner-label" style="color:#1d1d1f;">${escapeHtml(e.label)}</span></div>`,
    )
    .join("");

  return `<div class="pdf-csdd-owner-timeline${compact ? " pdf-csdd-owner-timeline--compact" : ""}" style="margin:4px 0;padding:8px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;">${countHtml}${rows ? `<div class="pdf-csdd-owner-events">${rows}</div>` : ""}</div>`;
}

export function buildOwnerRegistrationTimelineAdminHtml(
  ownerCount: string,
  events: CsddOwnerChangeRow[],
): string {
  return buildOwnerRegistrationTimelineHtml(ownerCount, events, { compact: true });
}
