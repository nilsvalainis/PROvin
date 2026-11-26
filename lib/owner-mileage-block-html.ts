/**
 * Bloks «Īpašnieki un nobraukums» - HTML (klienta PDF CSDD sadaļā + admin CSDD blokā).
 * Makets: F9 (kolonnas ar mūža joslu galvenē) + 3 baneri augšā (Nils 24.11.2026).
 * Baneros tikai virsraksts + viens skaitlis; kolonnā tikai ilgums, periods un km («-», ja nav zināms).
 */

import {
  ownerMileageDuration,
  ownerMileageOwnerLabel,
  ownerMileageOwnersCount,
  ownerMileageT,
  type ClientReportLang,
} from "@/lib/client-report-i18n";
import { countryLabelToIso2, normalizeCountryName } from "@/lib/country-names-lv";
import { pdfCountryFlagEmoji } from "@/lib/pdf-country-flags";
import type { CsddFormFields } from "@/lib/admin-source-blocks";
import {
  buildOwnerMileagePeriods,
  ownerMileageColumns,
  ownerMileageInputFromCsdd,
  ownerMileageReadingsFromUnifiedRows,
  type OwnerMileageCountryRecord,
  type OwnerMileagePeriod,
  type OwnerMileageReading,
  type OwnerMileageResult,
} from "@/lib/owner-mileage-periods";
import { collectUnifiedMileageRows, prepareUnifiedMileageDisplayRows } from "@/lib/unified-mileage";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Vienkāršie svītru karogi (kā maketā); pārējām valstīm - emocijzīme. */
const STRIPE_FLAGS: Record<string, { v?: boolean; c: [string, number?][] }> = {
  LV: { v: true, c: [["#9e3039", 2], ["#fff", 1], ["#9e3039", 2]] },
  DE: { v: true, c: [["#111"], ["#dd0000"], ["#ffce00"]] },
  IT: { c: [["#009246"], ["#fff"], ["#ce2b37"]] },
  FR: { c: [["#0055a4"], ["#fff"], ["#ef4135"]] },
  BE: { c: [["#111"], ["#fdda24"], ["#ef3340"]] },
  IE: { c: [["#169b62"], ["#fff"], ["#ff883e"]] },
  RO: { c: [["#002b7f"], ["#fcd116"], ["#ce1126"]] },
  NL: { v: true, c: [["#ae1c28"], ["#fff"], ["#21468b"]] },
  LU: { v: true, c: [["#ed2939"], ["#fff"], ["#00a1de"]] },
  LT: { v: true, c: [["#fdb913"], ["#006a44"], ["#c1272d"]] },
  EE: { v: true, c: [["#0072ce"], ["#111"], ["#fff"]] },
  AT: { v: true, c: [["#ed2939"], ["#fff"], ["#ed2939"]] },
  PL: { v: true, c: [["#fff"], ["#dc143c"]] },
  HU: { v: true, c: [["#ce2939"], ["#fff"], ["#477050"]] },
  BG: { v: true, c: [["#fff"], ["#00966e"], ["#d62612"]] },
  UA: { v: true, c: [["#0057b7"], ["#ffd700"]] },
  ES: { v: true, c: [["#aa151b", 1], ["#f1bf00", 2], ["#aa151b", 1]] },
};

export function ownerMileageFlagHtml(countryOrIso: string): string {
  const iso = /^[A-Z]{2}$/.test(countryOrIso) ? countryOrIso : countryLabelToIso2(countryOrIso);
  if (!iso) return "";
  const f = STRIPE_FLAGS[iso];
  if (f) {
    const stripes = f.c.map(([bg, flex]) => `<i style="background:${bg}${flex ? `;flex:${flex}` : ""}"></i>`).join("");
    return `<span class="pdf-own-flag${f.v ? " pdf-own-flag--v" : ""}" aria-hidden="true">${stripes}</span>`;
  }
  const emoji = pdfCountryFlagEmoji(countryOrIso);
  return emoji ? `<span class="pdf-own-flag-emoji" aria-hidden="true">${emoji}</span>` : "";
}

function nf(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function monthLabel(t: number): string {
  const d = new Date(t);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function dateLabel(t: number): string {
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

/** Ārvalstu kolonnas virsraksts + karogs. */
export function ownerMileageAbroadLabel(p: OwnerMileagePeriod, lang: ClientReportLang): { label: string; flag: string } {
  if (p.countryUnknown) return { label: ownerMileageT("abroadUnknown", lang), flag: "" };
  if (!p.country) return { label: ownerMileageT("abroad", lang), flag: "" };
  const name = normalizeCountryName(p.country, lang);
  const label = p.countryProvenFromT
    ? `${name} (${ownerMileageT("provenFrom", lang)} ${new Date(p.countryProvenFromT).getUTCFullYear()})`
    : name;
  return { label, flag: ownerMileageFlagHtml(p.country) };
}

export function ownerMileagePeriodLabel(p: OwnerMileagePeriod, lang: ClientReportLang): string {
  const a = p.startYearOnly ? String(new Date(p.t0).getUTCFullYear()) : monthLabel(p.t0);
  if (p.current) return `${ownerMileageT("since", lang)} ${a}`;
  const b = monthLabel(p.t1);
  return a === b ? a : `${a}-${b}`;
}

export function ownerMileageDurationLabel(p: OwnerMileagePeriod, lang: ClientReportLang): string {
  return `${p.durationApprox ? "~" : ""}${ownerMileageDuration(p.duration, lang)}`;
}

export function ownerMileageKmLabel(p: OwnerMileagePeriod): string {
  return p.km == null ? "-" : `${p.kmApprox ? "~" : ""}${nf(p.km)} km`;
}

const OWNER_COLOR_A = "#1f2937";
const OWNER_COLOR_B = "#6b7280";
const OWNER_COLOR_CUR = "#0061D2";
const ABROAD_BAR = "#94a3b8";

export type OwnerMileageBlockOptions = {
  lang?: ClientReportLang;
  /** Admin: telefonā kolonnas kļūst par kartītēm (2 rindā). */
  responsive?: boolean;
};

/** Pilns bloks; tukšs, ja nav ko rādīt. */
export function buildOwnerMileageBlockHtml(r: OwnerMileageResult | null, opts: OwnerMileageBlockOptions = {}): string {
  if (!r) return "";
  const lang = opts.lang ?? "lv";
  const items: { p: OwnerMileagePeriod; label: string; flag: string; color: string; ab: boolean }[] = [];
  // 26.11 (Nils): valsts tikai pierādītajam posmam; agrākais laiks - «Iepriekš - valsts nav zināma».
  const abroadCols = r.abroadSegments?.length ? r.abroadSegments : r.abroad ? [r.abroad] : [];
  for (const seg of abroadCols) items.push({ p: seg, ...ownerMileageAbroadLabel(seg, lang), color: ABROAD_BAR, ab: true });
  r.owners.forEach((o, i) =>
    items.push({
      p: o,
      label: ownerMileageOwnerLabel(o.n, lang),
      flag: ownerMileageFlagHtml("LV"),
      color: o.current ? OWNER_COLOR_CUR : i % 2 ? OWNER_COLOR_B : OWNER_COLOR_A,
      ab: false,
    }),
  );

  const tiles: { cap: string; val: string }[] = [];
  if (r.abroad) tiles.push({ cap: ownerMileageT("abroad", lang), val: ownerMileageDurationLabel(r.abroad, lang) });
  if (r.ownerCount > 0) tiles.push({ cap: ownerMileageT("latvia", lang), val: ownerMileageOwnersCount(r.ownerCount, lang) });
  if (r.importT > 0) {
    tiles.push({ cap: ownerMileageT(r.abroad ? "imported" : "firstRegLv", lang), val: dateLabel(r.importT) });
  }
  const tilesHtml = tiles.length
    ? `<div class="pdf-own-tiles" style="grid-template-columns:repeat(${tiles.length},minmax(0,1fr))">${tiles
        .map((t) => `<div><span class="pdf-own-cap">${esc(t.cap)}</span><b>${esc(t.val)}</b></div>`)
        .join("")}</div>`
    : "";

  const span = Math.max(1, r.nowT - r.lifeStartT);
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - r.lifeStartT) / span) * 100));
  const startYear = r.abroad?.startYearOnly
    ? new Date(r.abroad.t0).getUTCFullYear()
    : new Date(r.lifeStartT).getUTCFullYear();
  const cols = ownerMileageColumns(items.length);
  const cards = items
    .map((x) => {
      const left = pct(x.p.t0);
      const width = Math.max(0, pct(x.p.t1) - left);
      const kmHtml =
        x.p.km == null
          ? `<span class="pdf-own-na">-</span>`
          : `<span class="pdf-own-km">${esc(ownerMileageKmLabel(x.p))}</span>`;
      return `<div class="pdf-own-col${x.ab ? " pdf-own-col--ab" : ""}${x.p.current ? " pdf-own-col--cur" : ""}"><div class="pdf-own-fl">${x.flag}<span>${esc(x.label)}</span></div>
<div class="pdf-own-lb"><i style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;background:${x.color}"></i></div><div class="pdf-own-ly"><span>${startYear}</span><span>${esc(ownerMileageT("today", lang))}</span></div>
<div class="pdf-own-big">${esc(ownerMileageDurationLabel(x.p, lang))}</div><div class="pdf-own-per">${esc(ownerMileagePeriodLabel(x.p, lang))}</div><div class="pdf-own-kv"><span>${esc(ownerMileageT("mileage", lang))}</span><span>${kmHtml}</span></div></div>`;
    })
    .join("");
  const gridHtml = items.length
    ? `<div class="pdf-own-grid" data-cols="${cols}" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${cards}</div><p class="pdf-own-foot">${esc(ownerMileageT("footBar", lang))}</p>`
    : "";
  if (!tilesHtml && !gridHtml) return "";
  const anyApprox = items.some((x) => x.p.km != null && x.p.kmApprox);
  const foot = anyApprox ? `<p class="pdf-own-foot">${esc(ownerMileageT("footApprox", lang))}</p>` : "";
  return `<div class="pdf-own${opts.responsive ? " pdf-own--responsive" : ""}" data-owner-mileage-block=""><div class="pdf-own-head"><h3>${esc(ownerMileageT("title", lang))}</h3></div>${tilesHtml}${gridHtml}${foot}</div>`;
}

export const OWNER_MILEAGE_BLOCK_CSS = `
.pdf-own{border:1px solid #E9EDF3;border-radius:12px;background:#fff;padding:18px 20px 16px;margin:10px 0 6px;font-variant-numeric:tabular-nums;box-shadow:0 1px 3px rgba(15,23,42,.06);color:#0f172a;break-inside:avoid;page-break-inside:avoid;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;}
.pdf-own-head{margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #E9EDF3;}
.pdf-own-head h3{margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f172a;}
.pdf-own-tiles{display:grid;gap:8px;margin-bottom:12px;}
.pdf-own-tiles > div{border:1px solid #E9EDF3;border-radius:10px;padding:11px 13px;min-width:0;}
.pdf-own-tiles b{display:block;font-size:16px;font-weight:750;letter-spacing:-.015em;margin-top:6px;line-height:1.2;color:#0f172a;}
.pdf-own-cap{font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#86868b;}
.pdf-own-grid{display:grid;gap:8px;}
.pdf-own-col{border:1px solid #E9EDF3;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;min-width:0;background:#fff;padding:10px 11px;break-inside:avoid;}
.pdf-own-col--ab{background:#F8FAFC;}
.pdf-own-fl{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:600;line-height:1.25;min-width:0;}
.pdf-own-fl > span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pdf-own-col--ab .pdf-own-fl > span:last-child{white-space:normal;}
.pdf-own-lb{height:6px;border-radius:999px;background:#EEF1F5;position:relative;overflow:hidden;margin:8px 0 4px;}
.pdf-own-lb i{position:absolute;top:0;bottom:0;border-radius:999px;min-width:3px;display:block;}
.pdf-own-ly{display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8;}
.pdf-own-big{font-size:15px;font-weight:750;letter-spacing:-.015em;line-height:1.2;margin:9px 0 0;white-space:nowrap;}
.pdf-own-per{font-size:9.5px;color:#64748b;margin-top:3px;}
.pdf-own-kv{display:block;font-size:10.5px;line-height:1.35;padding:5px 0 0;margin-top:8px;border-top:1px solid #F1F5F9;}
.pdf-own-kv > span{display:block;}
.pdf-own-kv > span:first-child{font-size:9px;margin-bottom:1px;color:#64748b;}
.pdf-own-km{color:#0f172a;font-weight:600;}
.pdf-own-na{color:#94a3b8;font-weight:600;}
.pdf-own-foot{margin:14px 0 0;font-size:9.5px;color:#64748b;line-height:1.5;}
.pdf-own-foot + .pdf-own-foot{margin-top:2px;}
.pdf-own-flag{display:inline-flex;width:16px;height:11px;border-radius:2px;overflow:hidden;box-shadow:0 0 0 1px rgba(15,23,42,.12);flex:none;vertical-align:-1px;}
.pdf-own-flag i{flex:1;display:block;}
.pdf-own-flag--v{flex-direction:column;}
.pdf-own-flag-emoji{font-size:12px;line-height:1;flex:none;}
`;

/** Bloks «Īpašnieki un nobraukums» no CSDD formas (+ citu avotu rādījumi). */
export function buildCsddOwnerMileageBlockHtml(
  form: CsddFormFields,
  readings?: OwnerMileageReading[],
  opts: {
    lang?: ClientReportLang;
    nowMs?: number;
    responsive?: boolean;
    /** Datēti ieraksti ar valsti (arī bez km) - ārvalstu perioda valstij. */
    countryRecords?: readonly OwnerMileageCountryRecord[];
  } = {},
): string {
  try {
    const rs =
      readings ??
      ownerMileageReadingsFromUnifiedRows(prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows({ csddForm: form })));
    const input = ownerMileageInputFromCsdd(form, rs, opts.nowMs, opts.countryRecords);
    if (!input) return "";
    return buildOwnerMileageBlockHtml(buildOwnerMileagePeriods(input), {
      lang: opts.lang ?? "lv",
      responsive: opts.responsive,
    });
  } catch {
    return "";
  }
}

/** Admin: tas pats bloks; telefonā kolonnas → kartītes (2 rindā), baneri viens zem otra. */
export const OWNER_MILEAGE_BLOCK_ADMIN_CSS = `${OWNER_MILEAGE_BLOCK_CSS}
.pdf-own--responsive{padding:14px 14px 12px;margin:8px 0;}
@media (max-width:640px){
  .pdf-own--responsive .pdf-own-grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}
  .pdf-own--responsive .pdf-own-tiles{grid-template-columns:minmax(0,1fr) !important;}
  .pdf-own--responsive .pdf-own-tiles > div{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:8px 11px;}
  .pdf-own--responsive .pdf-own-tiles b{margin-top:0;font-size:14px;}
}
`;
