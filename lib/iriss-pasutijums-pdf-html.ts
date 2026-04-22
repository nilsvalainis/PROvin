import { IRISS_BRAND_ORANGE_HEX, IRISS_COMPANY_LINES } from "@/lib/iriss-brand";
import { IRISS_DEAL_DETAIL_OPTIONS, type IrissOfferRecord, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

/** Sekundārā virsrakstu krāsa (Tailwind slate-900 tuvinājums). */
const INK = "#111827";
/** PDF pamatteksts — gandrīz melns. */
const SLATE_600 = "#1F2937";
/** Bloku fons — Tailwind `bg-slate-50` (#F8FAFC). */
const PANEL = "#F8FAFC";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowIf(label: string, value: string): string {
  const v = value.trim();
  if (!v) return "";
  return `<tr><th>${esc(label)}</th><td>${esc(v)}</td></tr>`;
}

function wrapTable(rows: string): string {
  const r = rows.trim();
  if (!r) return "";
  return `<table class="ipdf-kv">${r}</table>`;
}

function blockIf(title: string, inner: string, sectionClass = ""): string {
  if (!inner.trim()) return "";
  const cls = ["ipdf-blk", sectionClass].filter(Boolean).join(" ");
  return `<section class="${cls}">${sectionHead(title)}<div class="ipdf-blk-body">${inner}</div></section>`;
}

function sectionHead(title: string): string {
  return `<div class="ipdf-sec-head" role="heading" aria-level="2"><h2 class="ipdf-sec-title">${esc(title)}</h2></div>`;
}

function buildIrissPrintFooterHtml(accent: string): string {
  const lines = [...IRISS_COMPANY_LINES];
  const brand = esc(lines[0] ?? "");
  const rows = lines
    .slice(1)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx <= 0) return `<p class="ipdf-ft-plain">${esc(line)}</p>`;
      const k = esc(line.slice(0, idx + 1).trim());
      const v = esc(line.slice(idx + 1).trim());
      return `<div class="ipdf-ft-row"><span class="ipdf-ft-k">${k}</span><span class="ipdf-ft-v">${v}</span></div>`;
    })
    .join("");
  return `<footer class="ipdf-footer" role="contentinfo">
    <div class="ipdf-footer-card">
      <div class="ipdf-footer-accent" style="background:${accent}" aria-hidden="true"></div>
      <p class="ipdf-footer-brand">${brand}</p>
      <div class="ipdf-footer-body">${rows}</div>
    </div>
  </footer>`;
}

function parseMoney(value: string | undefined): number {
  const compact = (value ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number.parseFloat(compact);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(".", ",");
}

/** Meklē skaitlisku novērtējumu tekstā (piem. „8/10”, „8 no 10”). */
function parseScoreOutOf10(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m1 = t.match(/\b(\d{1,2})\s*\/\s*10\b/i);
  if (m1) {
    const n = Number.parseInt(m1[1], 10);
    if (n >= 0 && n <= 10) return n;
  }
  const m2 = t.match(/\b(\d{1,2})\s+no\s+10\b/i);
  if (m2) {
    const n = Number.parseInt(m2[1], 10);
    if (n >= 0 && n <= 10) return n;
  }
  return null;
}

function svgCheck(accent: string): string {
  return `<svg class="ipdf-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16.667 5L7.5 14.167 3.333 10" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function checklistRow(accent: string, ok: boolean, label: string): string {
  const icon = ok ? svgCheck(accent) : `<span class="ipdf-check ipdf-check--off" aria-hidden="true"></span>`;
  const cls = ok ? "ipdf-cl-item ipdf-cl-item--on" : "ipdf-cl-item ipdf-cl-item--off";
  return `<div class="${cls}">${icon}<span class="ipdf-cl-txt">${esc(label)}</span></div>`;
}

/** Veselības josla tikai tad, ja tekstā ir „X/10” / „X no 10”. */
function healthScaleHtml(
  accent: string,
  label: string,
  bodyText: string,
  opts?: { omitHeading?: boolean },
): string {
  const score = parseScoreOutOf10(bodyText);
  if (score === null) return "";
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  const badge = `${score}/10`;
  const heading =
    opts?.omitHeading === true
      ? ""
      : `<span class="ipdf-health-lbl">${esc(label)}</span>`;
  const barOnlyCls = opts?.omitHeading === true ? " ipdf-health--bar-only" : "";
  return `<div class="ipdf-health${barOnlyCls}">
    <div class="ipdf-health-top">${heading}<span class="ipdf-health-val">${esc(badge)}</span></div>
    <div class="ipdf-bar-track" role="img" aria-label="${esc(label)}: ${esc(badge)}"><div class="ipdf-bar-fill" style="width:${pct}%"></div></div>
  </div>`;
}

function infoTile(label: string, value: string): string {
  const v = value.trim();
  if (!v) return "";
  return `<div class="ipdf-tile"><p class="ipdf-tile-lbl">${esc(label)}</p><p class="ipdf-tile-val">${esc(v)}</p></div>`;
}

function infoGrid4(tiles: string): string {
  const t = tiles.trim();
  if (!t) return "";
  return `<div class="ipdf-grid4">${t}</div>`;
}

function selectedDealDetailLabels(record: IrissPasutijumsRecord): string[] {
  return IRISS_DEAL_DETAIL_OPTIONS.filter((opt) => Boolean(record[opt.key])).map((opt) => opt.label);
}

function irissPrintShell(accent: string, title: string, body: string): string {
  const css = `
    @page { size: A4; margin: 11mm; }
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      margin: 0;
      padding: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      font-weight: 400;
      line-height: 1.5;
      letter-spacing: 0.011em;
      color: ${INK};
      background: #fff;
    }
    .ipdf-root {
      max-width: 190mm;
      margin: 0 auto;
      padding: 4mm 2mm 8mm;
    }
    .ipdf-header {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 14px;
      align-items: center;
      padding-bottom: 14px;
      margin-bottom: 18px;
      border-bottom: 1px solid #0f172a;
    }
    .ipdf-hero-model {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: 0.088em;
      text-transform: uppercase;
      color: ${INK};
    }
    .ipdf-hero-sub { margin: 6px 0 0; font-size: 0.72rem; font-weight: 400; color: ${SLATE_600}; letter-spacing: 0.044em; }
    .ipdf-logo {
      display: block;
      height: 38px;
      width: auto;
      max-width: 160px;
      object-fit: contain;
      mix-blend-mode: multiply;
    }
    .ipdf-sec-head { display: block; margin: 0 0 8px; }
    .ipdf-sec-title {
      margin: 0;
      display: block;
      width: 100%;
      font-size: 0.68rem;
      font-weight: 900;
      letter-spacing: 0.154em;
      text-transform: uppercase;
      color: ${INK};
      background: #e9edf3;
      border-radius: 8px;
      border-left: 3px solid ${accent};
      padding: 7px 11px 7px 10px;
    }
    .ipdf-blk {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .ipdf-blk-body {
      border: 1px solid #0f172a;
      border-radius: 12px;
      padding: 12px 14px 14px;
      background: ${PANEL};
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
    }
    .ipdf-blk--media {
      padding: 0;
    }
    .ipdf-blk--media .ipdf-blk-body {
      border: none;
      box-shadow: none;
      background: transparent;
      padding: 0;
    }
    .ipdf-blk--media .ipdf-sec-head { margin-bottom: 9px; }
    .ipdf-blk .ipdf-sec-head { margin-bottom: 8px; margin-top: 0; }
    .ipdf-blk-body > table.ipdf-kv { border: none; box-shadow: none; background: transparent; }
    .ipdf-blk-body > table.ipdf-kv th { background: #f8fafc; }
    .ipdf-grid4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    @media (max-width: 640px) {
      .ipdf-grid4 { grid-template-columns: repeat(2, 1fr); }
    }
    .ipdf-tile {
      background: ${PANEL};
      border-radius: 12px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
    }
    .ipdf-tile-lbl {
      margin: 0 0 4px;
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: ${SLATE_600};
    }
    .ipdf-tile-val { margin: 0; font-size: 0.82rem; font-weight: 400; color: ${INK}; line-height: 1.35; letter-spacing: 0.011em; }
    table.ipdf-kv { width: 100%; border-collapse: collapse; background: ${PANEL}; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    table.ipdf-kv th {
      text-align: left;
      width: 30%;
      padding: 8px 12px;
      vertical-align: top;
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: ${SLATE_600};
      border-bottom: 1px solid #e2e8f0;
      background: #fff;
    }
    table.ipdf-kv td {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      white-space: pre-wrap;
      font-weight: 400;
      color: ${INK};
      letter-spacing: 0.011em;
    }
    table.ipdf-kv tr:last-child th, table.ipdf-kv tr:last-child td { border-bottom: none; }
    .ipdf-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 560px) { .ipdf-two { grid-template-columns: 1fr; } }
    .ipdf-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
    }
    .ipdf-card h3 {
      margin: 0 0 8px;
      font-size: 0.58rem;
      font-weight: 900;
      letter-spacing: 0.132em;
      text-transform: uppercase;
      color: ${INK};
    }
    .ipdf-card pre { margin: 0; font-family: inherit; font-weight: 400; white-space: pre-wrap; word-break: break-word; color: ${SLATE_600}; font-size: 0.78rem; letter-spacing: 0.011em; }
    .ipdf-eval-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    @media (max-width: 560px) { .ipdf-eval-grid { grid-template-columns: 1fr; } }
    .ipdf-cl-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #fff;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
    }
    .ipdf-cl-item--off { opacity: 0.55; }
    .ipdf-check { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
    .ipdf-check--off {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 1.5px dashed #cbd5e1;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .ipdf-cl-txt { font-size: 0.78rem; font-weight: 400; color: ${INK}; line-height: 1.35; letter-spacing: 0.011em; }
    .ipdf-health { margin-bottom: 10px; }
    .ipdf-health-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
    .ipdf-health--bar-only .ipdf-health-top { justify-content: flex-end; }
    .ipdf-health-lbl { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase; color: ${INK}; margin: 0; }
    .ipdf-health-val { font-size: 0.72rem; font-weight: 700; color: ${accent}; margin: 0; letter-spacing: 0.011em; }
    .ipdf-bar-track {
      height: 8px;
      border-radius: 999px;
      background: #e2e8f0;
      overflow: hidden;
    }
    .ipdf-bar-fill {
      height: 100%;
      border-radius: 999px;
      background: ${accent};
      transition: width 0.2s ease;
    }
    .ipdf-summary {
      border: 2px solid ${accent};
      border-radius: 12px;
      padding: 14px 16px;
      background: #fff;
      box-shadow: 0 1px 2px rgb(242 101 34 / 0.12);
    }
    .ipdf-summary h3 {
      margin: 0 0 8px;
      font-size: 0.58rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${INK};
    }
    .ipdf-summary pre { margin: 0; font-family: inherit; font-weight: 400; white-space: pre-wrap; color: ${SLATE_600}; font-size: 0.82rem; letter-spacing: 0.011em; }
    .ipdf-notes { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; min-height: 48px; background: ${PANEL}; }
    .ipdf-notes pre { margin: 0; font-weight: 400; letter-spacing: 0.011em; }
    .ipdf-gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 560px) { .ipdf-gallery { grid-template-columns: 1fr; } }
    .ipdf-photo { margin: 0; border: none; border-radius: 10px; overflow: hidden; background: #f1f5f9; page-break-inside: avoid; box-shadow: none; }
    .ipdf-photo img { display: block; width: 100%; height: auto; max-height: 220px; object-fit: cover; }
    .ipdf-meta { margin: 0; font-size: 0.68rem; font-weight: 500; color: ${INK}; line-height: 1.45; letter-spacing: 0.011em; }
    .ipdf-footer { margin-top: 26px; }
    .ipdf-footer-card {
      position: relative;
      border: 1px solid #0f172a;
      border-radius: 12px;
      padding: 14px 16px 14px 17px;
      background: linear-gradient(165deg, #f8fafc 0%, #ffffff 58%);
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.05);
      overflow: hidden;
    }
    .ipdf-footer-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #0f172a !important; }
    .ipdf-footer-brand {
      margin: 0 0 10px;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.132em;
      text-transform: uppercase;
      color: ${INK};
    }
    .ipdf-footer-body { display: flex; flex-direction: column; gap: 6px; }
    .ipdf-ft-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      font-size: 0.62rem;
      line-height: 1.45;
      align-items: baseline;
    }
    .ipdf-ft-k { font-weight: 700; color: ${INK}; flex: 0 0 auto; min-width: 5.5rem; letter-spacing: 0.011em; }
    .ipdf-ft-v { font-weight: 500; color: ${INK}; flex: 1 1 12rem; letter-spacing: 0.011em; }
    .ipdf-ft-plain { margin: 0; font-size: 0.62rem; font-weight: 500; color: ${INK}; line-height: 1.45; letter-spacing: 0.011em; }
  `;

  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;600;800&display=swap" rel="stylesheet"/>`;

  return `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${fontLink}<title>${esc(title)}</title><style>${css}</style></head><body><div class="ipdf-root">${body}</div></body></html>`;
}

/**
 * Drukas / „Saglabāt kā PDF” HTML — A4, Inter, akcents no `IRISS_BRAND_ORANGE_HEX`, SIA IRISS rekvizīti.
 * Dizaina loģika atbilst Tailwind utility principiem (slate-600, slate-50, tracking-wider, shadow-sm, rounded-xl).
 * Tukši lauki netiek iekļauti.
 */
export function buildIrissPasutijumsPrintHtml(record: IrissPasutijumsRecord, generatedAtFormatted: string): string {
  const accent = IRISS_BRAND_ORANGE_HEX;

  const heroModel = record.brandModel.trim() || "PASŪTĪJUMS";

  const header = `<header class="ipdf-header">
    <img class="ipdf-logo" src="/brands/dzintarzeme-iriss-offer-pdf-logo.png" width="160" height="40" alt="Dzintarzeme Auto"/>
    <div>
      <p class="ipdf-hero-model">${esc(heroModel)}</p>
      <p class="ipdf-hero-sub">${esc(generatedAtFormatted)} · IRISS pasūtījums</p>
    </div>
  </header>`;

  const clientRows =
    rowIf("Vārds", record.clientFirstName) +
    rowIf("Uzvārds", record.clientLastName) +
    rowIf("Tālrunis", record.phone) +
    rowIf("E-pasts", record.email) +
    rowIf("Pasūtījuma datums", record.orderDate);
  const clientTable = wrapTable(clientRows);

  const pamat = infoGrid4(
    infoTile("Gads / periods", record.productionYears) +
      infoTile("Maks. nobraukums", record.maxMileage) +
      infoTile("Transmisija", record.transmission) +
      infoTile("Dzinēja tips", record.engineType),
  );

  const markaRows = rowIf("Marka / modelis", record.brandModel);
  const markaTable = wrapTable(markaRows);
  const specRestRows =
    rowIf("Kopējais budžets", record.totalBudget) +
    rowIf("Vēlamās krāsas", record.preferredColors) +
    rowIf("Nevēlamās krāsas", record.nonPreferredColors) +
    rowIf("Salona apdare", record.interiorFinish);
  const specRestTable = wrapTable(specRestRows);
  const selectedDealDetails = selectedDealDetailLabels(record);
  const dealDetailRows = selectedDealDetails
    .map((label) => `<tr><th>${esc(label)}</th><td>Jā</td></tr>`)
    .join("");
  const dealDetailsInner = selectedDealDetails.length
    ? `<div class="ipdf-card" style="margin-top:10px"><h3>Darījuma detaļas</h3><table class="ipdf-kv">${dealDetailRows}</table></div>`
    : "";
  const pamatAfterMarka =
    pamat.trim() === ""
      ? ""
      : `<div style="margin-top:${markaTable ? "10px" : "0"}">${pamat}</div>`;
  const specRestHtml =
    specRestTable === ""
      ? ""
      : `<div style="margin-top:${markaTable || pamat.trim() ? "10px" : "0"}">${specRestTable}</div>`;
  const mergedVehicleSpecInner = [markaTable, pamatAfterMarka, specRestHtml, dealDetailsInner]
    .filter((s) => s.trim())
    .join("");

  const req = record.equipmentRequired.trim();
  const des = record.equipmentDesired.trim();
  const equipBoxes: string[] = [];
  if (req) {
    equipBoxes.push(`<div class="ipdf-card"><h3>Obligātās prasības</h3><pre>${esc(req)}</pre></div>`);
  }
  if (des) {
    equipBoxes.push(`<div class="ipdf-card"><h3>Vēlamās prasības</h3><pre>${esc(des)}</pre></div>`);
  }
  const equip = equipBoxes.length ? `<div class="ipdf-two">${equipBoxes.join("")}</div>` : "";

  const notes = record.notes.trim() ? `<div class="ipdf-notes"><pre>${esc(record.notes.trim())}</pre></div>` : "";

  const body = `${header}
    ${blockIf("Klienta dati", clientTable)}
    ${mergedVehicleSpecInner.trim() ? blockIf("Transportlīdzekļa specifikācija", mergedVehicleSpecInner) : ""}
    ${blockIf("Aprīkojums", equip)}
    ${blockIf("Piezīmes", notes)}
    ${buildIrissPrintFooterHtml(accent)}`;

  return irissPrintShell(accent, "PASŪTĪJUMS", body);
}

export function buildIrissOfferPrintHtml(
  record: IrissPasutijumsRecord,
  offer: IrissOfferRecord,
  generatedAtFormatted: string,
): string {
  const accent = IRISS_BRAND_ORANGE_HEX;

  const heroTitle = offer.brandModel.trim() || offer.title.trim() || "Piedāvājums";

  const header = `<header class="ipdf-header">
    <img class="ipdf-logo" src="/brands/dzintarzeme-iriss-offer-pdf-logo.png" width="160" height="40" alt="Dzintarzeme Auto"/>
    <div>
      <p class="ipdf-hero-model">${esc(heroTitle)}</p>
      <p class="ipdf-hero-sub">${esc(generatedAtFormatted)} · Auto pārbaude / piedāvājums</p>
    </div>
  </header>`;

  const clientName = `${record.clientFirstName} ${record.clientLastName}`.trim();
  const clientRows =
    (clientName ? rowIf("Klients", clientName) : "") + rowIf("Tālrunis", record.phone) + rowIf("E-pasts", record.email);
  const clientTable = wrapTable(clientRows);

  const firstRegistration = offer.firstRegistration?.trim() || offer.year.trim();
  const odometer = offer.odometerReading?.trim() || offer.mileage.trim();
  const pamatInner = infoGrid4(
    infoTile("Gads", firstRegistration) +
      infoTile("Nobraukums", odometer) +
      infoTile("Transmisija", offer.transmission) +
      infoTile("Atrašanās vieta", offer.location),
  );

  const checklistHtml = `<div class="ipdf-eval-grid">
    ${checklistRow(accent, offer.hasFullServiceHistory, "Vēsture (pilna servisa vēsture)")}
    ${checklistRow(accent, offer.hasFactoryPaint, "Krāsojums (rūpnīcas krāsa)")}
    ${checklistRow(accent, offer.hasNoRustBody, "Rūsa (virsbūve bez rūsas)")}
    ${checklistRow(accent, offer.hasSecondWheelSet, "Otrs riteņu komplekts")}
  </div>`;

  const specialNotes = offer.specialNotes?.trim() || "";
  const specialInner = specialNotes ? `<div class="ipdf-card"><pre>${esc(specialNotes)}</pre></div>` : "";

  const visual = offer.visualAssessment?.trim() || "";
  const technical = offer.technicalAssessment?.trim() || "";
  const visualHealthInner =
    visual && parseScoreOutOf10(visual) !== null
      ? `<div class="ipdf-card">${healthScaleHtml(accent, "Vizuālais novērtējums", visual, { omitHeading: true })}</div>`
      : "";
  const visualDetailInner = visual ? `<div class="ipdf-card"><pre>${esc(visual)}</pre></div>` : "";
  const technicalHealthInner =
    technical && parseScoreOutOf10(technical) !== null
      ? `<div class="ipdf-card">${healthScaleHtml(accent, "Tehniskais novērtējums", technical, { omitHeading: true })}</div>`
      : "";
  const technicalDetailInner = technical ? `<div class="ipdf-card"><pre>${esc(technical)}</pre></div>` : "";

  const summary = offer.summary?.trim() || "";
  const summaryInner = summary ? `<div class="ipdf-summary"><pre>${esc(summary)}</pre></div>` : "";

  const evalSections = [
    blockIf("Novērtējuma atzīmes", checklistHtml),
    blockIf("Īpašas atzīmes", specialInner),
    blockIf("Vizuālais novērtējums", visualHealthInner),
    blockIf("Detalizēts apraksts (vizuālais)", visualDetailInner),
    blockIf("Tehniskais novērtējums", technicalHealthInner),
    blockIf("Detalizēts apraksts (tehniskais)", technicalDetailInner),
    blockIf("Kopsavilkums", summaryInner),
  ]
    .filter(Boolean)
    .join("");

  const carPrice = offer.carPrice?.trim() || offer.priceGermany?.trim() || "";
  const deliveryPrice = offer.deliveryPrice?.trim() || "";
  const commissionFee = offer.commissionFee?.trim() || "";
  const totalValue = parseMoney(carPrice) + parseMoney(deliveryPrice) + parseMoney(commissionFee);
  const pricingRows =
    rowIf("Automašīnas cena", carPrice) +
    rowIf("Piegādes cena", deliveryPrice) +
    rowIf("Komisijas maksa", commissionFee) +
    rowIf("Kopā", totalValue > 0 ? fmtMoney(totalValue) : "") +
    rowIf("Piedāvājums spēkā (dienas)", offer.offerValidDays);
  const pricingTable = wrapTable(pricingRows);

  const imageAttachments = offer.attachments.filter(
    (a) => a.mimeType.startsWith("image/") && a.dataUrl.startsWith("data:image/"),
  );
  const otherAttachments = offer.attachments.filter(
    (a) => !a.mimeType.startsWith("image/") || !a.dataUrl.startsWith("data:image/"),
  );

  const gallery =
    imageAttachments.length > 0
      ? `<div class="ipdf-gallery">${imageAttachments
          .map((img) => `<figure class="ipdf-photo"><img src="${img.dataUrl}" alt=""/></figure>`)
          .join("")}</div>`
      : "";

  const otherTable =
    otherAttachments.length > 0
      ? `<table class="ipdf-kv">${otherAttachments
          .map((a, i) => `<tr><th>Fails ${i + 1}</th><td>${esc(a.name)}</td></tr>`)
          .join("")}</table>`
      : "";

  const filesInner = [gallery, otherTable].filter(Boolean).join("");

  const body = `${header}
    ${blockIf("Klienta dati", clientTable)}
    ${pamatInner.trim() ? blockIf("Pamatinformācija", pamatInner) : ""}
    ${evalSections}
    ${blockIf("Cenas un piedāvājums", pricingTable)}
    ${blockIf("Fotogrāfijas", filesInner, "ipdf-blk--media")}
    ${buildIrissPrintFooterHtml(accent)}`;

  return irissPrintShell(accent, heroTitle, body);
}
