/**
 * CSDD tehnisko apskašu un īpašnieku maiņu vizualizācija (admin + PDF).
 */

import {
  effectiveInspectionSeverity,
  type CsddOwnerChangeRow,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";

const SEVERITY_COLORS: Record<1 | 2 | 3, string> = {
  1: "#16a34a",
  2: "#f59e0b",
  3: "#ef4444",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseDotDateYear(date: string): number | null {
  const m = date.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return Number(m[3]);
}

function groupInspectionsByYear(
  rows: CsddTechnicalInspectionRow[],
): Map<number, CsddTechnicalInspectionRow[]> {
  const map = new Map<number, CsddTechnicalInspectionRow[]>();
  for (const row of rows) {
    const y = parseDotDateYear(row.date);
    if (y == null) continue;
    const arr = map.get(y) ?? [];
    arr.push(row);
    map.set(y, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => {
      const da = a.date.split(".").reverse().join("");
      const db = b.date.split(".").reverse().join("");
      return db.localeCompare(da);
    });
  }
  return map;
}

function severityBadgeHtml(level: 1 | 2 | 3, date: string, compact: boolean): string {
  const color = SEVERITY_COLORS[level];
  const title = escapeHtml(date);
  const size = compact ? 18 : 22;
  const font = compact ? 9 : 10;
  return `<span class="pdf-csdd-sev-badge" title="${title}" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#fff;font-size:${font}px;font-weight:700;line-height:1;">${level}</span>`;
}

/** Gads + krāsaini novērtējumu bloki (1/2/3). */
export function buildTechnicalInspectionHistoryChartHtml(
  rows: CsddTechnicalInspectionRow[],
  opts?: { compact?: boolean },
): string {
  const data = rows.filter((r) => r.date.trim());
  if (data.length === 0) return "";

  const compact = opts?.compact === true;
  const byYear = groupInspectionsByYear(data);
  const years = [...byYear.keys()].sort((a, b) => b - a);

  const yearBlocks = years
    .map((year) => {
      const items = byYear.get(year) ?? [];
      const badges = items
        .map((row) => {
          const sev = effectiveInspectionSeverity(row);
          if (sev == null) {
            return `<span class="pdf-csdd-sev-badge pdf-csdd-sev-badge--muted" title="${escapeHtml(row.date)}">?</span>`;
          }
          return severityBadgeHtml(sev, row.date, compact);
        })
        .join("");
      return `<div class="pdf-csdd-ta-year-row" style="display:flex;align-items:center;gap:8px;margin:0 0 5px;font-size:11px;line-height:1.3;"><span class="pdf-csdd-ta-year-label" style="min-width:36px;font-weight:600;color:#475569;">${year}</span><span class="pdf-csdd-ta-badges" style="display:flex;flex-wrap:wrap;gap:4px;">${badges}</span></div>`;
    })
    .join("");

  const legend = `<div class="pdf-csdd-ta-legend" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;font-size:10px;color:#64748b;"><span style="display:inline-flex;align-items:center;gap:4px;"><i style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${SEVERITY_COLORS[1]}"></i>1 — pieļaujami</span><span style="display:inline-flex;align-items:center;gap:4px;"><i style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${SEVERITY_COLORS[2]}"></i>2 — labojami mēneša laikā</span><span style="display:inline-flex;align-items:center;gap:4px;"><i style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${SEVERITY_COLORS[3]}"></i>3 — būtiski</span></div>`;

  return `<div class="pdf-csdd-ta-chart${compact ? " pdf-csdd-ta-chart--compact" : ""}">${yearBlocks}${legend}</div>`;
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

/** Admin React — tā pati vizualizācija ar Tailwind-friendly klasēm. */
export function buildTechnicalInspectionHistoryChartAdminHtml(
  rows: CsddTechnicalInspectionRow[],
): string {
  return buildTechnicalInspectionHistoryChartHtml(rows, { compact: true });
}

export function buildOwnerRegistrationTimelineAdminHtml(
  ownerCount: string,
  events: CsddOwnerChangeRow[],
): string {
  return buildOwnerRegistrationTimelineHtml(ownerCount, events, { compact: true });
}
