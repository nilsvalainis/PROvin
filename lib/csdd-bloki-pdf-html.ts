/**
 * Klienta PDF: jaunie e.csdd bloki (tikai, ja admin ķeksis «Rādīt PDF» ieslēgts).
 * Esošās PDF sadaļas nemainās - šie ir papildu fragmenti CSDD zonā un kopsavilkuma kartītes.
 * Teksti uzreiz atskaites valodā (LV/EN/RU/DE); CSDD formulējumi (defektu apraksti, aizliegumu teksts) - oriģinālā.
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  buildCsddBloki,
  CSDD_BRAKE_DIFF_WARN_PCT,
  csddBlokiT,
  csddDefectNodeLabel,
  csddMeasurementsHasData,
  csddSourceRef,
  csddTaCodesLabel,
  csddTaInspectionsCount,
  buildCsddTaRepeatSentence,
  formatNum,
  type CsddBloki,
  type CsddMeasurements,
  type CsddTaAnalysis,
} from "@/lib/csdd-bloki";
import type { PdfSummaryTile } from "@/lib/pdf-report-summary";
import type { CsddPdfBlokiFlags } from "@/lib/pdf-visibility";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function head(title: string, src: string): string {
  return `<p class="pdf-subhead pdf-csddx-head"><span>${esc(title)}</span><span class="pdf-csddx-src">${esc(src)}</span></p>`;
}

/** Kopsavilkuma kartītes (esošais tile stils) - brīdinājumi pirms esošajām kartītēm. */
export function buildCsddWarningSummaryTiles(
  csdd: CsddFormFields | null | undefined,
  lang: ClientReportLang,
  nowMs: number = Date.now(),
): PdfSummaryTile[] {
  const b = buildCsddBloki(csdd, lang, nowMs);
  if (!b) return [];
  const src = csddSourceRef(b.infoDate);
  return b.warnings.map((w) => ({
    id: `csdd-${w.id}`,
    label: w.label,
    value: w.value,
    note: "",
    noteSegments: [w.note, src].filter(Boolean),
    tone: w.tone,
  }));
}

export function buildCsddRestrictionsPdfHtml(b: CsddBloki, lang: ClientReportLang): string {
  const r = b.restrictions;
  const src = r.allMissing ? csddBlokiT("sectionMissing", lang) : csddSourceRef(b.infoDate);
  const rows = r.rows
    .map((row) => {
      const label = csddBlokiT(row.key, lang);
      const v =
        row.state === "not_checked"
          ? `<span class="pdf-csddx-muted">${esc(csddBlokiT("notChecked", lang))}</span>`
          : row.state === "none"
            ? esc(csddBlokiT("none", lang))
            : `<span class="pdf-csddx-bad">${esc(row.text)}</span>`;
      return `<tr><td class="pdf-csddx-k">${esc(label)}</td><td class="pdf-csddx-v">${v}</td></tr>`;
    })
    .join("");
  return `<div class="pdf-csdd-ta-section pdf-csddx" data-csdd-bloks="restrictions">${head(csddBlokiT("restrictionsTitle", lang), src)}<table class="pdf-csddx-kv"><tbody>${rows}</tbody></table></div>`;
}

export function buildCsddMeasurementsPdfHtml(m: CsddMeasurements, infoDate: string, lang: ClientReportLang): string {
  // Dūmainība / daļiņas jau ir esošajā CSDD tabulā - PDF tās neatkārto.
  if (!csddMeasurementsHasData({ ...m, smoke: "", particles: "" })) return "";
  const n = (v: string) => formatNum(v, lang);
  const cells: { k: string; v: string }[] = [];
  if (m.co2) cells.push({ k: `${csddBlokiT("co2", lang)}${m.co2Cycle ? ` (${m.co2Cycle})` : ""}`, v: `${n(m.co2)} g/km` });
  if (m.consumption || m.consumptionCity) {
    const parts = [m.consumption ? `${n(m.consumption)} l/100 km` : "", m.consumptionCity ? `${csddBlokiT("city", lang)} ${n(m.consumptionCity)}` : ""].filter(Boolean);
    cells.push({ k: `${csddBlokiT("consumption", lang)}${m.consumptionCycle ? ` (${m.consumptionCycle})` : ""}`, v: parts.join(" · ") });
  }
  if (m.euro) cells.push({ k: csddBlokiT("euro", lang), v: m.euro });
  if (m.co || m.coHigh) {
    const parts = [m.co ? `${n(m.co)} %` : "", m.coHigh ? `${csddBlokiT("coHigh", lang)} ${n(m.coHigh)} %` : ""].filter(Boolean);
    cells.push({ k: csddBlokiT("co", lang), v: parts.join(" · ") });
  }
  if (m.hc) cells.push({ k: csddBlokiT("hc", lang), v: `${n(m.hc)} ppm` });
  if (m.lambda) cells.push({ k: csddBlokiT("lambda", lang), v: n(m.lambda) });
  const src = [m.taDate ? `${csddBlokiT("ta", lang)} ${m.taDate}` : "", csddSourceRef(infoDate)].filter(Boolean).join(" · ");
  const grid = cells.length
    ? `<ul class="pdf-csddx-grid">${cells.map((c) => `<li><span class="pdf-csddx-gk">${esc(c.k)}</span><span class="pdf-csddx-gv">${esc(c.v)}</span></li>`).join("")}</ul>`
    : "";
  const brakes = m.brakes.length
    ? `<p class="pdf-csddx-minihead">${esc(csddBlokiT("brakesTitle", lang))}</p><table class="pdf-csddx-tbl"><thead><tr><th>${esc(csddBlokiT("axle", lang))}</th><th>${esc(csddBlokiT("left", lang))}</th><th>${esc(csddBlokiT("right", lang))}</th><th>${esc(csddBlokiT("diff", lang))}</th><th>${esc(csddBlokiT("brakeType", lang))}</th></tr></thead><tbody>${m.brakes
        .map(
          (r) =>
            `<tr><td>${esc(r.axle)}</td><td>${esc(n(r.left))}</td><td>${esc(n(r.right))}</td><td${r.diffPct != null && r.diffPct > CSDD_BRAKE_DIFF_WARN_PCT ? ' class="pdf-csddx-warn"' : ""}>${r.diffPct != null ? `${r.diffPct} %` : ""}</td><td>${esc(r.type)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";
  return `<div class="pdf-csdd-ta-section pdf-csddx" data-csdd-bloks="measurements">${head(csddBlokiT("measurementsTitle", lang), src)}${grid}${brakes}</div>`;
}

export function buildCsddTaAnalysisPdfHtml(ta: CsddTaAnalysis, infoDate: string, lang: ClientReportLang): string {
  if (ta.inspectionCount === 0) return "";
  const range = ta.years.length ? (ta.years.length > 1 ? `${ta.years[0]}-${ta.years[ta.years.length - 1]}` : String(ta.years[0])) : "";
  const src = [csddSourceRef(infoDate), range].filter(Boolean).join(" · ");
  const stats = [
    [csddBlokiT("taCount", lang), String(ta.inspectionCount), ""],
    [csddBlokiT("taRating2", lang), csddTaInspectionsCount(ta.rating2Count, lang), ""],
    [csddBlokiT("taRating3", lang), csddTaInspectionsCount(ta.rating3Count, lang), ta.rating3Count > 0 ? "bad" : ""],
    [csddBlokiT("taReinspections", lang), String(ta.reinspectionCount), ""],
  ]
    .map(([k, v, tone]) => `<li><span class="pdf-csddx-gk">${esc(k!)}</span><span class="pdf-csddx-gv${tone ? ` pdf-csddx-${tone}` : ""}">${esc(v!)}</span></li>`)
    .join("");
  const sentence = buildCsddTaRepeatSentence(ta, lang);
  const fact = sentence ? `<p class="pdf-csddx-fact">${esc(sentence)}</p>` : "";
  let table = "";
  if (ta.repeated.length > 0) {
    const cols = ta.years.length + 2;
    const th = ta.years.map((y) => `<th class="pdf-csddx-ty"><span class="pdf-csddx-yy">${y}</span></th>`).join("");
    const body = ta.repeated
      .map((r) => {
        const cells = ta.years
          .map((y) => {
            const v = r.byYear[y];
            return v ? `<td class="pdf-csddx-c"><span class="pdf-csddx-chip pdf-csddx-r${v}">${v}</span></td>` : `<td class="pdf-csddx-c"><span class="pdf-csddx-nodot">·</span></td>`;
          })
          .join("");
        const codes = csddTaCodesLabel(r.codes, lang);
        const latest = r.latestText
          ? `<tr class="pdf-csddx-q"><td colspan="${cols}"><span class="pdf-csddx-qd">${esc(csddBlokiT("taLatest", lang, { d: r.latestDate }))}</span> «${esc(r.latestText)}»</td></tr>`
          : "";
        return `<tr class="pdf-csddx-row"><td class="pdf-csddx-nd"><span class="pdf-csddx-nn">${esc(csddDefectNodeLabel(r.key, lang))}</span>${codes ? `<span class="pdf-csddx-code">${esc(codes)}</span>` : ""}</td>${cells}<td class="pdf-csddx-cnt">${r.yearCount} <span>${esc(csddBlokiT("taYearsOf", lang, { m: ta.years.length }))}</span></td></tr>${latest}`;
      })
      .join("");
    const legend = `<p class="pdf-csddx-legend"><span class="pdf-csddx-lh">${esc(csddBlokiT("legendTitle", lang))}</span>${([1, 2, 3] as const)
      .map((v) => `<span><span class="pdf-csddx-chip pdf-csddx-r${v}">${v}</span> ${esc(csddBlokiT(`legend${v}`, lang))}</span>`)
      .join("")}<span><span class="pdf-csddx-nodot">·</span> ${esc(csddBlokiT("legend0", lang))}</span></p>`;
    table = `<table class="pdf-csddx-m"><thead><tr><th class="pdf-csddx-nh">${esc(csddBlokiT("taDefectCol", lang))}</th>${th}<th class="pdf-csddx-cnth">${esc(csddBlokiT("taYearsCol", lang))}</th></tr></thead><tbody>${body}</tbody></table>${legend}`;
  }
  const notes = ta.notes.length
    ? `<p class="pdf-csddx-minihead">${esc(csddBlokiT("taNotes", lang))}</p><table class="pdf-csddx-notes"><tbody>${ta.notes
        .map((n) => `<tr><td><span class="pdf-csddx-ndt">${esc(n.dates.join(", "))}</span> - ${esc(n.text)}</td></tr>`)
        .join("")}</tbody></table>`
    : "";
  return `<div class="pdf-csdd-ta-section pdf-csddx" data-csdd-bloks="ta">${head(csddBlokiT("taTitle", lang), src)}<ul class="pdf-csddx-grid pdf-csddx-grid--4">${stats}</ul>${fact}${table}${notes}</div>`;
}

export type CsddBlokiPdfParts = {
  /** Pēc CSDD tehnisko datu tabulas: aizliegumi + mērījumi. */
  afterTable: string;
  /** Pirms iepriekšējās apskates / TA vēstures: TA defektu analīze. */
  beforeInspections: string;
};

export function buildCsddBlokiPdfParts(
  csdd: CsddFormFields | null | undefined,
  flags: CsddPdfBlokiFlags,
  lang: ClientReportLang,
  nowMs: number = Date.now(),
): CsddBlokiPdfParts {
  const none = { afterTable: "", beforeInspections: "" };
  if (!flags.csddPdfRestrictions && !flags.csddPdfMeasurements && !flags.csddPdfTaAnalysis) return none;
  const b = buildCsddBloki(csdd, lang, nowMs);
  if (!b) return none;
  return {
    afterTable: [
      flags.csddPdfRestrictions ? buildCsddRestrictionsPdfHtml(b, lang) : "",
      flags.csddPdfMeasurements ? buildCsddMeasurementsPdfHtml(b.measurements, b.infoDate, lang) : "",
    ].join(""),
    beforeInspections: flags.csddPdfTaAnalysis ? buildCsddTaAnalysisPdfHtml(b.ta, b.infoDate, lang) : "",
  };
}

export const CSDD_BLOKI_PDF_CSS = `
.pdf-csddx-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;}
.pdf-csddx-src{font-weight:500;letter-spacing:0;text-transform:none;color:#86868b;font-size:9.5px;}
.pdf-csddx-kv{width:100%;border-collapse:collapse;font-size:var(--pdf-fs-table,10.5px);}
.pdf-csddx-kv td{padding:5px 0;border-bottom:1px solid #F1F5F9;vertical-align:top;line-height:1.45;}
.pdf-csddx-k{color:#64748b;width:46%;}
.pdf-csddx-v{font-weight:600;color:#0f172a;}
.pdf-csddx-muted{color:#94a3b8;font-weight:500;}
.pdf-csddx-bad{color:#B91C1C;font-weight:700;}
.pdf-csddx-warn{color:#B45309;font-weight:700;}
.pdf-csddx-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 10px;}
.pdf-csddx-grid--4{grid-template-columns:repeat(4,minmax(0,1fr));}
.pdf-csddx-grid li{border:1px solid #E9EDF3;border-radius:8px;padding:6px 9px;min-width:0;break-inside:avoid;}
.pdf-csddx-gk{display:block;font-size:9px;font-weight:600;color:#86868b;letter-spacing:.05em;text-transform:uppercase;}
.pdf-csddx-gv{display:block;margin-top:2px;font-size:11.5px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;}
.pdf-csddx-minihead{margin:10px 0 4px;font-size:9.5px;font-weight:700;color:#64748b;letter-spacing:.06em;text-transform:uppercase;}
.pdf-csddx-tbl{width:100%;border-collapse:collapse;font-size:var(--pdf-fs-table,10.5px);margin-top:8px;font-variant-numeric:tabular-nums;}
.pdf-csddx-tbl th{font-size:9px;font-weight:600;color:#86868b;text-align:left;padding:3px 4px;border-bottom:1px solid #E9EDF3;}
.pdf-csddx-tbl td{padding:4px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}
.pdf-csddx-fact{margin:12px 0 2px;font-size:11.5px;line-height:1.5;color:#0f172a;}
.pdf-csddx-m{width:100%;border-collapse:collapse;margin-top:8px;font-variant-numeric:tabular-nums;table-layout:fixed;}
.pdf-csddx-m th{font-weight:600;color:#86868b;text-align:center;padding:4px 2px 6px;border-bottom:1px solid #E9EDF3;vertical-align:bottom;}
.pdf-csddx-m th.pdf-csddx-nh{text-align:left;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;width:30%;padding-left:0;}
.pdf-csddx-yy{display:block;font-size:10.5px;font-weight:700;color:#0f172a;}
.pdf-csddx-m th.pdf-csddx-cnth{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;width:66px;line-height:1.25;white-space:normal;text-align:right;padding-right:0;}
.pdf-csddx-nd{padding:8px 6px 2px 0;vertical-align:middle;}
.pdf-csddx-nn{display:block;font-size:11px;font-weight:700;color:#0f172a;line-height:1.3;}
.pdf-csddx-code{display:block;font-size:8.5px;color:#94a3b8;font-weight:500;margin-top:1px;}
.pdf-csddx-c{text-align:center;vertical-align:middle;padding:8px 2px 2px;}
.pdf-csddx-nodot{color:#CBD5E1;font-weight:700;font-size:18px;line-height:1;}
.pdf-csddx-cnt{text-align:right;font-size:11px;font-weight:700;color:#0f172a;padding:8px 0 2px;vertical-align:middle;white-space:nowrap;}
.pdf-csddx-cnt span{font-weight:500;color:#94a3b8;font-size:9px;}
.pdf-csddx-q td{padding:2px 0 8px;font-size:9.5px;color:#64748b;line-height:1.4;border-bottom:1px solid #F1F5F9;}
.pdf-csddx-qd{color:#86868b;font-weight:600;}
.pdf-csddx-chip{display:inline-flex;align-items:center;justify-content:center;width:26px;height:20px;border-radius:6px;font-size:11px;font-weight:700;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;}
.pdf-csddx-r1{background:#F5FBF7;color:#16a34a;}
.pdf-csddx-r2{background:#FFFBEB;color:#d97706;}
.pdf-csddx-r3{background:#FEF2F2;color:#dc2626;}
.pdf-csddx-legend{display:flex;flex-wrap:wrap;gap:4px 11px;margin:8px 0 0;font-size:9.5px;color:#64748b;align-items:center;}
.pdf-csddx-legend > span{display:inline-flex;align-items:center;gap:5px;}
.pdf-csddx-legend .pdf-csddx-chip{width:20px;height:16px;font-size:10px;border-radius:5px;}
.pdf-csddx-lh{font-weight:600;color:#64748b;}
.pdf-csddx-notes{width:100%;border-collapse:collapse;font-size:10.5px;}
.pdf-csddx-notes td{padding:5px 0;border-bottom:1px solid #F1F5F9;vertical-align:top;line-height:1.45;color:#0f172a;}
.pdf-csddx-notes tr:last-child td{border-bottom:none;}
.pdf-csddx-ndt{color:#86868b;font-weight:600;}
.pdf-csddx{break-inside:avoid;page-break-inside:avoid;}
`;
