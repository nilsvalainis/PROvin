/**
 * Starptautiskās vēstures sadaļa klienta PDF.
 *
 * Rāda tikai to, kas maina pircēja lēmumu: sarkanos karogus, bojājumus, norakstīšanas un
 * īpašumtiesību ierakstus, pārdošanas vēsturi. Specifikācijas un „nav ierakstu” pārbaudes
 * netiek drukātas - tās jau ir citās sadaļās vai nesniedz informāciju.
 */

import { buildThecarapiRecordsPdfHtml } from "@/lib/thecarapi-pdf";
import {
  CC_VIN_SUBTITLES,
  CC_VIN_UNIFIED_INCIDENT_CHECK_LABELS,
  ccVinAlertChecks,
  ccVinAmountToEurDisplay,
  ccVinDamageRowHasData,
  ccVinRecordRowHasData,
  ccVinSaleRowHasData,
  ccVinTitleRowHasData,
  type CcVinBlockState,
  type CcVinRecordRow,
} from "@/lib/cc-vin-report";

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

/** Kolonnas bez neviena datu lauka netiek drukātas - sadaļa nepiepildās ar „-”. */
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

/** „49890” → „49 890”; teksts, kas nav skaitlis, paliek nemainīts. */
function kmDisplay(raw: string): string {
  const t = raw.trim();
  const digits = t.replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d+$/.test(digits)) return t;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Brīdinājumi - tikai reģistri ar atzīmi; „tīrie” netiek uzskaitīti. */
function alertList(b: CcVinBlockState): string {
  const alerts = ccVinAlertChecks(b).filter((c) => !CC_VIN_UNIFIED_INCIDENT_CHECK_LABELS.has(c.label.trim()));
  if (alerts.length === 0) return "";
  const items = alerts
    .map(
      (c) =>
        `<li class="pdf-ccvin-flag"><span class="pdf-ccvin-flag-dot" aria-hidden="true"></span><span class="pdf-ccvin-flag-label">${escapeHtml(
          c.label.trim(),
        )}</span><span class="pdf-ccvin-flag-value">${escapeHtml(c.status.trim() || "atrasts ieraksts")}</span></li>`,
    )
    .join("");
  return `<ul class="pdf-ccvin-flags">${items}</ul>`;
}

function recordTable(rows: CcVinRecordRow[], labelHead: string): string {
  const data = rows.filter(ccVinRecordRowHasData);
  return logTable([labelHead, "Datums", "Detaļas"], data.map((r) => [r.label, r.date, r.detail]));
}

/** Kopsavilkuma rinda zem karogiem: atzīmju skaits un īpašnieku maiņas. */
function factLine(b: CcVinBlockState): string {
  const facts: string[] = [];
  const marks = b.attentionMarks.trim();
  if (marks) facts.push(`Reģistros ar atzīmēm: <strong>${escapeHtml(marks)}</strong>`);
  const owners = b.ownersCount.trim();
  if (owners) facts.push(`Īpašnieki ārvalstīs: <strong>${escapeHtml(owners)}</strong>`);
  const date = b.reportDate.trim();
  if (date) facts.push(`Datu stāvoklis uz <strong>${escapeHtml(date)}</strong>`);
  if (facts.length === 0) return "";
  return `<p class="pdf-ccvin-facts">${facts.join(" · ")}</p>`;
}

/**
 * Sadaļas iekšpuse (bez virsraksta joslas un komentāra salas - tos pievieno izsaucējs,
 * lai noformējums sakristu ar pārējiem avotiem).
 */
export function buildCcVinPdfInnerHtml(b: CcVinBlockState | null | undefined): string {
  if (!b) return "";
  const parts: string[] = [];

  const flags = alertList(b);
  const facts = factLine(b);
  if (flags || facts) {
    parts.push(subhead(CC_VIN_SUBTITLES.flags));
    if (flags) parts.push(flags);
    if (facts) parts.push(facts);
  }

  // Bojājumi ar summu jau parādās vienotajā „NEGADĪJUMU VĒSTURE” tabulā (unified-incidents.ts) -
  // šeit paliek tikai tie, kam nav summas, lai tas pats ieraksts nedublējas divās PDF vietās.
  const damages = (b.damages ?? []).filter((r) => ccVinDamageRowHasData(r) && !r.amount.trim());
  if (damages.length > 0) {
    parts.push(subhead(CC_VIN_SUBTITLES.damages));
    parts.push(
      logTable(
        ["Datums", "Bojājums", "Vieta"],
        damages.map((r) => [r.date, r.description, r.region]),
      ),
    );
  }

  const brands = recordTable(b.brands ?? [], "Atzīme");
  if (brands) {
    parts.push(subhead(CC_VIN_SUBTITLES.brands));
    parts.push(brands);
  }

  const insurance = recordTable(b.insurance ?? [], "Reģistrs");
  if (insurance) {
    parts.push(subhead(CC_VIN_SUBTITLES.insurance));
    parts.push(insurance);
  }

  const titles = (b.titles ?? []).filter(ccVinTitleRowHasData);
  if (titles.length > 0) {
    parts.push(subhead(CC_VIN_SUBTITLES.titles));
    parts.push(
      logTable(
        ["Datums", "Reģions", "Odometrs, km", "Piezīme"],
        titles.map((r) => [r.date, r.region, kmDisplay(r.odometer), r.note]),
      ),
    );
  }

  const sales = (b.sales ?? []).filter(ccVinSaleRowHasData);
  if (sales.length > 0) {
    parts.push(subhead(CC_VIN_SUBTITLES.sales));
    parts.push(
      logTable(
        ["Datums", "Vieta", "Odometrs, km", "Cena", "Statuss"],
        sales.map((r) => [r.date, r.venue, kmDisplay(r.odometer), ccVinAmountToEurDisplay(r.price) || r.price, r.status]),
      ),
    );
  }

  const thecarapiHtml = buildThecarapiRecordsPdfHtml(b.thecarapiRecords);
  if (thecarapiHtml) parts.push(thecarapiHtml);

  return parts.join("\n");
}

/** Sadaļas CSS - mērogs un krāsas seko PDF dizaina marķieriem. */
export const CC_VIN_PDF_CSS = `
      .pdf-ccvin-flags{list-style:none;margin:0 0 1em;padding:0;display:block}
      .pdf-ccvin-flag{
        display:flex;align-items:baseline;gap:8px;padding:6px 0;
        border-bottom:1px solid var(--pdf-line-soft);font-size:var(--pdf-fs-table);
      }
      .pdf-ccvin-flag:last-child{border-bottom:none}
      .pdf-ccvin-flag-dot{
        width:7px;height:7px;border-radius:50%;background:#DC2626;flex:0 0 auto;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-ccvin-flag-label{flex:1 1 auto;color:#0f172a;font-weight:600}
      .pdf-ccvin-flag-value{flex:0 0 auto;color:#B91C1C;font-weight:600;text-align:right}
      .pdf-ccvin-facts{margin:0 0 4px;font-size:var(--pdf-fs-label);color:#86868b;line-height:1.5}
      .pdf-tc-lot{margin:4px 0 14px}
      .pdf-tc-head{
        margin:10px 0 8px;padding:7px 12px;border-left:3px solid #0061D2;border-radius:0 8px 8px 0;
        background:#F3F8FE;font-size:var(--pdf-fs-base);font-weight:700;color:#0f172a;line-height:1.35;
        break-after:avoid;page-break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-tc-tiles{grid-template-columns:repeat(4,1fr)!important;gap:6px 8px!important;margin:0 0 4px!important}
      .pdf-tc-tile{padding:8px 10px!important}
      .pdf-tc-tile .pdf-summary-tile__value{margin-top:4px!important;font-size:14px!important;white-space:nowrap}
      .pdf-tc-tile.pdf-summary-tile--info .pdf-summary-tile__label::before{background:#0061D2}
      .pdf-tc-tile.pdf-summary-tile--warn .pdf-summary-tile__value{color:#B45309}
      .pdf-tc-sec{break-inside:auto}
      .pdf-tc-lot .pdf-subhead{margin:12px 0 6px;break-after:avoid;page-break-after:avoid}
      .pdf-tc-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:0 18px;align-items:start;break-inside:avoid;page-break-inside:avoid}
      .pdf-tc-facts{
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 14px;margin:0 0 4px;
      }
      .pdf-tc-fact{min-width:0;break-inside:avoid;page-break-inside:avoid}
      .pdf-tc-fact__lab{
        margin:0;font-size:var(--pdf-fs-fine);font-weight:600;color:#86868b;letter-spacing:0.05em;
        text-transform:uppercase;line-height:1.3;
      }
      .pdf-tc-fact__val{margin:1px 0 0;font-size:var(--pdf-fs-table);font-weight:700;color:#0f172a;line-height:1.3;overflow-wrap:anywhere}
      .pdf-tc-facts--light{gap:4px 14px}
      .pdf-tc-facts--light .pdf-tc-fact__val{font-weight:500;color:#334155}
      .pdf-tc-chips{display:flex;flex-wrap:wrap;gap:4px;margin:0}
      .pdf-tc-chip{
        display:inline-block;padding:2px 7px;border-radius:999px;border:1px solid #E2E8F0;background:#F8FAFC;
        color:#475569;font-size:var(--pdf-fs-label);font-weight:600;line-height:1.35;white-space:nowrap;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-tc-chip--ok{background:#F5FBF7;border-color:#BBE5C8;color:#15803d}
      .pdf-tc-chip--warn{background:#FFF8E6;border-color:#F5D58A;color:#B45309}
      .pdf-tc-chip--alert{background:#FEF2F2;border-color:#FBC9C9;color:#B91C1C}
      .pdf-tc-chip--zone{background:rgba(0,97,210,0.08);border-color:rgba(0,97,210,0.25);color:#0061D2;border-radius:6px}
      .pdf-tc-ladder{display:flex;flex-wrap:wrap;align-items:center;gap:5px;break-inside:avoid;page-break-inside:avoid}
      .pdf-tc-price{
        padding:5px 9px;border:1px solid var(--pdf-line);border-radius:8px;background:#fff;
        break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-tc-price__lab{margin:0;font-size:var(--pdf-fs-fine);font-weight:600;color:#86868b;letter-spacing:0.04em;text-transform:uppercase;line-height:1.25;white-space:nowrap}
      .pdf-tc-price__val{margin:1px 0 0;font-size:var(--pdf-fs-base);font-weight:700;color:#0f172a;line-height:1.25;white-space:nowrap}
      .pdf-tc-price--final{border-color:#0061D2;background:#F3F8FE}
      .pdf-tc-price--final .pdf-tc-price__lab,.pdf-tc-price--final .pdf-tc-price__val{color:#0061D2}
      .pdf-tc-arrow{color:#94a3b8;font-weight:700;font-size:var(--pdf-fs-base)}
      .pdf-tc-odos{display:flex;flex-direction:column;gap:5px}
      .pdf-tc-odo{break-inside:avoid;page-break-inside:avoid}
      .pdf-tc-odo__val{margin:0;font-size:var(--pdf-fs-table);color:#0f172a;line-height:1.5}
      .pdf-tc-odo__val strong{font-size:var(--pdf-fs-base);font-weight:700;margin-right:3px}
      .pdf-tc-total{margin:0 0 6px}
      .pdf-tc-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px;margin:0 0 4px}
      .pdf-tc-card{
        padding:7px 10px;border:1px solid var(--pdf-line);border-radius:8px;background:#fff;min-width:0;
        break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-tc-card__top{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:0 0 4px}
      .pdf-tc-dmg__line + .pdf-tc-dmg__line{margin-top:5px;padding-top:5px;border-top:1px solid var(--pdf-line-soft)}
      .pdf-tc-dmg__part{margin:0 0 3px;font-size:var(--pdf-fs-table);font-weight:700;color:#0f172a;line-height:1.3}
      .pdf-tc-dmg__note{margin:3px 0 0;font-size:var(--pdf-fs-label);color:#64748b;line-height:1.35}
      .pdf-tc-zone{margin:10px 0 5px;font-size:var(--pdf-fs-label);font-weight:600;color:#0f172a;break-after:avoid;page-break-after:avoid}
      .pdf-tc-paint{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px 8px}
      .pdf-tc-paint__cell{
        display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0;
        padding:3px 0;border-bottom:1px solid var(--pdf-line-soft);break-inside:avoid;
      }
      .pdf-tc-paint__lab{margin:0;min-width:0;font-size:var(--pdf-fs-label);color:#475569;line-height:1.25}
      .pdf-tc-legend{margin:5px 0 0;font-size:var(--pdf-fs-fine);color:#64748b;line-height:1.4}
      .pdf-tc-dot{
        display:inline-block;width:7px;height:7px;border-radius:999px;margin:0 4px 0 10px;vertical-align:0.05em;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-tc-dot:first-child{margin-left:0}
      .pdf-tc-dot--ok{background:#16a34a}.pdf-tc-dot--warn{background:#FFC107}.pdf-tc-dot--alert{background:#FF4D4D}
      .pdf-tc-wheels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
      .pdf-tc-wheel__name{font-size:var(--pdf-fs-label);font-weight:700;color:#0f172a;line-height:1.25}
      .pdf-tc-wheel__vals{margin:0;font-size:var(--pdf-fs-label);color:#475569;line-height:1.4}
      .pdf-tc-eq{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px}
      .pdf-tc-eq__group{break-inside:avoid;page-break-inside:avoid;min-width:0}
      .pdf-tc-eq__chips{margin-top:3px!important;gap:4px!important}
      .pdf-tc-eq__chips li{padding:2px 7px!important;font-size:var(--pdf-fs-label)!important}
      .pdf-tc-docs{margin:6px 0 0;break-inside:avoid;page-break-inside:avoid}
      .pdf-tc-docs .pdf-tc-chips{margin-top:3px}
      .pdf-tc-lot .pdf-tc-grid{margin:6px 0}
      .pdf-tc-lot .pdf-v1-kv{font-size:var(--pdf-fs-label)}
      .pdf-tc-lot .pdf-tc-grid th,.pdf-tc-lot .pdf-tc-grid td{padding:3px 6px 3px 0;line-height:1.35}
      .pdf-tc-warn{color:#B91C1C !important;font-weight:600}
`;
