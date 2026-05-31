/**
 * CSDD paplašinātie lauki no raw: tehnisko apskašu vēsture, īpašnieku maiņas, iepriekšējā valsts.
 */

export type CsddTechnicalInspectionRow = {
  date: string;
  inspectionType: string;
  ratingLabel: string;
  /** Kopējais novērtējums (1–3). */
  ratingLevel: 1 | 2 | 3 | null;
  /** Augstākais defekta novērtējums tabulā (1–3). */
  maxDefectLevel: 1 | 2 | 3 | null;
};

export type CsddOwnerChangeRow = {
  date: string;
  label: string;
};

const PAGE_FOOTER_RE = /^\s*\d+\s*\/\s*\d+\s*$/;
const DEFECT_ROW_RE = /^([\d.]+)\s+(\d)\s+/;
const OLD_DEFECT_ROW_RE = /^(\d{3})\s+(\d)\s+/;

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
    const end = rest.search(
      /Informācija\s+sagatavota\s+elektroniski|Powered\s+by\s+TCPDF/i,
    );
    const chunk = end >= 0 ? rest.slice(0, end) : rest;
    if (chunk.length > best.length) best = chunk;
  }
  return best;
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

  let maxDefectLevel: 1 | 2 | 3 | null = null;
  let inDefectTable = false;
  for (const rawLine of block.split(/\n/)) {
    const line = rawLine.trim();
    if (!line || PAGE_FOOTER_RE.test(line)) continue;
    if (/^Kods\s+Novērtējums/i.test(line)) {
      inDefectTable = true;
      continue;
    }
    if (inDefectTable || DEFECT_ROW_RE.test(line) || OLD_DEFECT_ROW_RE.test(line)) {
      const dm = line.match(DEFECT_ROW_RE) ?? line.match(OLD_DEFECT_ROW_RE);
      if (dm?.[2]) {
        inDefectTable = true;
        const lvl = toRatingLevel(Number.parseInt(dm[2], 10));
        if (lvl != null && (maxDefectLevel == null || lvl > maxDefectLevel)) {
          maxDefectLevel = lvl;
        }
      }
    }
  }

  return {
    date,
    inspectionType,
    ratingLabel,
    ratingLevel,
    maxDefectLevel,
  };
}

/** Tehnisko apskašu vēsture — jaunākā augšā. */
export function parseTechnicalInspectionHistory(raw: string): CsddTechnicalInspectionRow[] {
  const section = extractTechnicalInspectionSection(raw);
  if (!section.trim()) return [];

  const blocks = section.split(/(?=Apskates\s+datums\s)/i).filter((b) => /Apskates\s+datums/i.test(b));
  const rows = blocks.map(parseInspectionBlock).filter((r): r is CsddTechnicalInspectionRow => r != null);
  return rows.sort((a, b) => parseInspectionDateMs(b.date) - parseInspectionDateMs(a.date));
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

/** Efektīvais grafika līmenis — sliktākais no kopējā novērtējuma un defektu tabulas. */
export function effectiveInspectionSeverity(row: CsddTechnicalInspectionRow): 1 | 2 | 3 | null {
  const levels = [row.ratingLevel, row.maxDefectLevel].filter((x): x is 1 | 2 | 3 => x != null);
  if (levels.length === 0) return null;
  return Math.max(...levels) as 1 | 2 | 3;
}
