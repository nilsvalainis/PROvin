/**
 * Starptautiskās vēstures sadaļa klienta PDF.
 *
 * Rāda tikai to, kas maina pircēja lēmumu: sarkanos karogus, bojājumus, norakstīšanas un
 * īpašumtiesību ierakstus, pārdošanas vēsturi. Specifikācijas un „nav ierakstu” pārbaudes
 * netiek drukātas - tās jau ir citās sadaļās vai nesniedz informāciju.
 */

import { buildAuctionArchiveSummary, type AuctionArchivePhoto } from "@/lib/auction-archive-offer";
import { AUCTION_LOT_CARDS_CSS, auctionLotRecordKey, buildAuctionLotsHtml } from "@/lib/auction-lot-cards-html";
import type { ThecarapiStoredPhoto } from "@/lib/vin-scan/thecarapi-fields";
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
export type CcVinPdfAuctionOpts = {
  /** Izsoļu bildes (jau atlasītas bez dublikātiem) - galerija tajā pašā kartīšu dizainā kā «Izsoļu arhīvs». */
  photos?: readonly ThecarapiStoredPhoto[];
  dataUrls?: ReadonlyMap<string, string>;
  vin?: string;
};

/**
 * Izsoļu ieraksti klienta PDF - tas pats kopīgais kartīšu renderētājs kā atsevišķajam «Izsoļu arhīva» PDF
 * (Nils 23.11). Cenas AUDITS PDF rāda (kā līdz šim); aprīkojumu nerāda (Nils 19.11). Bez tehnisko lauku izmetiena.
 */
export function buildCcVinAuctionCardsHtml(b: CcVinBlockState, opts: CcVinPdfAuctionOpts = {}): string {
  const records = (b.thecarapiRecords ?? []).filter((r) => r.fields.length > 0 || r.photos.length > 0);
  if (records.length === 0) return "";
  const summary = buildAuctionArchiveSummary({ vin: opts.vin ?? "", title: "", block: { thecarapiRecords: records, photoGroups: [] } });
  // Bilde → izsole pēc id, saites vai satura (bilžu grupā tā pati bilde var būt ar citu id).
  const lotByKey = new Map<string, { key: string; date: string }>();
  const keysOf = (p: { id?: string; sourceUrl?: string; contentHash?: string }): string[] =>
    [p.id ? `id:${p.id}` : "", p.sourceUrl?.trim() ? `url:${p.sourceUrl.trim()}` : "", p.contentHash?.trim() ? `hash:${p.contentHash.trim().toLowerCase()}` : ""].filter(Boolean);
  for (const r of records) {
    for (const p of r.photos) for (const k of keysOf(p)) if (!lotByKey.has(k)) lotByKey.set(k, { key: auctionLotRecordKey(r), date: p.date || r.photoDate || r.date });
  }
  const photos: AuctionArchivePhoto[] = [];
  for (const p of opts.photos ?? []) {
    const lot = keysOf(p).map((k) => lotByKey.get(k)).find(Boolean);
    if (lot) photos.push({ id: p.id, auctionKey: lot.key, date: p.date || lot.date, caption: "" });
  }
  const parts = buildAuctionLotsHtml({
    summary,
    records,
    photos,
    dataUrls: opts.dataUrls ?? new Map(),
    showPrices: true,
  });
  return `<div class="aa-embed">${parts.timeline}${parts.findings}${parts.vehicle}${parts.lots.join("\n")}${parts.galleries}</div>`;
}

export function buildCcVinPdfInnerHtml(b: CcVinBlockState | null | undefined, auction: CcVinPdfAuctionOpts = {}): string {
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

  const thecarapiHtml = buildCcVinAuctionCardsHtml(b, auction);
  if (thecarapiHtml) parts.push(thecarapiHtml);

  return parts.join("\n");
}

/** Sadaļas CSS - mērogs un krāsas seko PDF dizaina marķieriem. */
export const CC_VIN_PDF_CSS = AUCTION_LOT_CARDS_CSS + `
      /* Izsoļu kartītes AUDITS sadaļā: tās pašas kā «Izsoļu arhīvs» PDF; atkāpe no iepriekšējā bloka. */
      .aa-embed{margin:14px 0 0}
      .aa-embed .aa-card:last-child{margin-bottom:0}
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
      /* Izsoles bloks: tās pašas klases kā OFICIĀLĀ DĪLERA DATI; šeit tikai izkārtojums un krāsu teksts. */
      .pdf-tc-lot{margin:14px 0 18px}
      .pdf-tc-lot + .pdf-tc-lot{margin-top:22px}
      .pdf-tc-intro{break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid}
      .pdf-tc-summary{break-inside:avoid;page-break-inside:avoid}
      .pdf-tc-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:start;margin:0 0 12px}
      .pdf-tc-cols > .pdf-tc-zone{margin:0;break-inside:avoid;page-break-inside:avoid}
      .pdf-tc-zone .pdf-subhead{margin:0 0 6px}
      .pdf-tc-zone .pdf-svc-major__item{display:block}
      .pdf-tc-zone .pdf-svc-major__item b{display:block}
      .pdf-tc-zone .pdf-svc-major__meta{display:block;margin-top:1px}
      .pdf-tc-legend{margin:2px 0 8px}
      .pdf-tc-paint-map{margin:2px 0 4px;break-inside:avoid;page-break-inside:avoid}
      .pdf-tc-paint-map svg{display:block;width:100%;max-width:520px;height:auto;margin:0 auto}
      .pdf-tc-tone{font-weight:600}
      .pdf-tc-tone--ok{color:#15803d}
      .pdf-tc-tone--warn{color:#B45309}
      .pdf-tc-tone--alert{color:#B91C1C}
      .pdf-tc-lot .pdf-tc-grid{margin:0 0 8px}
      .pdf-tc-lot .pdf-dealer-eq{margin:0 0 8px}
`;
