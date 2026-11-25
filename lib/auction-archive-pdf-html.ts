/**
 * «Izsoļu arhīvs» PDF (Nils 23.11: variants C «katalogs», pievilkts PROVIN atskaišu kopējam dizainam).
 * Tās pašas PROVIN PDF klases kā «Oficiālā dīlera dati»: sadaļas kartīte ar `pdf-sec-head` (ikona aplī + virsraksts
 * lielajiem burtiem + skaita nozīmīte), vāks `pdf-dealer-cover`, skaitļu josla `pdf-svc-summary`, apakšvirsraksti
 * `pdf-subhead`, tie paši rādiusi/apmales/tipogrāfijas mērogs (`--pdf-*`).
 * Simetrija: viens 12 kolonnu režģis visā dokumentā (5/7 izsoles bilde + datu josla, 6/6 datu pāri, 4/4/4 galerija),
 * vienādas iekšējās atkāpes, etiķete/vērtība vienādos platumos, nekādu pus-tukšu rindu (nepāra pēdējā rinda stiepjas).
 * Katrs fakts vienreiz:
 *   1. Vāks - auto, VIN, 4 skaitļi. 2. Izsoļu hronoloģija - katrai izsolei liela bilde + datu josla vienā augstumā
 *      (bez bildēm - kompakta datu kartīte pilnā platumā). 3. Galvenie fakti. 4. Transportlīdzekļa dati.
 *   5. Katra izsole - izsoles dati, cenas (tikai ar «Rādīt izsoļu cenas»), stāvoklis un dokumenti, bojājumi, apraksts.
 *   6. Galerija 3 kolonnās (15 lapā). 7. Aprīkojums - pēdējā sadaļa.
 * Tīrs modulis - bildes nāk kā data: URI no servera; tulkojumi - `translations` karte (avota teksts → LV).
 */
import {
  auctionArchiveMaxKm,
  formatIsoDayLv,
  formatKm,
  lvCount,
  type AuctionArchiveOperatorMark,
  type AuctionArchivePhoto,
  type AuctionArchiveSummary,
} from "@/lib/auction-archive-offer";
import { buildAuctionArchivePdfFilename } from "@/lib/audit-report-pdf-filename";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { auctionArchiveEquipment, auctionArchiveModelTitle, auctionArchiveVersion } from "@/lib/auction-archive-facts";
import { getClientReportPrintCss } from "@/lib/client-report-html";
import { buildPdfDocFooterHtml } from "@/lib/client-report-pdf-footer";
import { provincLogoSvg } from "@/lib/client-report-pdf-layout-draft";
import {
  AUCTION_LOT_CARDS_CSS,
  auctionArchiveDescriptions,
  auctionLotRecordKey,
  buildAuctionLotsHtml,
  card,
  esc,
} from "@/lib/auction-lot-cards-html";
import { buildPdfRunningFooterLine, buildPdfRunningHeaderLine, clientReportRunningPageCss } from "@/lib/pdf-running-page";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

// Kartīšu primitīvi dzīvo kopīgajā modulī (viens renderētājs visiem produktiem); šeit re-eksports saderībai.
export {
  AUCTION_ARCHIVE_PHOTOS_PER_PAGE,
  auctionArchiveDamageBlockHtml,
  auctionArchiveDescriptions,
  auctionArchiveGallerySpans,
  damageSlotLv,
} from "@/lib/auction-lot-cards-html";

/* ---------- Dokuments ---------- */

export type AuctionArchivePdfInput = {
  summary: AuctionArchiveSummary;
  records: readonly ThecarapiAdminRecord[];
  photos: readonly AuctionArchivePhoto[];
  dataUrls: ReadonlyMap<string, string>;
  /** Avota teksts → latviski (apraksti un nezināmi aprīkojuma nosaukumi). */
  translations?: ReadonlyMap<string, string>;
  marks?: readonly AuctionArchiveOperatorMark[];
  generatedAt?: Date;
  /** «Sagatavots klientam: …» kājenē (vārds, ja ir). */
  preparedFor?: string;
  /** «Rādīt izsoļu cenas» (Nils 23.11, lēmums 4): noklusējumā cenas PDF NErāda. */
  showPrices?: boolean;
};

const DT = new Intl.DateTimeFormat("lv-LV", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function fmtDateTime(d: Date): string {
  const p = Object.fromEntries(DT.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** Tikai atsevišķajā arhīva PDF: galerija no jaunas lapas (15 bildes lapā). Klienta AUDITS PDF piespiedu pārrāvumu nav. */
const ARCHIVE_ONLY_CSS = `.aa-gallery{break-before:page;page-break-before:always}`;

/** Dokumenta nosaukums vākā, galvenē un kolofonā (kā «OFICIĀLĀ DĪLERA DATI»). */
export const AUCTION_ARCHIVE_PDF_TITLE = "IZSOĻU ARHĪVS";

export function buildAuctionArchivePdfHtml(input: AuctionArchivePdfInput): string {
  const s = input.summary;
  const showPrices = input.showPrices === true;
  const now = input.generatedAt ?? new Date();
  const marks = input.marks ?? [];
  const byKey = new Map(s.auctions.map((a) => [a.key, a]));
  // Hronoloģiski (vecākā pirmā) - nosaukumam/versijai uzvar jaunākā izsole.
  const records = [...input.records].sort((a, b) => (byKey.get(auctionLotRecordKey(a))?.date || "9999").localeCompare(byKey.get(auctionLotRecordKey(b))?.date || "9999"));
  const parts = buildAuctionLotsHtml({
    summary: s,
    records,
    photos: input.photos,
    dataUrls: input.dataUrls,
    translations: input.translations,
    marks: input.marks,
    showPrices,
  });

  const title = auctionArchiveModelTitle(records, s.title || s.vin);
  const version = auctionArchiveVersion(records);
  const lastDate = [...s.auctions].reverse().find((a) => a.date)?.date ?? "";
  const km = auctionArchiveMaxKm(s);
  const photoTotal = input.photos.filter((p) => input.dataUrls.has(p.id)).length || input.photos.length || s.photoCount;

  /* --- 1. Vāks --- */
  const hero = `<header class="pdf-v1-hero"><div class="pdf-v1-hero-inner">${provincLogoSvg({ includeLvSuffix: true })}<div class="pdf-v1-hero-text"><h1 class="pdf-v1-doc-title">${esc(
    AUCTION_ARCHIVE_PDF_TITLE,
  )}</h1><p class="pdf-v1-meta">Ģenerēts: ${esc(fmtDateTime(now))} · VIN <span class="pdf-vin">${esc(s.vin)}</span></p></div></div></header>`;
  const stats = [
    { k: "Izsoles", v: String(s.auctions.length) },
    { k: "Bildes", v: String(photoTotal) },
    { k: "Pēdējā izsole", v: formatIsoDayLv(lastDate) || "-" },
    { k: "Nobraukums", v: km != null ? formatKm(km) : "-" },
  ];
  const cover = card(
    AUCTION_ARCHIVE_PDF_TITLE,
    `<div class="pdf-dealer-cover"><p class="pdf-dealer-cover__kicker">Eiropas izsoļu arhīvs</p><h3 class="pdf-dealer-cover__model">${esc(
      title,
    )}</h3><p class="pdf-dealer-cover__meta">${version ? `${esc(version)} · ` : ""}VIN <b class="pdf-vin">${esc(s.vin)}</b></p></div>
<div class="pdf-svc-summary">${stats.map((x) => `<div class="pdf-svc-summary__cell"><span>${esc(x.k)}</span><b>${esc(x.v)}</b></div>`).join("")}</div>`,
    { icon: "globe", badge: s.auctions.length ? lvCount(s.auctions.length, "izsole", "izsoles") : undefined },
  );

  /* --- Citi avoti --- */
  const sources = s.manualSources.length
    ? card("Citi avoti", `<ul class="aa-sources">${s.manualSources.map((m) => `<li>${esc(m.label)}${m.kind === "pdf" ? " (PDF)" : ""}</li>`).join("")}</ul>`, {
        icon: "search",
      })
    : "";

  const header = buildPdfRunningHeaderLine(title, s.vin, `PROVIN.LV · ${AUCTION_ARCHIVE_PDF_TITLE}`);
  const footer = buildPdfRunningFooterLine({ vin: s.vin, dateLabel: fmtDateTime(now), preparedBy: input.preparedFor ?? "" });
  const css = `${getClientReportPrintCss()}${clientReportRunningPageCss({ header, footer, lang: "lv" })}${AUCTION_LOT_CARDS_CSS}${ARCHIVE_ONLY_CSS}`;
  const note = `<p class="aa-foot">Dati no Eiropas izsoļu portālu arhīva izsoles dienā. Bildes, ${
    showPrices ? "cenas, " : ""
  }nobraukums un apraksti ir avota dati; tulkojums un apkopojums - PROVIN.${
    marks.length ? " «Redzams bildē» - PROVIN atzīme pēc bildes." : ""
  }</p>`;
  const foot = `${buildPdfDocFooterHtml({
    vin: s.vin,
    amountTotalCents: null,
    generatedLabel: `Ģenerēts ${fmtDateTime(now)}`,
    productLabel: AUCTION_ARCHIVE_PDF_TITLE,
  })}${note}`;
  return `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><meta name="color-scheme" content="light"/><title>${esc(
    `Izsolu_arhivs_${s.vin}.pdf`,
  )}</title><style>${css}</style></head><body class="provin-report-doc"><div class="sheet">${hero}${cover}${parts.timeline}${parts.findings}${parts.vehicle}${sources}${parts.lots.join(
    "\n",
  )}${parts.galleries}${parts.manualGallery}${parts.equipment}${foot}</div>${FONT_READY_SCRIPT}</body></html>`;
}

/** Servera renderis gaida `data-provin-fonts="ready"` (kā klienta atskaitē). */
const FONT_READY_SCRIPT = `<script>(function(){function done(){document.documentElement.setAttribute("data-provin-fonts","ready")}if(document.fonts&&document.fonts.load){Promise.all([document.fonts.load("400 12px Inter"),document.fonts.load("700 12px Inter")]).then(done,done)}else done()})();</script>`;

/** Teksti, kas jātulko pirms PDF: apraksti + aprīkojums, ko vārdnīca nezina. */
export function auctionArchiveTextsToTranslate(records: readonly ThecarapiAdminRecord[]): string[] {
  return [...new Set([...records.flatMap(auctionArchiveDescriptions), ...auctionArchiveEquipment(records).untranslated])];
}

export function auctionArchivePdfFilename(vin: string, lang?: ClientReportLang | null): string {
  // Nils 23.11: viens nosaukums visur (piedāvājuma PDF un atsevišķais pakalpojums); 25.11: viena funkcija visiem PDF.
  return buildAuctionArchivePdfFilename(vin, lang);
}
