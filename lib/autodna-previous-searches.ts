/**
 * AutoDNA «Iepriekšējie meklējumi» (Nils 25.11): kas un kad šo VIN jau pārbaudījis.
 * AutoDNA PDF sadaļa: «Datums un laiks | Pakalpojuma veids | IP | Atrašanās vieta» + maza OpenStreetMap karte.
 * IP vienmēr maskēts kā AutoDNA (pēdējie divi okteti «XXX»). Karti ņem tikai no paša PDF (ārējus karšu servisus nelieto).
 *
 * Tīrs modulis (bez pdfjs / sharp) - der serverim, admin UI un klienta PDF.
 */

export type AutodnaPreviousSearch = {
  /** «20.01.2025 10:01:17» */
  dateTime: string;
  /** «Atskaite autoDNA» */
  service: string;
  /** Vienmēr maskēts: «80.89.XXX.XXX» */
  ip: string;
  /** «Riga, Latvia» */
  location: string;
  /** Kartes sīktēls no AutoDNA PDF (data:image/jpeg;base64,…), ja bija. */
  map?: string;
};

export const AUTODNA_PREVIOUS_SEARCHES_MAX = 30;
/** Kartes sīktēls ir ~117×38 px; griests aizsargā melnrakstu JSON. */
export const AUTODNA_SEARCH_MAP_MAX_CHARS = 60_000;

const DATE_TIME_RE = /\b(\d{2}\.\d{2}\.\d{4})(?:[ ,T]+(\d{1,2}:\d{2}(?::\d{2})?))?/;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Virsraksts LV / EN / PL. */
export function isAutodnaPreviousSearchesHeading(text: string): boolean {
  const n = norm(text);
  return n === "ieprieksejie meklejumi" || n === "previous searches" || n === "poprzednie wyszukiwania";
}

type Label = "dateTime" | "service" | "ip" | "location";
const LABELS: { key: Label; re: RegExp }[] = [
  { key: "dateTime", re: /^(datums un laiks|date and time|data i godzina)\b/ },
  { key: "service", re: /^(pakalpojuma veids|service type|type of service|rodzaj uslugi)\b/ },
  { key: "ip", re: /^ip\b/ },
  { key: "location", re: /^(atrasanas vieta|location|lokalizacja)\b/ },
];

/** Nākamās sadaļas virsraksti (beidz sadaļu). */
const SECTION_END_RE =
  /^(aprikojums|equipment|wyposazenie|transportlidzekla arhiva fotografijas|arhiva fotografijas|archival photos|vehicle archive photos|noteikumi un nosacijumi|terms and conditions|lapa \d+|auto vestures atskaite)/;

function labelOf(line: string): { key: Label; rest: string } | null {
  const n = norm(line);
  for (const l of LABELS) {
    const m = l.re.exec(n);
    if (!m) continue;
    const words = m[0].split(" ").length;
    const rest = line.trim().split(/\s+/).slice(words).join(" ");
    return { key: l.key, rest };
  }
  return null;
}

/** «163.116.12.34» -> «163.116.XXX.XXX»; jau maskēts paliek; IPv6 -> pirmās 2 grupas + «XXXX». */
export function maskAutodnaIp(raw: string): string {
  const t = raw.trim();
  const v4 = /^(\d{1,3})\.(\d{1,3})\.([0-9xX*]{1,3})\.([0-9xX*]{1,3})$/.exec(t);
  if (v4) return `${v4[1]}.${v4[2]}.XXX.XXX`;
  if (t.includes(":")) {
    const parts = t.split(":").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}:XXXX:XXXX` : "XXXX";
  }
  return t ? t.replace(/\d+/g, "XXX") : "";
}

function cleanRow(r: Partial<AutodnaPreviousSearch>): AutodnaPreviousSearch | null {
  const dateTime = (r.dateTime ?? "").trim().slice(0, 40);
  if (!DATE_TIME_RE.test(dateTime)) return null;
  const map = typeof r.map === "string" && r.map.startsWith("data:image/") && r.map.length <= AUTODNA_SEARCH_MAP_MAX_CHARS ? r.map : "";
  return {
    dateTime,
    service: (r.service ?? "").trim().slice(0, 80),
    ip: maskAutodnaIp(r.ip ?? "").slice(0, 60),
    location: (r.location ?? "").trim().slice(0, 120),
    ...(map ? { map } : {}),
  };
}

/** Melnraksta JSON -> derīgas rindas (IP vienmēr maskēts). */
export function normalizeAutodnaPreviousSearches(raw: unknown): AutodnaPreviousSearch[] {
  if (!Array.isArray(raw)) return [];
  const out: AutodnaPreviousSearch[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const row = cleanRow({
      dateTime: typeof o.dateTime === "string" ? o.dateTime : "",
      service: typeof o.service === "string" ? o.service : "",
      ip: typeof o.ip === "string" ? o.ip : "",
      location: typeof o.location === "string" ? o.location : "",
      map: typeof o.map === "string" ? o.map : "",
    });
    if (row) out.push(row);
    if (out.length >= AUTODNA_PREVIOUS_SEARCHES_MAX) break;
  }
  return out;
}

/**
 * No AutoDNA PDF teksta (pdf-parse / pdfjs rindas): sadaļa «Iepriekšējie meklējumi» līdz nākamajai sadaļai.
 * Navigācijas ierakstu («Iepriekšējie meklējumi / Ierakstu skaits: 1») izlaiž. Etiķete var būt tajā pašā rindā
 * ar vērtību vai iepriekšējā rindā.
 */
export function parseAutodnaPreviousSearchesFromText(text: string): AutodnaPreviousSearch[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: AutodnaPreviousSearch[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isAutodnaPreviousSearchesHeading(lines[i]!)) continue;
    if (/^(ierakstu skaits|number of records|liczba)/.test(norm(lines[i + 1] ?? ""))) continue; // navigācija
    let cur: Partial<AutodnaPreviousSearch> = {};
    let pending: Label | null = null;
    const flush = () => {
      const row = cleanRow(cur);
      if (row) out.push(row);
      cur = {};
    };
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]!;
      const n = norm(line);
      if (SECTION_END_RE.test(n) || isAutodnaPreviousSearchesHeading(line)) break;
      const lab = labelOf(line);
      if (lab) {
        if (lab.key === "dateTime" && cur.dateTime) flush();
        pending = lab.key;
        if (lab.rest) {
          cur[lab.key] = lab.rest;
          pending = null;
        }
        continue;
      }
      if (pending) {
        cur[pending] = line;
        pending = null;
        continue;
      }
      // Rinda bez etiķetes: jauns datums -> jauns ieraksts (tabulas atkārtojumi bez virsrakstiem).
      if (DATE_TIME_RE.test(line) && /^\d{2}\.\d{2}\.\d{4}/.test(line)) {
        if (cur.dateTime) flush();
        cur.dateTime = line;
      }
    }
    flush();
    break;
  }
  return dedupeAutodnaPreviousSearches(out);
}

export type PositionedText = { page: number; x: number; y: number; str: string; size: number };
export type PositionedImage = { page: number; x: number; y: number; w: number; h: number; id: string };

/**
 * Pēc pozīcijām (pdfjs): kolonnas pēc etiķešu x, ieraksts = datuma rinda; karte = attēls sadaļā pa labi no
 * «Atrašanās vieta» kolonnas, tuvākais ieraksta rindai. Atgriež rindas + kartes attēla id katrai rindai.
 */
export function parseAutodnaPreviousSearchesFromItems(
  texts: readonly PositionedText[],
  images: readonly PositionedImage[],
): { rows: AutodnaPreviousSearch[]; mapIds: (string | null)[] } {
  const sorted = [...texts].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const start = sorted.findIndex((t, i) => {
    if (!isAutodnaPreviousSearchesHeading(t.str)) return false;
    const next = sorted[i + 1];
    return !(next && /^(ierakstu skaits|number of records|liczba)/.test(norm(next.str)));
  });
  if (start < 0) return { rows: [], mapIds: [] };
  const head = sorted[start]!;
  const section: PositionedText[] = [];
  for (const t of sorted.slice(start + 1)) {
    if (t.page > head.page + 1) break;
    const n = norm(t.str);
    if (t.size >= head.size * 0.85 && t.page === head.page && t.y > head.y + 5) break; // nākamās sadaļas virsraksts
    if (SECTION_END_RE.test(n) && !/^(lapa \d+|auto vestures atskaite)/.test(n)) break;
    if (/^(lapa\b|\d+$|auto vestures atskaite|parbaudiet zinojuma)/.test(n)) continue;
    section.push(t);
  }
  const cols: { key: Label; x: number }[] = [];
  for (const t of section) {
    const lab = labelOf(t.str);
    if (lab && !cols.some((c) => c.key === lab.key)) cols.push({ key: lab.key, x: t.x });
  }
  if (!cols.some((c) => c.key === "dateTime")) return { rows: [], mapIds: [] };
  cols.sort((a, b) => a.x - b.x);
  const colOf = (x: number): Label => {
    let best = cols[0]!;
    for (const c of cols) if (x >= c.x - 4) best = c;
    return best.key;
  };
  const dateCol = cols.find((c) => c.key === "dateTime")!;
  const rowAnchors = section
    .filter((t) => !labelOf(t.str) && colOf(t.x) === "dateTime" && Math.abs(t.x - dateCol.x) < 40 && DATE_TIME_RE.test(t.str))
    .map((t) => ({ page: t.page, y: t.y }));
  const rows: AutodnaPreviousSearch[] = [];
  const mapIds: (string | null)[] = [];
  const locCol = cols.find((c) => c.key === "location");
  const usedImages = new Set<string>();
  rowAnchors.forEach((a, idx) => {
    const nextA = rowAnchors[idx + 1];
    const inRow = section.filter(
      (t) => !labelOf(t.str) && t.page === a.page && t.y >= a.y - 3 && (!nextA || nextA.page !== a.page || t.y < nextA.y - 3),
    );
    const cur: Partial<AutodnaPreviousSearch> = {};
    for (const t of inRow) {
      const k = colOf(t.x);
      cur[k] = cur[k] ? `${cur[k]} ${t.str.trim()}` : t.str.trim();
    }
    const row = cleanRow(cur);
    if (!row) return;
    rows.push(row);
    const candidates = images
      .filter(
        (im) =>
          im.page === a.page &&
          !usedImages.has(`${im.page}:${im.id}:${im.y}`) &&
          im.x > (locCol?.x ?? 0) + 40 &&
          im.w >= 40 &&
          im.w >= im.h * 1.6 &&
          Math.abs(im.y - a.y) < 40,
      )
      .sort((p, q) => Math.abs(p.y - a.y) - Math.abs(q.y - a.y));
    const img = candidates[0];
    if (img) usedImages.add(`${img.page}:${img.id}:${img.y}`);
    mapIds.push(img ? img.id : null);
  });
  return { rows, mapIds };
}

export function dedupeAutodnaPreviousSearches(rows: readonly AutodnaPreviousSearch[]): AutodnaPreviousSearch[] {
  const seen = new Set<string>();
  const out: AutodnaPreviousSearch[] = [];
  for (const r of rows) {
    const k = `${r.dateTime}|${r.service}|${r.ip}|${r.location}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out.slice(0, AUTODNA_PREVIOUS_SEARCHES_MAX);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Klienta PDF kartīte AutoDNA sadaļā (premium minimal: plānas līnijas, bez ēnām). */
export function buildAutodnaPreviousSearchesPdfHtml(rows: readonly AutodnaPreviousSearch[]): string {
  const clean = normalizeAutodnaPreviousSearches(rows);
  if (!clean.length) return "";
  const cell = (k: string, v: string) =>
    `<div class="pdf-dna-search__cell"><span class="pdf-dna-search__k">${esc(k)}</span><span class="pdf-dna-search__v">${esc(v || "-")}</span></div>`;
  const body = clean
    .map(
      (r) =>
        `<div class="pdf-dna-search__row">${cell("Datums un laiks", r.dateTime)}${cell("Pakalpojuma veids", r.service)}${cell("IP", r.ip)}${cell("Atrašanās vieta", r.location)}${
          r.map ? `<img class="pdf-dna-search__map" src="${esc(r.map)}" alt=""/>` : `<span class="pdf-dna-search__map pdf-dna-search__map--none" aria-hidden="true"></span>`
        }</div>`,
    )
    .join("");
  return `<div class="pdf-dna-search" role="table"><p class="pdf-subhead">Iepriekšējie meklējumi</p><div class="pdf-dna-search__list">${body}</div></div>`;
}

export const AUTODNA_PREVIOUS_SEARCHES_PDF_CSS = `
      .pdf-dna-search{margin:12px 0 0;break-inside:avoid;page-break-inside:avoid;}
      .pdf-dna-search__list{border-top:1px solid var(--pdf-line,#e5e7eb);}
      .pdf-dna-search__row{display:grid;grid-template-columns:1.15fr 1.1fr 0.95fr 1fr 96px;gap:10px;align-items:center;padding:9px 2px;border-bottom:1px solid var(--pdf-line,#e5e7eb);}
      .pdf-dna-search__cell{display:flex;flex-direction:column;gap:2px;min-width:0;}
      .pdf-dna-search__k{font-size:8.5px;line-height:1.3;color:#86868b;letter-spacing:0.02em;}
      .pdf-dna-search__v{font-size:var(--pdf-fs-base,10.5px);line-height:1.35;color:#1d1d1f;font-weight:500;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;}
      .pdf-dna-search__map{display:block;width:96px;height:32px;object-fit:cover;border-radius:6px;border:1px solid var(--pdf-line,#e5e7eb);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .pdf-dna-search__map--none{border:0;}
`;
