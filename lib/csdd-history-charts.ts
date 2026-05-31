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
      return `<div class="pdf-csdd-ta-year-row"><span class="pdf-csdd-ta-year-label">${year}</span><span class="pdf-csdd-ta-badges">${badges}</span></div>`;
    })
    .join("");

  const legend = `<div class="pdf-csdd-ta-legend"><span><i style="background:${SEVERITY_COLORS[1]}"></i>1 — pieļaujami</span><span><i style="background:${SEVERITY_COLORS[2]}"></i>2 — labojami mēneša laikā</span><span><i style="background:${SEVERITY_COLORS[3]}"></i>3 — būtiski</span></div>`;

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
    ? `<p class="pdf-csdd-owner-count"><strong>${escapeHtml(ownerCount.trim())}</strong> īpašniek${ownerCount.trim() === "1" ? "s" : "i"} Latvijā</p>`
    : "";

  const rows = ev
    .map(
      (e) =>
        `<div class="pdf-csdd-owner-event"><span class="pdf-csdd-owner-date">${escapeHtml(e.date)}</span><span class="pdf-csdd-owner-label">${escapeHtml(e.label)}</span></div>`,
    )
    .join("");

  return `<div class="pdf-csdd-owner-timeline${compact ? " pdf-csdd-owner-timeline--compact" : ""}">${countHtml}${rows ? `<div class="pdf-csdd-owner-events">${rows}</div>` : ""}</div>`;
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
