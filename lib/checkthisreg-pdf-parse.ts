/**
 * CheckThisReg dīlera PDF parsētājs (Nila «jā» 27.11.2026, A): Nila nopirktās atskaites PDF -> dīlera dati.
 *
 * Ievade - PDF teksta elementi ar koordinātām (pdfjs `getTextContent`), nevis salīmēts teksts: `pdf-parse`
 * salīmē kolonnas («2018-07-19163451CLIENT…»), tāpēc kolonnas nosakām pēc tabulas virsraksta x pozīcijām.
 *
 * Atbalstītie formāti (paraugi no Nila pasūtījumiem, 27.11):
 *  - Renault «Operation Detail» (viena vizīte vienā PDF; datums/km rinda var nebūt - tad datums no faila nosaukuma)
 *  - Renault «MAINTENANCE PROGRAM» (ražotāja intervāli km; gadu atzīmes ir grafika - tekstā nav)
 *  - BMW «Vehicle history» (auto dati, aprīkojums, Service History, Key Read History, Repair History)
 * Cits formāts -> `unknown`: PDF + teksts saglabājas, adminā «jāapstrādā ar roku».
 *
 * Tīra funkcija (bez server-only) - testējama. Klienta tekstos avota nosaukums netiek lietots.
 */

export type CtrPdfTextItem = { page: number; x: number; y: number; w: number; str: string };

export type CtrPdfCell = { x: number; end: number; text: string };
export type CtrPdfRow = { page: number; y: number; cells: CtrPdfCell[] };

export type CtrDocFormat = "renault_operation" | "renault_maintenance" | "bmw_vehicle_history" | "unknown";

export type CtrLabourLine = { code: string; hours: string; desc: string };
export type CtrPartLine = { partNo: string; qty: number | null; desc: string };
export type CtrCoverage = { renault: number; dreu: number; sigma: number; dealership: number; other: number };

export type CtrVisit = {
  /** YYYY-MM-DD */
  date: string;
  km: number | null;
  /** Operācijas apraksts (oriģinālvalodā). */
  titles: string[];
  notes: Array<{ label: CtrNoteLabel; value: string }>;
  labour: CtrLabourLine[];
  parts: CtrPartLine[];
  coverage: CtrCoverage | null;
  kind: "operation" | "service" | "repair";
  /** Servisa punkts, ja izdrukā norādīts (BMW Repair History). */
  location?: string;
};

export type CtrNoteLabel = "symptom" | "complaint" | "record" | "diagnostic";

export type CtrMileage = { date: string; km: number };

export type CtrMaintenanceItem = { label: string; km: number | null; years: number | null };

export type CtrMaintenance = {
  items: CtrMaintenanceItem[];
  /** Eļļas norma, tilpums, bremžu šķidrums, dzesēšanas šķidrums u.c. (oriģinālvalodā). */
  notes: string[];
};

export type ParsedCtrDoc = {
  fileName: string;
  format: CtrDocFormat;
  vin: string;
  /** Piem. «Trafic II (J83), 2.0 DCI DIESEL ENGINE, PF6, TED68» vai «BMW F 11». */
  vehicleLine: string;
  visits: CtrVisit[];
  mileage: CtrMileage[];
  maintenance: CtrMaintenance | null;
  vehicleInfo: Array<{ label: string; value: string }>;
  options: Array<{ code: string; desc: string }>;
  /** BMW Condition Based Service statusi pie atslēgas nolasījumiem (oriģinālvalodā). */
  cbs: Array<{ date: string; km: number; lines: string[] }>;
  /** Ražotāja eļļas intervāls, ja PDF to skaidri nosauc (BMW opcija «Oil service interval 24 mths / 30,000 km»). */
  oilInterval: { km: number | null; months: number | null } | null;
  /** Visas rindas teksta veidā («jāapstrādā ar roku» un RAW laukam). */
  textLines: string[];
};

const ROW_Y_TOLERANCE = 2.5;
/** Atstarpe (pt) starp elementiem, no kuras sākas jauna šūna. */
const CELL_GAP = 8;

/** Elementi -> rindas (augšā -> lejā, lapa pēc lapas) ar šūnām pēc x atstarpēm. */
export function groupCtrPdfRows(items: readonly CtrPdfTextItem[]): CtrPdfRow[] {
  const byPage = new Map<number, CtrPdfTextItem[]>();
  for (const it of items) {
    if (!it || typeof it.str !== "string" || !it.str.trim()) continue;
    const list = byPage.get(it.page) ?? [];
    list.push(it);
    byPage.set(it.page, list);
  }
  const rows: CtrPdfRow[] = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const pageRows: Array<{ y: number; items: CtrPdfTextItem[] }> = [];
    for (const it of byPage.get(page)!) {
      const hit = pageRows.find((r) => Math.abs(r.y - it.y) <= ROW_Y_TOLERANCE);
      if (hit) hit.items.push(it);
      else pageRows.push({ y: it.y, items: [it] });
    }
    pageRows.sort((a, b) => b.y - a.y);
    for (const r of pageRows) {
      const sorted = [...r.items].sort((a, b) => a.x - b.x);
      const cells: CtrPdfCell[] = [];
      for (const it of sorted) {
        const last = cells[cells.length - 1];
        const end = it.x + Math.max(0, it.w || 0);
        if (last && it.x - last.end <= CELL_GAP) {
          // Bez atstarpes, ja elementi pieskaras («B/» + «POST» -> «B/POST»).
          last.text = it.x - last.end <= 0.8 ? `${last.text}${it.str}` : `${last.text} ${it.str}`;
          last.end = Math.max(last.end, end);
        } else {
          cells.push({ x: it.x, end, text: it.str });
        }
      }
      const clean = cells
        .map((c) => ({ ...c, text: c.text.replace(/\s+/g, " ").trim() }))
        .filter((c) => c.text);
      if (clean.length) rows.push({ page, y: r.y, cells: clean });
    }
  }
  return rows;
}

export function ctrRowText(row: CtrPdfRow): string {
  return row.cells.map((c) => c.text).join(" | ");
}

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/** Lapas apakšas drukas laiks: «Friday, 27-Nov-2026 4:58:42 PM». */
const PRINT_FOOTER_RE = /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,/i;

function isoFromDmy(s: string): string {
  const m = s.trim().match(DMY_DATE_RE);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function validIso(s: string): string {
  const m = s.trim().match(ISO_DATE_RE);
  if (!m) return "";
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? s.trim() : "";
}

/** «2018-07-19.pdf», «2023-10-06 (2).pdf» -> 2018-07-19. */
export function ctrDateFromFileName(fileName: string): string {
  const m = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? validIso(m[1]) : "";
}

function parseNumber(raw: string): number | null {
  const t = raw.replace(/[\s,]/g, "").replace(/km$/i, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parsePercent(raw: string | undefined): number {
  const m = (raw ?? "").match(/(\d{1,3})\s*%/);
  return m ? Math.min(100, Number(m[1])) : 0;
}

/** «87,449 mi / 140,735 km» -> 140735. */
function kmFromMileageCell(raw: string): number | null {
  const km = raw.match(/([\d,.\s]+)\s*km\b/i);
  if (km) return parseNumber(km[1]);
  const mi = raw.match(/([\d,.\s]+)\s*mi\b/i);
  if (mi) {
    const n = parseNumber(mi[1]);
    return n == null ? null : Math.round(n * 1.609344);
  }
  return null;
}

type Col = { key: string; x: number };

/** Šūnu piesaiste kolonnām: lielākais virsraksta x, kas <= šūnas x + pielaide. */
function assignCells(row: CtrPdfRow, cols: readonly Col[], tolerance = 20): Record<string, string> {
  const out: Record<string, string> = {};
  const sorted = [...cols].sort((a, b) => a.x - b.x);
  for (const cell of row.cells) {
    let pick: Col | null = null;
    for (const c of sorted) if (c.x <= cell.x + tolerance) pick = c;
    const key = (pick ?? sorted[0]).key;
    out[key] = out[key] ? `${out[key]} ${cell.text}` : cell.text;
  }
  return out;
}

function findCellX(row: CtrPdfRow, re: RegExp): number | null {
  const c = row.cells.find((cell) => re.test(cell.text));
  return c ? c.x : null;
}

function emptyDoc(fileName: string): ParsedCtrDoc {
  return {
    fileName,
    format: "unknown",
    vin: "",
    vehicleLine: "",
    visits: [],
    mileage: [],
    maintenance: null,
    vehicleInfo: [],
    options: [],
    cbs: [],
    oilInterval: null,
    textLines: [],
  };
}

export function detectCtrDocFormat(rows: readonly CtrPdfRow[]): CtrDocFormat {
  const all = rows.map(ctrRowText).join("\n");
  if (/MODEL SERIES/.test(all) && /(Key Read History|Repair History|Service History|Specifications & Options)/.test(all)) {
    return "bmw_vehicle_history";
  }
  if (/MAINTENANCE PROGRAM/i.test(all)) return "renault_maintenance";
  if (/Operation Detail/.test(all) || /Code \(labour \/ parts\)/.test(all)) return "renault_operation";
  return "unknown";
}

function headerInfo(rows: readonly CtrPdfRow[], doc: ParsedCtrDoc): number {
  // Pirmā rinda - modelis/dzinējs; VIN rinda tieši zem tās.
  let vinIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const m = ctrRowText(rows[i]).replace(/\s+/g, "").match(VIN_RE);
    if (m && rows[i].cells.length <= 2) {
      doc.vin = m[1];
      vinIdx = i;
      break;
    }
  }
  if (vinIdx > 0) doc.vehicleLine = rows[vinIdx - 1].cells.map((c) => c.text).join(" ").slice(0, 200);
  return vinIdx;
}

const NOTE_LABELS: Array<{ re: RegExp; label: CtrNoteLabel }> = [
  { re: /^Symptom$/i, label: "symptom" },
  { re: /^Customer Complaint$/i, label: "complaint" },
  { re: /^Customer Record$/i, label: "record" },
  { re: /^Repair Diagnostic$/i, label: "diagnostic" },
];

function parseRenaultOperation(rows: readonly CtrPdfRow[], doc: ParsedCtrDoc): void {
  const fallbackDate = ctrDateFromFileName(doc.fileName);
  let opCols: Col[] | null = null;
  let codeCols: Col[] | null = null;
  let section: "none" | "op" | "notes" | "codes" = "none";
  let current: CtrVisit | null = null;
  let lastNote: { label: CtrNoteLabel; value: string } | null = null;
  let lastLine: CtrLabourLine | CtrPartLine | null = null;

  const ensureVisit = (): CtrVisit => {
    if (!current) {
      current = { date: fallbackDate, km: null, titles: [], notes: [], labour: [], parts: [], coverage: null, kind: "operation" };
      doc.visits.push(current);
    }
    return current;
  };

  for (const row of rows) {
    const text = ctrRowText(row);
    const first = row.cells[0]?.text ?? "";
    if (PRINT_FOOTER_RE.test(first)) continue;
    if (/^Operation Detail$/.test(first)) continue;

    // Operāciju tabulas virsraksts: Date | km | OTS no. | Operation Description | Renault | DREU | SIGMA | Dealership | Other
    if (/^Date$/.test(first) && row.cells.some((c) => c.text === "km")) {
      const x = (re: RegExp, fb: number) => findCellX(row, re) ?? fb;
      opCols = [
        { key: "date", x: x(/^Date$/, 45) },
        { key: "km", x: x(/^km$/, 99) },
        { key: "ots", x: x(/^OTS/, 138) },
        { key: "desc", x: x(/^Operation Description/, 177) },
        { key: "renault", x: x(/^Renault/, 316) },
        { key: "dreu", x: x(/^DREU$/, 365) },
        { key: "sigma", x: x(/^SIGMA$/, 414) },
        { key: "dealership", x: x(/^Dealership$/, 463) },
        { key: "other", x: x(/^Other$/, 512) },
      ];
      section = "op";
      continue;
    }
    if (section === "op" && /^Incident$/.test(text)) continue;

    if (/^Code \(labour/.test(first)) {
      const x = (re: RegExp, fb: number) => findCellX(row, re) ?? fb;
      codeCols = [
        { key: "code", x: x(/^Code/, 45) },
        { key: "time", x: x(/^Time$/, 174) },
        { key: "qty", x: x(/^Quantity$/, 233) },
        { key: "desc", x: x(/^Descriptions/, 292) },
      ];
      section = "codes";
      lastLine = null;
      ensureVisit();
      continue;
    }

    const noteLabel = NOTE_LABELS.find((n) => n.re.test(first));
    if (noteLabel) {
      section = "notes";
      const value = row.cells
        .slice(1)
        .map((c) => c.text)
        .join(" ")
        .trim();
      const v = ensureVisit();
      lastNote = { label: noteLabel.label, value: value === "OTS" ? "" : value };
      v.notes.push(lastNote);
      continue;
    }

    if (section === "op" && opCols) {
      const cells = assignCells(row, opCols, 8);
      const date = validIso(cells.date ?? "");
      if (date) {
        current = {
          date,
          km: parseNumber(cells.km ?? ""),
          titles: [],
          notes: [],
          labour: [],
          parts: [],
          coverage: {
            renault: parsePercent(cells.renault),
            dreu: parsePercent(cells.dreu),
            sigma: parsePercent(cells.sigma),
            dealership: parsePercent(cells.dealership),
            other: parsePercent(cells.other),
          },
          kind: "operation",
        };
        doc.visits.push(current);
        const desc = [cells.ots && !/^[A-Z0-9]{2,8}$/.test(cells.ots) ? cells.ots : "", cells.desc ?? ""].filter(Boolean).join(" ").trim();
        if (desc) current.titles.push(desc);
        continue;
      }
      // Apraksta turpinājums nākamajā rindā («WHEEL», «14.02.2018 (A)»).
      if (current && cells.desc && Object.keys(cells).length === 1) {
        const v: CtrVisit = current;
        if (v.titles.length) v.titles[v.titles.length - 1] = `${v.titles[v.titles.length - 1]} ${cells.desc}`.trim();
        else v.titles.push(cells.desc);
        continue;
      }
    }

    if (section === "notes" && lastNote && row.cells.length === 1 && row.cells[0].x > 120) {
      lastNote.value = `${lastNote.value} ${row.cells[0].text}`.trim();
      continue;
    }

    if (section === "codes" && codeCols) {
      const cells = assignCells(row, codeCols, 20);
      const v = ensureVisit();
      const hours = (cells.time ?? "").match(/^(\d+(?:[.,]\d+)?)\s*h$/i);
      if (cells.code && hours) {
        lastLine = { code: cells.code, hours: hours[1].replace(",", "."), desc: (cells.desc ?? "").trim() };
        v.labour.push(lastLine);
        continue;
      }
      if (cells.code && cells.qty != null) {
        const q = cells.qty.replace(/\s+/g, "");
        // «000200» = 2,00 (dažās izdrukās daudzums bez komata).
        const qty = /^0\d{3,}$/.test(q) ? Number(q) / 100 : /^-?\d+(\.\d+)?$/.test(q) ? Number(q) : null;
        lastLine = { partNo: cells.code, qty, desc: (cells.desc ?? "").trim() };
        v.parts.push(lastLine);
        continue;
      }
      if (!cells.code && cells.desc && lastLine) {
        lastLine.desc = `${lastLine.desc} ${cells.desc}`.trim();
        continue;
      }
    }
  }
}

function parseRenaultMaintenance(rows: readonly CtrPdfRow[], doc: ParsedCtrDoc): void {
  const items: CtrMaintenanceItem[] = [];
  const notes: string[] = [];
  let kmX: number | null = null;
  let yearCols: Array<{ year: number; x: number }> = [];
  let mode: "head" | "items" | "checks" | "fluids" = "head";
  for (const row of rows) {
    const text = ctrRowText(row);
    const first = row.cells[0]?.text ?? "";
    if (PRINT_FOOTER_RE.test(first)) continue;
    if (/^KM$/.test(first) || row.cells.some((c) => c.text === "KM")) {
      kmX = findCellX(row, /^KM$/);
      continue;
    }
    const numeric = row.cells.filter((c) => /^\d{1,2}$/.test(c.text));
    if (numeric.length >= 6) {
      yearCols = numeric.map((c) => ({ year: Number(c.text), x: c.x }));
      mode = "items";
      continue;
    }
    if (/^THE FOLLOWING OPERATIONS/i.test(first)) {
      mode = "checks";
      continue;
    }
    if (/^FLUIDS/i.test(first)) {
      mode = "fluids";
      continue;
    }
    if (mode === "items") {
      const label = first;
      const kmCell = row.cells.find((c, i) => i > 0 && /^\d{4,6}$/.test(c.text) && (kmX == null || Math.abs(c.x - kmX) < 40));
      // Gada atzīmes, ja tās ir teksts (paraugos tās ir grafika - tad null).
      const marks = row.cells.filter((c, i) => i > 0 && c !== kmCell && yearCols.length > 0 && c.x > (yearCols[0]?.x ?? 0) - 10);
      let years: number | null = null;
      if (marks.length > 0 && yearCols.length > 0) {
        const nearest = (x: number) => yearCols.reduce((b, c) => (Math.abs(c.x - x) < Math.abs(b.x - x) ? c : b), yearCols[0]).year;
        years = nearest(marks[0].x);
      }
      if (kmCell || years != null) items.push({ label, km: kmCell ? Number(kmCell.text) : null, years });
      continue;
    }
    if (mode === "fluids") {
      notes.push(text.replace(/\s*\|\s*/g, " "));
      continue;
    }
    if (/oil quality|intermediate visit|Interim Health Check/i.test(text)) notes.push(text.replace(/\s*\|\s*/g, " "));
  }
  doc.maintenance = { items, notes: notes.filter((n) => !/^The use of engine oil additive/i.test(n)).slice(0, 40) };
}

/** BMW izdrukā atstarpes ap pieturzīmēm: «GmbH , Nienburg», «O - ring», «M + S». */
export function tidyCtrText(t: string): string {
  return t
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/([(])\s+/g, "$1")
    .replace(/([A-Za-z])\s+-\s+([A-Za-z])/g, "$1-$2")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBmw(rows: readonly CtrPdfRow[], doc: ParsedCtrDoc): void {
  let section: "vehicle" | "options" | "service" | "keyread" | "repair" = "vehicle";
  let headerRow: CtrPdfRow | null = null;
  let currentCbs: { date: string; km: number; lines: string[] } | null = null;
  let currentVisit: CtrVisit | null = null;
  let partCols: Col[] | null = null;
  doc.vehicleLine = tidyCtrText(rows[0]?.cells.map((c) => c.text).join(" ") ?? "").replace(/^BMW\s+([A-Z])\s+(\d+)/, "BMW $1$2").slice(0, 120);
  for (const row of rows.slice(1)) {
    const text = ctrRowText(row);
    const first = row.cells[0]?.text ?? "";
    if (/^Specifications & Options$/i.test(first)) {
      section = "options";
      continue;
    }
    if (/^Service History$/i.test(first)) {
      section = "service";
      currentVisit = null;
      continue;
    }
    if (/^Key Read History$/i.test(first)) {
      section = "keyread";
      continue;
    }
    if (/^Repair History$/i.test(first)) {
      section = "repair";
      currentVisit = null;
      continue;
    }
    if (section === "vehicle") {
      // Virsrakstu un vērtību rindas mijas: «MODEL SERIES | VIN | …» -> «F 11 | WBAXX 00000 XX 00000 | …».
      if (!headerRow) {
        headerRow = row;
        continue;
      }
      for (const cell of row.cells) {
        const h = headerRow.cells.reduce((b, c) => (Math.abs(c.x - cell.x) < Math.abs(b.x - cell.x) ? c : b), headerRow.cells[0]);
        if (Math.abs(h.x - cell.x) > 40) continue;
        if (/ENGINE NUMBER/i.test(h.text)) continue;
        const value = h.text === "VIN" ? cell.text.replace(/\s+/g, "") : tidyCtrText(cell.text);
        doc.vehicleInfo.push({ label: h.text, value });
        if (h.text === "VIN" && VIN_RE.test(value)) doc.vin = value.match(VIN_RE)![1];
      }
      headerRow = null;
      continue;
    }
    if (section === "options") {
      if (/^Code$/.test(first)) continue;
      for (let i = 0; i + 1 < row.cells.length; i += 2) {
        const code = row.cells[i].text.replace(/\s+/g, "");
        const desc = tidyCtrText(row.cells[i + 1].text);
        if (/^[0-9A-Z]{3,5}$/.test(code)) doc.options.push({ code, desc });
        const oil = desc.match(/Oil service interval\s*(\d{1,2})\s*mths?\s*\/\s*([\d,.]+)\s*km/i);
        if (oil) doc.oilInterval = { months: Number(oil[1]), km: parseNumber(oil[2]) };
      }
      continue;
    }
    const dmy = isoFromDmy(first);
    if (section === "keyread") {
      if (dmy) {
        const km = kmFromMileageCell(row.cells[1]?.text ?? "");
        if (km != null) {
          doc.mileage.push({ date: dmy, km });
          currentCbs = { date: dmy, km, lines: [] };
          doc.cbs.push(currentCbs);
        }
        continue;
      }
      if (/^Icon$/.test(first) || /Component/.test(text)) continue;
      if (currentCbs) currentCbs.lines.push(row.cells.map((c) => tidyCtrText(c.text)).join(" - "));
      continue;
    }
    // Service History / Repair History
    if (/^No (service|repair) history found/i.test(first)) continue;
    if (dmy) {
      const km = kmFromMileageCell(row.cells[1]?.text ?? "");
      const rest = row.cells.slice(2).map((c) => tidyCtrText(c.text));
      const location = rest.find((t) => !/^(Dealer ID|Order)\s*:/i.test(t)) ?? "";
      currentVisit = {
        date: dmy,
        km,
        titles: [],
        notes: [],
        labour: [],
        parts: [],
        coverage: null,
        kind: section === "repair" ? "repair" : "service",
        ...(location ? { location: location.slice(0, 200) } : {}),
      };
      doc.visits.push(currentVisit);
      partCols = null;
      continue;
    }
    if (!currentVisit) continue;
    const v: CtrVisit = currentVisit;
    if (/^Part Name$/i.test(first)) {
      partCols = [
        { key: "name", x: row.cells[0].x },
        { key: "no", x: findCellX(row, /^Part Number$/i) ?? 290 },
        { key: "qty", x: findCellX(row, /^Quantity$/i) ?? 480 },
      ];
      continue;
    }
    if (partCols) {
      const cells = assignCells(row, partCols, 20);
      if (cells.name && (cells.no || cells.qty)) {
        v.parts.push({
          partNo: (cells.no ?? "").replace(/\s+/g, " ").trim(),
          qty: parseNumber(cells.qty ?? ""),
          desc: tidyCtrText(cells.name),
        });
        continue;
      }
    }
    v.titles.push(tidyCtrText(row.cells.map((c) => c.text).join(" ")));
  }
}

/** Viens PDF (teksta elementi) -> strukturēti dati. */
export function parseCtrPdfItems(fileName: string, items: readonly CtrPdfTextItem[]): ParsedCtrDoc {
  const doc = emptyDoc(fileName);
  const rows = groupCtrPdfRows(items);
  doc.textLines = rows.filter((r) => !PRINT_FOOTER_RE.test(r.cells[0]?.text ?? "")).map(ctrRowText);
  doc.format = detectCtrDocFormat(rows);
  if (doc.format === "bmw_vehicle_history") {
    parseBmw(rows, doc);
    return doc;
  }
  const vinIdx = headerInfo(rows, doc);
  const body = vinIdx >= 0 ? rows.slice(vinIdx + 1) : rows;
  if (doc.format === "renault_operation") parseRenaultOperation(body, doc);
  else if (doc.format === "renault_maintenance") parseRenaultMaintenance(body, doc);
  return doc;
}

/* ------------------------------------------------------------------ */
/* Vairāku PDF apvienošana un rindas pasūtījuma dīlera blokam          */

export type CtrCombined = {
  vin: string;
  vehicleLine: string;
  docs: ParsedCtrDoc[];
  visits: CtrVisit[];
  mileage: CtrMileage[];
  maintenance: CtrMaintenance | null;
  oilInterval: { km: number | null; months: number | null } | null;
  /** Vai bija kaut viens atpazīts formāts ar datiem. */
  hasStructuredData: boolean;
  unknownDocs: string[];
};

export function combineCtrDocs(docs: readonly ParsedCtrDoc[]): CtrCombined {
  const visits = docs
    .flatMap((d) => d.visits)
    .filter((v) => v.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const mileageMap = new Map<string, CtrMileage>();
  for (const v of visits) if (v.date && v.km != null) mileageMap.set(`${v.date}|${v.km}`, { date: v.date, km: v.km });
  for (const d of docs) for (const m of d.mileage) mileageMap.set(`${m.date}|${m.km}`, m);
  const maintenance = docs.find((d) => d.maintenance && d.maintenance.items.length > 0)?.maintenance ?? null;
  const oilFromMaint = maintenance?.items.find((i) => /engine oil|oil filter/i.test(i.label) && i.km != null) ?? null;
  const oilInterval =
    docs.find((d) => d.oilInterval)?.oilInterval ??
    (oilFromMaint ? { km: oilFromMaint.km, months: oilFromMaint.years != null ? oilFromMaint.years * 12 : null } : null);
  const hasStructuredData =
    visits.length > 0 || mileageMap.size > 0 || Boolean(maintenance) || docs.some((d) => d.options.length > 0);
  return {
    vin: docs.find((d) => d.vin)?.vin ?? "",
    vehicleLine: docs.find((d) => d.vehicleLine)?.vehicleLine ?? "",
    docs: [...docs],
    visits,
    mileage: [...mileageMap.values()].sort((a, b) => b.date.localeCompare(a.date)),
    maintenance,
    oilInterval,
    hasStructuredData,
    unknownDocs: docs.filter((d) => d.format === "unknown").map((d) => d.fileName),
  };
}

const NOTE_LV: Record<CtrNoteLabel, string> = {
  symptom: "Simptoms",
  complaint: "Klienta sūdzība",
  record: "Dīlera ieraksts",
  diagnostic: "Diagnoze",
};

function fmtHours(h: string): string {
  return h.replace(".", ",");
}

function fmtQty(q: number): string {
  return Number.isInteger(q) ? String(q) : String(q).replace(".", ",");
}

/** Renault pakešu prefikss «RMFNZF FORFAIT LLD REVISION RENAULT - SO Replace cabin filter» -> «Replace cabin filter». */
export function cleanRenaultWorkDesc(desc: string): string {
  let t = desc.replace(/\s+/g, " ").trim();
  t = t.replace(/^[A-Z0-9]{5,7}\s+FORFAIT\b.*?\s-\s+/, "");
  t = t.replace(/^(SO|GO)\s+/, "");
  return t.trim();
}

function coverageLine(c: CtrCoverage | null): string {
  if (!c) return "";
  const parts: string[] = [];
  if (c.renault > 0) parts.push(`ražotāja garantija ${c.renault}%`);
  if (c.dreu > 0) parts.push(`DREU ${c.dreu}%`);
  if (c.sigma > 0) parts.push(`SIGMA ${c.sigma}%`);
  if (c.dealership > 0) parts.push(`dīleris ${c.dealership}%`);
  if (c.other > 0) parts.push(`cits maksātājs ${c.other}%`);
  if (parts.length === 0) return "Apmaksāja klients (ražotāja garantija nesedza)";
  return `Apmaksa: ${parts.join(", ")}`;
}

/** Vienas vizītes darbu teksts (rindām «Servisa un remontu vēsture»). Oriģinālais apraksts paliek - tulko AI. */
export function ctrVisitWorksText(v: CtrVisit): string {
  const lines: string[] = [];
  if (v.kind === "repair" && v.parts.length > 0 && v.labour.length === 0) {
    lines.push("Remonta pasūtījums - izmantotās rezerves daļas:");
  }
  for (const t of v.titles) {
    const s = t.replace(/\s+/g, " ").trim();
    // «CLIENT AU COMPTANT 19.07.2018 (A)» ir apmaksas veids, ne darbs.
    if (!s || /^CLIENT\b/i.test(s)) continue;
    if (!lines.includes(s)) lines.push(s);
  }
  for (const n of v.notes) if (n.value.trim()) lines.push(`${NOTE_LV[n.label]}: ${n.value.trim()}`);
  for (const l of v.labour) {
    const d = cleanRenaultWorkDesc(l.desc) || l.desc;
    lines.push(`${d} (${l.code}, ${fmtHours(l.hours)} h)`);
  }
  for (const p of v.parts) {
    if (/ECOPARTICIPATION/i.test(p.desc)) continue;
    if (p.qty != null && p.qty <= 0) continue;
    const d = cleanRenaultWorkDesc(p.desc) || p.desc;
    const q = p.qty != null && p.qty !== 1 ? ` x${fmtQty(p.qty)}` : "";
    lines.push(`${d}${q} (${p.partNo})`);
  }
  const cov = coverageLine(v.coverage);
  if (cov) lines.push(cov);
  return lines.join("\n");
}

function dmyFromIso(iso: string): string {
  const m = iso.match(ISO_DATE_RE);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

export type CtrServiceWorkRow = { date: string; odometer: string; location: string; works: string };
export type CtrServiceHistoryRow = { date: string; odometer: string; country: string };

/**
 * Rindas «Servisa un remontu vēsture»: viena rinda dienā (vairākas tās dienas operācijas - viena vizīte,
 * katrai savs apmaksas teksts). Nobraukums - lielākais tās dienas ierakstā.
 */
export function ctrServiceWorkRows(c: CtrCombined, location: string): CtrServiceWorkRow[] {
  const byDate = new Map<string, { km: number | null; works: string[]; location: string }>();
  for (const v of c.visits) {
    if (!v.date) continue;
    const text = ctrVisitWorksText(v);
    if (!text.trim()) continue;
    const prev = byDate.get(v.date) ?? { km: null, works: [], location: "" };
    if (!prev.location && v.location) prev.location = v.location;
    if (v.km != null) prev.km = prev.km == null ? v.km : Math.max(prev.km, v.km);
    if (!prev.works.includes(text)) prev.works.push(text);
    byDate.set(v.date, prev);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, g]) => ({
      date: dmyFromIso(date),
      odometer: g.km != null ? String(Math.round(g.km)) : "",
      location: g.location || location,
      works: g.works.join("\n"),
    }));
}

export function ctrServiceHistoryRows(c: CtrCombined): CtrServiceHistoryRow[] {
  return c.mileage.map((m) => ({ date: dmyFromIso(m.date), odometer: String(Math.round(m.km)), country: "" }));
}

/** Dīlera nosaukums vietas kolonnai (bez avota nosaukuma). */
export function ctrDealerLocation(make: string): string {
  const m = make.trim();
  return m ? `${m} dīleris` : "Dīleris";
}

function fmtKm(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** RAW lauks: oriģinālie dati (bez avota nosaukuma - klientam tas nav jāredz). */
export function ctrRawText(c: CtrCombined, args: { make: string; receivedDmy: string }): string {
  const out: string[] = [];
  out.push(
    `Avots: ${ctrDealerLocation(args.make)} - dīlera sistēmas izdrukas (${c.docs.length} PDF, saņemti ${args.receivedDmy}). ${c.vehicleLine ? `Transportlīdzeklis: ${c.vehicleLine}.` : ""}`.trim(),
  );
  for (const v of c.visits) {
    const cov = v.coverage
      ? ` | Renault Incident ${v.coverage.renault}%, DREU ${v.coverage.dreu}%, SIGMA ${v.coverage.sigma}%, Dealership ${v.coverage.dealership}%, Other ${v.coverage.other}%`
      : "";
    out.push("");
    out.push(`${v.date || "datums nav"} | ${v.km != null ? `${v.km} km` : "km nav"}${v.titles.length ? ` | ${v.titles.join(" / ")}` : ""}${cov}`);
    for (const n of v.notes) if (n.value) out.push(`  ${n.label}: ${n.value}`);
    for (const l of v.labour) out.push(`  ${l.code} ${l.hours} h ${l.desc}`);
    for (const p of v.parts) out.push(`  ${p.partNo} ${p.qty ?? ""} ${p.desc}`.replace(/\s+/g, " "));
  }
  const mileageOnly = c.mileage.filter((m) => !c.visits.some((v) => v.date === m.date));
  if (mileageOnly.length) {
    out.push("");
    out.push("Nobraukuma nolasījumi:");
    for (const m of mileageOnly) out.push(`  ${m.date} ${m.km} km`);
  }
  for (const d of c.docs) {
    for (const cb of d.cbs) {
      out.push("");
      out.push(`Servisa statusi ${cb.date} (${cb.km} km):`);
      for (const l of cb.lines) out.push(`  ${l}`);
    }
  }
  if (c.maintenance) {
    out.push("");
    out.push("MAINTENANCE PROGRAM (km vai laiks - kas pirmais):");
    for (const i of c.maintenance.items) out.push(`  ${i.label}${i.km != null ? ` ${i.km} km` : ""}${i.years != null ? ` / ik ${i.years} g.` : ""}`);
    for (const n of c.maintenance.notes) out.push(`  ${n}`);
  }
  const opts = c.docs.flatMap((d) => d.options);
  if (opts.length) {
    out.push("");
    out.push(`Aprīkojums (${opts.length}): ${opts.map((o) => `${o.code} ${o.desc}`).join("; ")}`);
  }
  for (const d of c.docs) {
    if (d.format !== "unknown") continue;
    out.push("");
    out.push(`[${d.fileName}] - formāts nav atpazīts, teksts:`);
    out.push(...d.textLines.slice(0, 400));
  }
  return out.join("\n").slice(0, 60_000);
}

/** AI konteksts: fakti īsi un skaidri (komentāru ģenerēšanai). */
export function ctrAiContext(c: CtrCombined, args: { make: string; receivedDmy: string }): string {
  const out: string[] = [];
  out.push(`Dīlera dati: ${ctrDealerLocation(args.make)} - dīlera sistēmas izdrukas (${c.docs.length} PDF), ievadīti automātiski ${args.receivedDmy}.`);
  if (c.vehicleLine) out.push(`Transportlīdzeklis pēc dīlera sistēmas: ${c.vehicleLine}.`);
  const info = c.docs.flatMap((d) => d.vehicleInfo).filter((i) => i.value && i.label !== "VIN");
  if (info.length) out.push(`Auto dati: ${info.map((i) => `${i.label}: ${i.value}`).join("; ")}.`);
  if (c.maintenance?.items.length) {
    out.push(
      `Ražotāja apkopes programma šim VIN: ${c.maintenance.items
        .map((i) => `${i.label}${i.km != null ? ` ik ${fmtKm(i.km)} km` : ""}${i.years != null ? ` / ${i.years} g.` : ""}`)
        .join("; ")}. Gadu intervāli izdrukā ir tikai grafikā - tekstā nav, ja nav norādīti.`,
    );
  }
  if (c.oilInterval?.km) {
    out.push(`Ražotāja eļļas maiņas intervāls: ${fmtKm(c.oilInterval.km)} km${c.oilInterval.months ? ` / ${c.oilInterval.months} mēn.` : ""}.`);
  }
  if (c.visits.length) {
    out.push(`Fakti: ${c.visits.length} dīlera vizītes:`);
    for (const v of c.visits) {
      const works = ctrVisitWorksText(v).split("\n").join("; ");
      out.push(`- ${dmyFromIso(v.date) || "datums nav"}${v.km != null ? `, ${fmtKm(v.km)} km` : ", nobraukums ierakstā nav"}: ${works}`);
    }
    out.push("Pozīcijās bez darbības vārda (piem. tikai detaļas nosaukums) nav rakstīts, ka detaļa nomainīta - to neapgalvot.");
  } else {
    out.push("Dīlera izdrukās nav servisa vai remonta vizīšu ierakstu.");
  }
  const reads = c.mileage.filter((m) => !c.visits.some((v) => v.date === m.date));
  if (reads.length) out.push(`Nobraukuma nolasījumi (dīlera sistēma): ${reads.map((m) => `${dmyFromIso(m.date)} ${fmtKm(m.km)} km`).join("; ")}.`);
  return out.join("\n").slice(0, 20_000);
}
