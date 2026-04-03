/**
 * Priekšskata / PDF strukturēšana: tabulas, apakšvirsraksti (CSDD sadaļas), Tirgus secība, VIN/km.
 */

export type PreviewSegment =
  | { type: "subheading"; title: string }
  | { type: "kv"; rows: [string, string][] }
  | { type: "grid"; rows: string[][] }
  | { type: "lines"; lines: string[] };

const FLUFF_LINE_PATTERNS: RegExp[] = [
  /^\s*autorizējies\b/i,
  /paziņojumus\s+līdzīgiem/i,
  /vecākas\s+sludinājuma\s+cenas/i,
  /vairāk\s+bildes/i,
  /paplašinātu\s+vēsturi/i,
  /līdzīgiem\s+sludinājumiem/i,
  /sa[ņn]emt\s+pazi[ņn]ojumus/i,
  /dal[īi]ties\s+ar\s+saiti/i,
  /atv[ēe]rt\s+sludinājumu\s+iek[šs]\s+ss/i,
];

/** Liekie ss.com / portālu teikumi — rindiņas, kas pilnībā atbilst šiem šabloniem, tiek izņemtas. */
export function stripListingFluff(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !FLUFF_LINE_PATTERNS.some((re) => re.test(l)))
    .join("\n");
}

/** Tirgus blokam: kopsavilkums → cena/nobraukums → vēsture → pārējais (pēc ss.com ekrānuzņēmuma loģikas). */
export function reorderTirgusForPreview(raw: string): string {
  const stripped = stripListingFluff(raw);
  const lines = stripped.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const meta: string[] = [];
  const priceBlock: string[] = [];
  const history: string[] = [];
  const rest: string[] = [];

  for (const line of lines) {
    if (/ss\.(com|lv)\b|sslv|sludinājum/i.test(line) && !/autorizējies/i.test(line)) {
      meta.push(line);
    } else if (
      /\b(auto\s+)?pārdošanā\b|\blatvija\b/i.test(line) ||
      (/EUR|€/i.test(line) && /(cena|nobrauk|km|izveidots|man[īi]ts|dienas)/i.test(line))
    ) {
      priceBlock.push(line);
    } else if (/\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(line) && (/EUR|km/i.test(line) || /\d{1,3}(?:\s?\d{3})+\s*km/i.test(line))) {
      history.push(line);
    } else if (/cenu\s+izmaiņas|^cena$/i.test(line)) {
      priceBlock.push(line);
    } else {
      rest.push(line);
    }
  }

  const ordered = [...meta, ...priceBlock, ...history, ...rest];
  return ordered.join("\n");
}

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

export function extractVinsFromText(text: string): string[] {
  const found: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VIN_RE.source, VIN_RE.flags);
  while ((m = re.exec(text)) !== null) {
    found.push(m[1].toUpperCase());
  }
  return [...new Set(found)];
}

function parseLineToKv(line: string): [string, string] | null {
  const parts = line.split("\t").map((p) => p.trim());
  if (parts.length >= 2) {
    const first = parts[0];
    if (first.endsWith(":")) {
      const key = first.slice(0, -1).trim();
      const value = parts.slice(1).join(" ").trim();
      if (key.length >= 2 && key.length <= 90) return [key, value];
    }
    const colonIdx = first.indexOf(":");
    if (colonIdx > 0) {
      const key = first.slice(0, colonIdx).trim();
      const restFirst = first.slice(colonIdx + 1).trim();
      const value = [restFirst, ...parts.slice(1)].filter(Boolean).join(" ").trim();
      if (key.length >= 2 && key.length <= 90) return [key, value];
    }
  }
  const m = line.match(/^(.{2,90}?):\s*(.+)$/);
  if (m) return [m[1].trim(), m[2].trim()];
  return null;
}

/** Rinda „Nosaukums<TAB>Vērtība” bez kolonas (CSDD eksports). */
function isLikelyEurTariffFirstCell(first: string): boolean {
  return /^\d+[,.]?\d*\s*EUR$/i.test(first.trim()) || (/EUR/i.test(first) && /^\d/.test(first));
}

function parseTabPairKv(line: string): [string, string] | null {
  const parts = line.split("\t").map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (isLikelyEurTariffFirstCell(parts[0])) return null;
  let k = parts[0];
  const v = parts[1];
  if (k.endsWith(":")) k = k.slice(0, -1).trim();
  if (k.length < 2) return null;
  return [k, v];
}

function isGridRow(line: string, minCols: number): string[] | null {
  const cells = line.split("\t").map((c) => c.trim());
  if (cells.length < minCols) return null;
  if (cells.some((c) => !c.length)) return null;
  return cells;
}

/** CSDD / citu bloku sadaļas (Ceļa nodoklis, iepriekšējā apskate u.c.) */
function matchSubheading(line: string): string | null {
  const t = line.trim();
  if (t.length > 160 || /\t/.test(t)) return null;
  if (
    /^(Tehniskie dati|Nobraukuma vēsture(?: LV)?|Ceļa nodoklis|Iepriekšējās apskates dati)\b/i.test(t)
  ) {
    return t.replace(/\s*:\s*$/, "").trim();
  }
  return null;
}

export type SegmentOptions = {
  /** Tirgus laukam — vispirms sakārtot rindiņas loģiskā secībā */
  variant?: "default" | "tirgus";
};

/**
 * Sadala bloka tekstu: apakšvirsraksti, tabulas (atslēga–vērtība), režģi, pārējās rindiņas.
 */
export function segmentTextForPreview(raw: string, opts?: SegmentOptions): PreviewSegment[] {
  const prepared =
    opts?.variant === "tirgus" ? reorderTirgusForPreview(raw) : stripListingFluff(raw);
  if (!prepared.trim()) return [];

  const lines = prepared.split(/\r?\n/).map((l) => l.trim());
  const segments: PreviewSegment[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }

    const sub = matchSubheading(line);
    if (sub) {
      segments.push({ type: "subheading", title: sub });
      i++;
      continue;
    }

    const g3 = isGridRow(line, 3);
    if (g3) {
      const rows: string[][] = [];
      while (i < lines.length) {
        const L = lines[i];
        if (!L) break;
        const r = isGridRow(L, 3);
        if (!r) break;
        rows.push(r);
        i++;
      }
      segments.push({ type: "grid", rows });
      continue;
    }

    const tp0 = parseTabPairKv(line);
    if (tp0) {
      const rows: [string, string][] = [];
      while (i < lines.length) {
        const L = lines[i];
        if (!L) break;
        const tp = parseTabPairKv(L);
        if (!tp) break;
        rows.push(tp);
        i++;
      }
      if (rows.length > 0) {
        segments.push({ type: "kv", rows });
        continue;
      }
    }

    const g2 = isGridRow(line, 2);
    if (g2 && !parseLineToKv(line) && !parseTabPairKv(line)) {
      const rows: string[][] = [];
      let j = i;
      while (j < lines.length) {
        const L = lines[j];
        if (!L) break;
        const r2 = isGridRow(L, 2);
        if (!r2 || parseLineToKv(L) || parseTabPairKv(L)) break;
        rows.push(r2);
        j++;
      }
      if (rows.length >= 2) {
        i = j;
        segments.push({ type: "grid", rows });
        continue;
      }
    }

    const kv0 = parseLineToKv(line);
    if (kv0) {
      const rows: [string, string][] = [];
      while (i < lines.length) {
        const L = lines[i];
        if (!L) break;
        const kv = parseLineToKv(L);
        if (!kv) break;
        rows.push(kv);
        i++;
      }
      segments.push({ type: "kv", rows });
      continue;
    }

    const chunk: string[] = [line];
    i++;
    while (i < lines.length) {
      const L = lines[i];
      if (!L) break;
      if (matchSubheading(L)) break;
      if (isGridRow(L, 3) || parseLineToKv(L) || parseTabPairKv(L)) break;
      chunk.push(L);
      i++;
    }
    segments.push({ type: "lines", lines: chunk });
  }

  return segments;
}

export function extractKmCandidates(text: string): number[] {
  const out: number[] = [];
  const kmRe = /(\d{1,3}(?:\s?\d{3})+)\s*km/gi;
  let m: RegExpExecArray | null;
  while ((m = kmRe.exec(text)) !== null) {
    const n = parseInt(m[1].replace(/\s/g, ""), 10);
    if (n >= 1_000 && n <= 2_000_000) out.push(n);
  }
  const odRe = /odometra\s+r[aā]d[īi]jums[:\s\t]+(\d{5,7})\b/gi;
  while ((m = odRe.exec(text)) !== null) {
    out.push(parseInt(m[1], 10));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export type VinKmAnalysis = {
  vins: { label: string; values: string[] }[];
  vinIssues: string[];
  kmByBlock: { label: string; kms: number[] }[];
  kmIssues: string[];
};

const KM_DIFF_WARN = 4000;

export function analyzeVinAndKm(args: {
  orderVin: string | null;
  blocks: { label: string; text: string }[];
  fileNames: string[];
}): VinKmAnalysis {
  const orderNorm = args.orderVin?.trim().toUpperCase() ?? null;

  const vins: { label: string; values: string[] }[] = [];
  if (orderNorm && /^[A-HJ-NPR-Z0-9]{17}$/.test(orderNorm)) {
    vins.push({ label: "Pasūtījums (VIN)", values: [orderNorm] });
  }

  for (const b of args.blocks) {
    const found = extractVinsFromText(b.text);
    if (found.length) vins.push({ label: b.label, values: [...new Set(found)] });
  }

  for (const fn of args.fileNames) {
    const found = extractVinsFromText(fn);
    if (found.length) vins.push({ label: `Fails „${fn}”`, values: [...new Set(found)] });
  }

  const allVins = new Set<string>();
  vins.forEach((v) => v.values.forEach((x) => allVins.add(x)));
  const vinIssues: string[] = [];
  if (allVins.size > 1) {
    vinIssues.push(`Vairāki atšķirīgi VIN avotos: ${[...allVins].join(", ")}.`);
  }
  if (orderNorm && /^[A-HJ-NPR-Z0-9]{17}$/.test(orderNorm) && allVins.size > 0) {
    const others = [...allVins].filter((v) => v !== orderNorm);
    if (others.length) {
      vinIssues.push(`Pasūtījuma VIN (${orderNorm}) nesakrīt ar: ${others.join(", ")}.`);
    }
  }

  const kmByBlock: { label: string; kms: number[] }[] = [];
  for (const b of args.blocks) {
    const kms = extractKmCandidates(b.text);
    if (kms.length) kmByBlock.push({ label: b.label, kms });
  }

  const kmIssues: string[] = [];
  const allKm = kmByBlock.flatMap((k) => k.kms);
  if (allKm.length >= 2) {
    const lo = Math.min(...allKm);
    const hi = Math.max(...allKm);
    if (hi - lo >= KM_DIFF_WARN) {
      kmIssues.push(
        `Liela nobraukuma starpība starp avotiem (≈ ${lo.toLocaleString("lv-LV")}–${hi.toLocaleString("lv-LV")} km) — pārbaudi CSDD vs sludinājumu.`,
      );
    }
  }

  return { vins, vinIssues, kmByBlock, kmIssues };
}

export function segmentsToPrintHtml(segments: PreviewSegment[]): string {
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.type === "subheading") {
      parts.push(`<h4 class="sub2">${escapeHtml(seg.title)}</h4>`);
    } else if (seg.type === "kv") {
      parts.push('<table class="fmt">');
      for (const [k, v] of seg.rows) {
        parts.push(
          `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`,
        );
      }
      parts.push("</table>");
    } else if (seg.type === "grid") {
      parts.push('<table class="fmt grid">');
      for (const row of seg.rows) {
        parts.push("<tr>");
        for (const cell of row) {
          parts.push(`<td>${escapeHtml(cell)}</td>`);
        }
        parts.push("</tr>");
      }
      parts.push("</table>");
    } else {
      parts.push(`<pre class="block">${escapeHtml(seg.lines.join("\n"))}</pre>`);
    }
  }
  return parts.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function workspaceBlockToHtml(text: string, variant: SegmentOptions["variant"] = "default"): string {
  const prepared = variant === "tirgus" ? reorderTirgusForPreview(text) : stripListingFluff(text);
  if (!prepared.trim()) return '<p class="na">Informācija nav pieejama.</p>';
  const segs = segmentTextForPreview(text, { variant });
  if (segs.length === 0) return `<pre class="block">${escapeHtml(prepared)}</pre>`;
  return segmentsToPrintHtml(segs);
}
