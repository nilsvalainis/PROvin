/**
 * CSDD paplašinātie lauki no raw: tehnisko apskašu vēsture, īpašnieku maiņas, iepriekšējā valsts.
 */

export type CsddInspectionDefectRow = {
  code: string;
  rating: string;
  description: string;
};

export type CsddPreviousInspectionBlock = {
  inspectionType: string;
  /** Apskates datums (DD.MM.GGGG) — Detalizētajam vērtējumam no nobraukuma / galvas. */
  inspectionDateText: string;
  /** No raw „Nākamās apskates datums” (DD.MM.GGGG) — tikai vēsturiskiem blokiem. */
  nextInspectionDateText: string;
  odometer: string;
  ratingLabel: string;
  ratingLevel: 1 | 2 | 3 | null;
  smokeCoefficient: string;
  notes: string;
  defects: CsddInspectionDefectRow[];
};

export type CsddTechnicalInspectionRow = {
  date: string;
  inspectionType: string;
  ratingLabel: string;
  /** Kopējais novērtējums (1–3). */
  ratingLevel: 1 | 2 | 3 | null;
  /** Augstākais defekta novērtējums tabulā (1–3). */
  maxDefectLevel: 1 | 2 | 3 | null;
  smokeCoefficient: string;
  notes: string;
  defects: CsddInspectionDefectRow[];
};

export type CsddOwnerChangeRow = {
  date: string;
  label: string;
};

const PAGE_FOOTER_RE = /^\s*\d+\s*\/\s*\d+\s*$/;
const DEFECT_ROW_RE = /^([\d.]+)\s+(\d)\s+(.*)$/;
const OLD_DEFECT_ROW_RE = /^(\d{3})\s+(\d)\s+(.*)$/;
/** Teksts defekta aprakstā — sākas jauna CSDD sadaļa (nav trūkumu turpinājums). */
const CSDD_TAIL_SECTION_IN_LINE_RE =
  /\s+(Iepriekšēj[āa]s\s+reģistrācijas(?:\s+valsts)?|Transportlīdzekļa\s+reģistrācija|Pēdēj[āa]\s+tehnisk[āa]\s+apskate|Nākoš[āa]\s+TA\b|Tehniskie\s+dati|Informācija\s+sagatavota|Nobraukuma\s+vēsture|Detalizētais\s+vērtējums|Iepriekšējās\s+apskates\s+dati)/i;
const CSDD_SECTION_START_LINE_RE =
  /^(Iepriekšēj[āa]s\s+reģistrācijas|Transportlīdzekļa\s+reģistrācija|Pēdēj[āa]\s+tehnisk[āa]\s+apskate|Nākoš[āa]\s+TA\b|Tehniskie\s+dati|Informācija\s+sagatavota|Nobraukuma\s+vēsture|Detalizētais\s+vērtējums|Iepriekšējās\s+apskates\s+dati)/i;
const TA_HISTORY_SECTION_END_RE =
  /Informācija\s+sagatavota\s+elektroniski|Powered\s+by\s+TCPDF|Iepriekšēj[āa]s\s+reģistrācijas\s+valsts|Transportlīdzekļa\s+reģistrācija|Pēdēj[āa]\s+tehnisk[āa]\s+apskate/im;

/** No defekta apraksta izgriež CSDD reģistrācijas / galvas u. c. sadaļu saturu. */
export function sanitizeDefectDescription(desc: string): string {
  let d = desc.replace(/;+\s*$/, "").trim();
  const m = d.match(CSDD_TAIL_SECTION_IN_LINE_RE);
  if (m?.index != null && m.index > 0) {
    d = d.slice(0, m.index).trim();
  }
  return d;
}

function finalizeDefectRow(row: CsddInspectionDefectRow): CsddInspectionDefectRow {
  return { ...row, description: sanitizeDefectDescription(row.description) };
}

export function emptyCsddPreviousInspectionBlock(): CsddPreviousInspectionBlock {
  return {
    inspectionType: "",
    inspectionDateText: "",
    nextInspectionDateText: "",
    odometer: "",
    ratingLabel: "",
    ratingLevel: null,
    smokeCoefficient: "",
    notes: "",
    defects: [],
  };
}

export function previousInspectionBlockHasData(b: CsddPreviousInspectionBlock): boolean {
  return Boolean(
    b.inspectionType.trim() ||
      b.odometer.trim() ||
      b.ratingLabel.trim() ||
      b.smokeCoefficient.trim() ||
      b.notes.trim() ||
      (b.defects ?? []).some((d) => d.code.trim() || d.description.trim()),
  );
}

export function lvDateToIsoFlexible(s: string): string {
  const t = s.trim().replace(/\//g, ".");
  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return "";
}

export function isoDateToLvDisplay(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return iso.trim();
}

function normalizeOdometerDigits(raw: string): string {
  const digits = raw.replace(/\s+/g, " ").trim().replace(/\s*km\s*$/i, "").replace(/[^\d]/g, "");
  return digits || raw.trim();
}

function parseKeyValueLine(line: string): { key: string; val: string } | null {
  const tabs = line.split("\t");
  if (tabs.length >= 2) {
    const key = tabs[0].replace(/:\s*$/, "").trim();
    const val = tabs.slice(1).join("\t").trim();
    if (key && val) return { key, val };
  }
  const colon = line.match(/^([^:]+):\s*(.+)$/);
  if (colon?.[1] && colon[2]) return { key: colon[1].trim(), val: colon[2].trim() };
  return null;
}

function normPrevKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/:\s*$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function extractSectionAfterHeader(
  raw: string,
  headerRe: RegExp,
  endRes: RegExp,
): string {
  const text = normalizeCsddRawText(raw);
  const header = headerRe.exec(text);
  if (!header) return "";
  const tail = text.slice(header.index! + header[0].length);
  const end = tail.search(endRes);
  return end >= 0 ? tail.slice(0, end) : tail;
}

function extractDetailedRatingSection(raw: string): string {
  return extractSectionAfterHeader(
    raw,
    /Detalizētais\s+vērtējums/i,
    /^(Iepriekšējās\s+apskates\s+dati|Nobraukuma\s+vēsture|Tehnisko\s+apskašu\s+vēsture|Transportlīdzekļa\s+reģistrācija|Pēdējā\s+tehniskā\s+apskate)/im,
  );
}

function extractPreviousInspectionSection(raw: string): string {
  return extractSectionAfterHeader(
    raw,
    /Iepriekšējās\s+apskates\s+dati/i,
    /^(Nobraukuma\s+vēsture|Tehnisko\s+apskašu\s+vēsture|Transportlīdzekļa\s+reģistrācija|Pēdējā\s+tehniskā\s+apskate)/im,
  );
}

function extractTehniskieDatiHead(raw: string): string {
  const text = normalizeCsddRawText(raw);
  const idx = text.search(/Detalizētais\s+vērtējums/i);
  if (idx >= 0) return text.slice(0, idx);
  const idx2 = text.search(/Iepriekšējās\s+apskates\s+dati/i);
  if (idx2 >= 0) return text.slice(0, idx2);
  const idx3 = text.search(/Nobraukuma\s+vēsture/i);
  if (idx3 >= 0) return text.slice(0, idx3);
  return text.slice(0, 2500);
}

function parseMetadataIntoBlock(section: string, block: CsddPreviousInspectionBlock): void {
  let inDefectTable = false;
  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    if (!line || PAGE_FOOTER_RE.test(line)) continue;

    if (/^Kods\b/i.test(line) && /Trūkumi/i.test(line)) {
      inDefectTable = true;
      continue;
    }

    const defect = parseTabDefectLine(line);
    if (defect) {
      inDefectTable = true;
      block.defects.push(defect);
      continue;
    }

    if (inDefectTable) continue;

    const kv = parseKeyValueLine(line);
    if (!kv) continue;
    const nk = normPrevKey(kv.key);
    const val = kv.val.replace(/;+\s*$/, "").trim();

    if (nk.includes("parbaudes") && nk.includes("veids")) {
      block.inspectionType = val;
    } else if (nk.includes("nakamas") && nk.includes("apskates")) {
      block.nextInspectionDateText = val;
    } else if (nk.includes("odometra")) {
      block.odometer = normalizeOdometerDigits(val);
    } else if (nk.includes("novertejum")) {
      block.ratingLabel = val;
      const rm = val.match(/^(\d)/);
      if (rm) block.ratingLevel = toRatingLevel(Number.parseInt(rm[1]!, 10));
    } else if (nk.includes("dumainib")) {
      block.smokeCoefficient = val;
    } else if (nk.includes("piezim")) {
      block.notes = val;
    }
  }
}

/** Nobraukuma tabulā atrod datumu pēc odometra (pirmā sakritība). */
export function findMileageDateForOdometer(raw: string, odometer: string): string {
  const target = normalizeOdometerDigits(odometer);
  if (!target) return "";
  const text = normalizeCsddRawText(raw);
  for (const line of text.split("\n")) {
    const t = line.trim();
    const dash = t.match(/^(\d[\d\s]*)\s*[-–—]\s*(\d{2}[./]\d{2}[./]\d{4})/);
    if (dash?.[1] && dash[2] && normalizeOdometerDigits(dash[1]) === target) {
      return normalizeDotDate(dash[2]);
    }
    const tab = t.split("\t");
    if (tab.length >= 2) {
      const o = normalizeOdometerDigits(tab[1] ?? tab[0] ?? "");
      const d = (tab[0] ?? tab[1] ?? "").match(/\d{2}[./]\d{2}[./]\d{4}/);
      if (o === target && d) return normalizeDotDate(d[0]);
    }
  }
  return "";
}

/** Pirmais „Nākamās apskates datums” visā raw; rezerve — „Nākošā TA”. */
export function extractFirstNextInspectionDateIso(raw: string): string | null {
  const text = normalizeCsddRawText(raw);
  for (const line of text.split("\n")) {
    const m = line.match(/Nākamās\s+apskates\s+datums\s*:\s*(.+)$/i);
    if (!m?.[1]) continue;
    const dm = m[1].trim().match(/\d{2}[./]\d{2}[./]\d{4}/);
    if (dm) {
      const iso = lvDateToIsoFlexible(normalizeDotDate(dm[0]));
      if (iso) return iso;
    }
  }
  const taM = text.match(/Nākoš[āa]\s+TA\s*[:.]?\s*(\d{2}[./]\d{2}[./]\d{4})/i);
  if (taM?.[1]) {
    const iso = lvDateToIsoFlexible(normalizeDotDate(taM[1]));
    if (iso) return iso;
  }
  return null;
}

function parseTabDefectLine(line: string): CsddInspectionDefectRow | null {
  const tabs = line.split("\t").map((t) => t.trim());
  if (tabs.length >= 3 && /^[\d.]+$/.test(tabs[0]!) && /^[123]$/.test(tabs[1]!)) {
    return finalizeDefectRow({
      code: tabs[0]!,
      rating: tabs[1]!,
      description: tabs.slice(2).join(" "),
    });
  }
  const sp = line.match(/^([\d.]+)\s+(\d)\s+(.*)$/);
  if (sp?.[1] && sp[2]) {
    return finalizeDefectRow({
      code: sp[1].trim(),
      rating: sp[2].trim(),
      description: sp[3] ?? "",
    });
  }
  return null;
}

/**
 * „Detalizētais vērtējums” + tehniskie dati augšā — admin bloks „Iepriekšējās apskates dati”.
 * Jaunākais TA ieraksts (defektu tabula).
 */
export function parseDetailedRatingBlockFromRaw(raw: string): CsddPreviousInspectionBlock {
  const block = emptyCsddPreviousInspectionBlock();
  const detailedSection = extractDetailedRatingSection(raw);
  const headSection = extractTehniskieDatiHead(raw);

  if (headSection.trim()) parseMetadataIntoBlock(headSection, block);
  if (detailedSection.trim()) {
    const defectsOnly = emptyCsddPreviousInspectionBlock();
    parseMetadataIntoBlock(detailedSection, defectsOnly);
    if (defectsOnly.defects.length > 0) block.defects = defectsOnly.defects;
  }

  block.nextInspectionDateText = "";
  const dateFromMileage = block.odometer ? findMileageDateForOdometer(raw, block.odometer) : "";
  const headTa = parseLastTechnicalInspectionHead(raw);
  block.inspectionDateText = dateFromMileage || headTa?.date || "";

  return block;
}

/** Raw sadaļa „Iepriekšējās apskates dati” — iepriekšējā TA (tab/kolonu formāts). */
export function parseIeprieksejasApskatesSection(raw: string): CsddPreviousInspectionBlock {
  const block = emptyCsddPreviousInspectionBlock();
  const section = extractPreviousInspectionSection(raw);
  if (!section.trim()) return block;
  parseMetadataIntoBlock(section, block);
  if (block.odometer && !block.inspectionDateText) {
    block.inspectionDateText = findMileageDateForOdometer(raw, block.odometer);
  }
  return block;
}

/** @deprecated Lietot `parseDetailedRatingBlockFromRaw` vai `parseIeprieksejasApskatesSection`. */
export function parsePreviousInspectionFromRaw(raw: string): CsddPreviousInspectionBlock {
  return parseIeprieksejasApskatesSection(raw);
}

/**
 * Admin bloks „Iepriekšējās apskates dati” — prioritāte sadaļai ar šo virsrakstu PDF/raw.
 * Ja tās nav, „Detalizētais vērtējums” / tehniskie dati augšā.
 */
export function resolvePrevInspectionBlockFromRaw(raw: string): CsddPreviousInspectionBlock {
  const iep = parseIeprieksejasApskatesSection(raw);
  if (previousInspectionBlockHasData(iep)) return iep;
  return parseDetailedRatingBlockFromRaw(raw);
}

/** „Iepriekšējās apskates dati” → rinda tehnisko apskašu vēsturei. */
export function parseIeprieksejasApskatesTaRow(raw: string): CsddTechnicalInspectionRow | null {
  const block = parseIeprieksejasApskatesSection(raw);
  if (!previousInspectionBlockHasData(block)) return null;
  const date =
    block.inspectionDateText.trim() ||
    (block.odometer ? findMileageDateForOdometer(raw, block.odometer) : "");
  return previousInspectionBlockToRow(block, date);
}

/** Dokumenta augšdaļa — „Pēdējā tehniskā apskate / TA datums”. */
export function parseLastTechnicalInspectionHead(raw: string): {
  date: string;
  odometer: string;
  ratingLabel: string;
} | null {
  const text = normalizeCsddRawText(raw);
  const m = text.match(
    /Pēdēj[āa]\s+tehnisk[āa]\s+apskate[\s\S]{0,400}?TA\s+datums\s+(\d{2}[./]\d{2}[./]\d{4})/i,
  );
  if (!m?.[1]) return null;
  const date = normalizeDotDate(m[1]);
  const odometerM = text.match(/Odometra\s+rādījums\s+(\d[\d\s]*)/i);
  const ratingM = text.match(/Novērtējums\s+(\d(?:\s*-\s*[^\n]+)?)/i);
  return {
    date,
    odometer: odometerM?.[1] ? normalizeOdometerDigits(odometerM[1]) : "",
    ratingLabel: ratingM?.[1]?.trim() ?? "",
  };
}

export function previousInspectionBlockToRow(
  block: CsddPreviousInspectionBlock,
  inspectionDate: string,
): CsddTechnicalInspectionRow {
  let maxDefectLevel: 1 | 2 | 3 | null = null;
  for (const d of block.defects ?? []) {
    const lvl = toRatingLevel(Number.parseInt(d.rating, 10));
    if (lvl != null && (maxDefectLevel == null || lvl > maxDefectLevel)) maxDefectLevel = lvl;
  }
  return {
    date: inspectionDate,
    inspectionType: block.inspectionType,
    ratingLabel: block.ratingLabel,
    ratingLevel: block.ratingLevel,
    maxDefectLevel,
    smokeCoefficient: block.smokeCoefficient,
    notes: block.notes,
    defects: block.defects ?? [],
  };
}

/** PDF/NBSP un līdzīgas atstarpes → parasta atstarpe pirms regex. */
export function normalizeCsddRawText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/\uFEFF/g, "")
    .replace(/[ \t]+\n/g, "\n");
}

function normalizeDotDate(date: string): string {
  return date.trim().replace(/\//g, ".");
}

function parseInspectionDateMs(date: string): number {
  const m = date.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return 0;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function parseInspectionYear(date: string): number | null {
  const m = date.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return Number(m[3]);
}

function toRatingLevel(n: number): 1 | 2 | 3 | null {
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

function extractTechnicalInspectionSection(raw: string): string {
  const text = normalizeCsddRawText(raw);
  const re = /Tehnisko\s+apska[šs]u\s+vēsture/gi;
  let best = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const afterHeader = text.slice(m.index + m[0].length, m.index + m[0].length + 500);
    if (!/Apskates\s+datums/i.test(afterHeader)) continue;
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const end = rest.search(TA_HISTORY_SECTION_END_RE);
    const chunk = end >= 0 ? rest.slice(0, end) : rest;
    if (chunk.length > best.length) best = chunk;
  }
  return best;
}

function isDefectContinuationLine(line: string): boolean {
  if (!line.trim()) return false;
  if (PAGE_FOOTER_RE.test(line)) return false;
  if (CSDD_SECTION_START_LINE_RE.test(line)) return false;
  if (/^(Kods|Apskates|Novērtējums|Piezīmes|Dūmainības)\b/i.test(line)) return false;
  if (DEFECT_ROW_RE.test(line) || OLD_DEFECT_ROW_RE.test(line)) return false;
  if (CSDD_TAIL_SECTION_IN_LINE_RE.test(line)) return false;
  return true;
}

function flushCurrentDefect(
  defects: CsddInspectionDefectRow[],
  current: CsddInspectionDefectRow | null,
): CsddInspectionDefectRow | null {
  if (current) defects.push(finalizeDefectRow(current));
  return null;
}

function parseDefectsFromBlock(block: string): CsddInspectionDefectRow[] {
  const defects: CsddInspectionDefectRow[] = [];
  let inDefectTable = false;
  let current: CsddInspectionDefectRow | null = null;

  for (const rawLine of block.split(/\n/)) {
    const line = rawLine.trim();
    if (!line || PAGE_FOOTER_RE.test(line)) continue;

    if (CSDD_SECTION_START_LINE_RE.test(line)) {
      inDefectTable = false;
      current = flushCurrentDefect(defects, current);
      continue;
    }

    if (/^Kods\s+Novērtējums/i.test(line)) {
      inDefectTable = true;
      continue;
    }

    const dm = line.match(DEFECT_ROW_RE) ?? line.match(OLD_DEFECT_ROW_RE);
    if (dm?.[1] && dm[2]) {
      current = flushCurrentDefect(defects, current);
      current = finalizeDefectRow({
        code: dm[1].trim(),
        rating: dm[2].trim(),
        description: dm[3] ?? "",
      });
      inDefectTable = true;
      continue;
    }

    if (inDefectTable && current && isDefectContinuationLine(line)) {
      current.description = current.description
        ? `${current.description} ${line}`.replace(/\s{2,}/g, " ").trim()
        : line;
      current.description = sanitizeDefectDescription(current.description);
      if (CSDD_TAIL_SECTION_IN_LINE_RE.test(current.description)) {
        current = flushCurrentDefect(defects, current);
        inDefectTable = false;
      }
    }
  }
  flushCurrentDefect(defects, current);
  return defects;
}

function parseInspectionBlock(block: string): CsddTechnicalInspectionRow | null {
  const dateM = block.match(/Apskates\s+datums\s+(\d{2}\.\d{2}\.\d{4})/i);
  if (!dateM?.[1]) return null;
  const date = dateM[1];

  const typeM = block.match(/Apskates\s+tips\s+([^\n]+)/i);
  const inspectionType = typeM?.[1]?.trim() ?? "";

  const ratingM = block.match(/Novērtējums\s+(\d(?:\s*-\s*[^\n]+)?)/i);
  const ratingLabel = ratingM?.[1]?.trim() ?? "";
  const ratingLevel = ratingM?.[1] ? toRatingLevel(Number.parseInt(ratingM[1], 10)) : null;

  const smokeM = block.match(/Dūmainības\s+koeficients\s*\([^)]*\)\s*:\s*([^\n]+)/i);
  const smokeCoefficient = smokeM?.[1]?.trim() ?? "";

  const notesM = block.match(/Piezīmes\s+([\s\S]*?)(?=\n\s*Kods\s+Novērtējums|\n\s*[\d.]+\s+\d\s+|$)/i);
  let notes = notesM?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  if (notes.length > 500) notes = notes.slice(0, 500);

  const defects = parseDefectsFromBlock(block);
  let maxDefectLevel: 1 | 2 | 3 | null = null;
  for (const d of defects) {
    const lvl = toRatingLevel(Number.parseInt(d.rating, 10));
    if (lvl != null && (maxDefectLevel == null || lvl > maxDefectLevel)) {
      maxDefectLevel = lvl;
    }
  }

  return {
    date,
    inspectionType,
    ratingLabel,
    ratingLevel,
    maxDefectLevel,
    smokeCoefficient,
    notes,
    defects,
  };
}

function parseTechnicalInspectionHistorySection(raw: string): CsddTechnicalInspectionRow[] {
  const section = extractTechnicalInspectionSection(raw);
  if (!section.trim()) return [];

  const blocks = section.split(/(?=Apskates\s+datums\s)/i).filter((b) => /Apskates\s+datums/i.test(b));
  return blocks.map(parseInspectionBlock).filter((r): r is CsddTechnicalInspectionRow => r != null);
}

/** Tehnisko apskašu vēsture — „Iepriekšējās apskates dati” kā jaunākais + vēstures sadaļa. */
export function parseTechnicalInspectionHistory(raw: string): CsddTechnicalInspectionRow[] {
  const sectionRows = parseTechnicalInspectionHistorySection(raw);
  const ieprieksejasRow = parseIeprieksejasApskatesTaRow(raw);

  const rows = [...sectionRows];
  if (ieprieksejasRow) {
    const date = ieprieksejasRow.date.trim();
    if (date) {
      const dupIdx = rows.findIndex((r) => r.date.trim() === date);
      if (dupIdx >= 0) rows[dupIdx] = ieprieksejasRow;
      else rows.unshift(ieprieksejasRow);
    } else {
      rows.unshift(ieprieksejasRow);
    }
  }

  return rows.sort((a, b) => parseInspectionDateMs(b.date) - parseInspectionDateMs(a.date));
}

export function groupTechnicalInspectionsByYear(
  rows: CsddTechnicalInspectionRow[],
): Map<number, CsddTechnicalInspectionRow[]> {
  const map = new Map<number, CsddTechnicalInspectionRow[]>();
  for (const row of rows) {
    const y = parseInspectionYear(row.date);
    if (y == null) continue;
    const arr = map.get(y) ?? [];
    arr.push(row);
    map.set(y, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => parseInspectionDateMs(b.date) - parseInspectionDateMs(a.date));
  }
  return map;
}

export function technicalInspectionRowHasData(r: CsddTechnicalInspectionRow): boolean {
  return Boolean(r.date.trim());
}

export function parsePreviousRegistrationCountry(raw: string): string {
  const text = normalizeCsddRawText(raw);
  const inline = text.match(
    /Iepriekšēj[āa]s\s+reģistrācijas\s+valsts\s*:?\s*([^\n]+)/i,
  );
  if (inline?.[1]) {
    const v = inline[1].trim();
    if (v && !/^(Transportlīdzekļa|Statuss|Marka|Degviela|VIN|Reģistrācijas\s+numurs)/i.test(v)) {
      return v;
    }
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!/^Iepriekšēj[āa]s\s+reģistrācijas\s+valsts\s*:?\s*$/i.test(line)) continue;
    for (let j = i + 1; j < lines.length && j < i + 4; j++) {
      const v = lines[j]!.trim();
      if (!v || PAGE_FOOTER_RE.test(v)) continue;
      if (/^(Transportlīdzekļa|Statuss|Marka|Degviela|VIN|Reģistrācijas)/i.test(v)) break;
      return v;
    }
  }
  return "";
}

export function parseOwnerRegistrationFromRaw(raw: string): {
  ownerCount: string;
  events: CsddOwnerChangeRow[];
} {
  const text = normalizeCsddRawText(raw);
  let ownerCount = "";
  const countPatterns = [
    /Transportlīdzekļa\s+reģistrācija[\s\S]*?No\s+[\d./]+\s+(\d+)\s+(?:ī|i)pa[sš]niek/i,
    /Transportlīdzekļa\s+reģistrācija[\s\S]{0,400}?(\d+)\s+(?:ī|i)pa[sš]niek/i,
  ];
  for (const re of countPatterns) {
    const countM = text.match(re);
    if (countM?.[1]) {
      ownerCount = countM[1].trim();
      break;
    }
  }

  const events: CsddOwnerChangeRow[] = [];
  const sectionM = text.match(
    /Transportlīdzekļa\s+reģistrācija([\s\S]*?)(?=Transportlīdzekļa\s+ekspluatācijas|Civiltiesiskā\s+apdrošināšana|Nobraukuma\s+vēsture|$)/i,
  );
  if (sectionM?.[1]) {
    for (const line of sectionM[1].split(/\n/)) {
      const t = line.trim();
      if (!t || PAGE_FOOTER_RE.test(t)) continue;
      if (/^No\s+[\d./]+/i.test(t)) continue;
      const ev = t.match(/^(\d{2}[./]\d{2}[./]\d{4})\s*[-–—]\s*(.+)$/);
      if (ev?.[1] && ev[2]) {
        events.push({ date: normalizeDotDate(ev[1]), label: ev[2].trim() });
      }
    }
  }

  return { ownerCount, events };
}

export function ownerChangeRowHasData(r: CsddOwnerChangeRow): boolean {
  return Boolean(r.date.trim() || r.label.trim());
}

/** Efektīvais līmenis — sliktākais no kopējā novērtējuma un defektu tabulas. */
export function effectiveInspectionSeverity(row: CsddTechnicalInspectionRow): 1 | 2 | 3 | null {
  const defectLevels = (row.defects ?? [])
    .map((d) => toRatingLevel(Number.parseInt(d.rating, 10)))
    .filter((x): x is 1 | 2 | 3 => x != null);
  const levels = [row.ratingLevel, row.maxDefectLevel, ...defectLevels].filter(
    (x): x is 1 | 2 | 3 => x != null,
  );
  if (levels.length === 0) return null;
  return Math.max(...levels) as 1 | 2 | 3;
}
