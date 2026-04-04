/**
 * Atlīdzību / tāmes rindas no brīvā teksta (OCTA lauks, citi, PDF izraksts).
 * PDF teksts bieži ir „blīvs” — meklējam datumu un EUR apjomu arī logu fragmentos starp rindām.
 */

export type ClaimTableRow = {
  date: string;
  desc: string;
  descShort: string;
  amount: string;
  iso: string;
  emphasize: boolean;
  /** Piem. „PDF: …” vai „OCTA / piezīmju lauks”. */
  sourceNote?: string;
};

const CLAIM_CTX =
  /claim|damage|collision|accident|repair|payout|compensation|paid|insurance|total\s*loss|liabilit|indemn|settlement|cost\s+of|body|injur|property\s*damage|ātrie|atlīdz|ierakst|negad|boj[āa]j|av[āa]rij|remont|apr[īi]koj|apr[ēe]k/i;

function amountToIntRough(raw: string): number {
  const s = raw.replace(/\s/g, "").replace(/\u00a0/g, "");
  const noCents = s.replace(/[.,]\d{2}$/, "");
  const digits = noCents.replace(/[^\d]/g, "");
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? 0 : n;
}

function normalizeDateKey(display: string): string {
  const iso = display.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = display.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return display;
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  const d = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return d;
}

function sortKey(r: ClaimTableRow): number {
  const t = Date.parse(normalizeDateKey(r.date));
  return Number.isNaN(t) ? 0 : t;
}

function rowDedupeKey(r: ClaimTableRow): string {
  const amt = r.amount.replace(/\s/g, "");
  const src = (r.sourceNote || "").slice(0, 40);
  return `${src}|${normalizeDateKey(r.date)}|${amt}|${r.descShort.slice(0, 48).toLowerCase()}`;
}

/** Rindas, kur katrā rindā ir datums un EUR (OCTA / manuālas piezīmes). */
export function parseClaimRowsFromLineBasedText(blob: string, sourceNote?: string): ClaimTableRow[] {
  const rows: ClaimTableRow[] = [];
  for (const raw of blob.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 8) continue;
    const dm = line.match(/\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2}/);
    if (!dm) continue;
    const eurM = line.match(
      /([\d\s\u00A0]{1,14}(?:[.,]\d{2})?)\s*(EUR|€)\b|\b(EUR|€)\s*([\d\s\u00A0]{1,14}(?:[.,]\d{2})?)/i,
    );
    if (!eurM) continue;
    const amtRaw = (eurM[1] || eurM[4] || "").trim();
    if (!amtRaw) continue;
    const amountNum = amountToIntRough(amtRaw);
    const emphasize =
      /piln[īi]g[aā]\s*boj[āa]j|total\s*loss|piln[īi]b[āa]\s*zud|smags\s+virsb[ūu]ves/i.test(line) ||
      (amountNum >= 5000 && amountNum > 0);
    const isoM = line.match(/\b([A-Z]{2})\b\s*$/);
    const iso = isoM?.[1] && isoM[1].length === 2 ? isoM[1] : "LV";
    let descShort = line
      .replace(dm[0], "")
      .replace(eurM[0], "")
      .replace(/\b[A-Z]{2}\b\s*$/, "")
      .replace(/^[\s,;·\-–—]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (descShort.length < 3) descShort = line;
    rows.push({
      date: dm[0],
      desc: line,
      descShort,
      amount: `${amtRaw.replace(/\s+/g, " ")} EUR`,
      iso,
      emphasize,
      sourceNote,
    });
  }
  return rows;
}

/**
 * Blīvs teksts (tipiski viena PDF lapa kā gara rinda): datums … summa EUR vai summa EUR … datums.
 */
export function parseClaimRowsFromDenseText(text: string, sourceNote: string): ClaimTableRow[] {
  const rows: ClaimTableRow[] = [];
  const t = text.replace(/\u00a0/g, " ").slice(0, 500_000);
  const seen = new Set<string>();

  const reDateAmount =
    /(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})[\s\S]{0,260}?((?:\d{1,3}(?:[ \t]\d{3})+|\d{4,7})(?:[.,]\d{2})?)\s*(EUR|€)/gi;
  let m: RegExpExecArray | null;
  while ((m = reDateAmount.exec(t)) !== null) {
    const dateStr = m[1];
    const amtRaw = m[2].trim();
    const winStart = Math.max(0, m.index - 120);
    const winEnd = Math.min(t.length, m.index + m[0].length + 120);
    const window = t.slice(winStart, winEnd);
    const amountNum = amountToIntRough(amtRaw);
    if (amountNum > 0 && amountNum < 40) continue;
    if (amountNum >= 40 && !CLAIM_CTX.test(window) && amountNum < 250) continue;
    const emphasize =
      /total\s*loss|piln[īi]g|write[\s-]*off|severe|heavy\s+damage|smags/i.test(window) ||
      amountNum >= 5000;
    const isoM = window.match(/\b(DE|FR|PL|LT|EE|LV|GB|UK|IT|ES|NL|BE|AT|CH|SE|NO|DK|FI|CZ|SK|HU|RO)\b/i);
    const iso = isoM?.[1] ? isoM[1].toUpperCase().replace("UK", "GB") : "LV";
    let descShort = window
      .replace(/\s+/g, " ")
      .replace(/.*?(?:EUR|€)\s*[\d\s.,]+/i, "")
      .trim()
      .slice(0, 140);
    if (descShort.length < 8) descShort = `Ieraksts no pārskata (${dateStr})`;
    const desc = `[${sourceNote}] ${window.replace(/\s+/g, " ").slice(0, 220)}`;
    const row: ClaimTableRow = {
      date: dateStr,
      desc,
      descShort,
      amount: `${amtRaw.replace(/\s+/g, " ")} EUR`,
      iso,
      emphasize,
      sourceNote,
    };
    const k = rowDedupeKey(row);
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push(row);
  }

  const reAmountDate =
    /((?:\d{1,3}(?:[ \t]\d{3})+|\d{4,7})(?:[.,]\d{2})?)\s*(EUR|€)[\s\S]{0,260}?(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/gi;
  while ((m = reAmountDate.exec(t)) !== null) {
    const amtRaw = m[1].trim();
    const dateStr = m[3];
    const winStart = Math.max(0, m.index - 120);
    const winEnd = Math.min(t.length, m.index + m[0].length + 120);
    const window = t.slice(winStart, winEnd);
    const amountNum = amountToIntRough(amtRaw);
    if (amountNum > 0 && amountNum < 40) continue;
    if (amountNum >= 40 && !CLAIM_CTX.test(window) && amountNum < 250) continue;
    const emphasize =
      /total\s*loss|piln[īi]g|write[\s-]*off|severe|heavy\s+damage|smags/i.test(window) ||
      amountNum >= 5000;
    const isoM = window.match(/\b(DE|FR|PL|LT|EE|LV|GB|UK|IT|ES|NL|BE|AT|CH|SE|NO|DK|FI|CZ|SK|HU|RO)\b/i);
    const iso = isoM?.[1] ? isoM[1].toUpperCase().replace("UK", "GB") : "LV";
    let descShort = window.replace(/\s+/g, " ").slice(0, 140);
    if (descShort.length < 8) descShort = `Ieraksts no pārskata (${dateStr})`;
    const desc = `[${sourceNote}] ${window.replace(/\s+/g, " ").slice(0, 220)}`;
    const row: ClaimTableRow = {
      date: dateStr,
      desc,
      descShort,
      amount: `${amtRaw.replace(/\s+/g, " ")} EUR`,
      iso,
      emphasize,
      sourceNote,
    };
    const k = rowDedupeKey(row);
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push(row);
  }

  return rows;
}

/** Apvieno, noņem dublikātus, kārto pēc datuma. */
export function mergeClaimRowLists(parts: ClaimTableRow[][]): ClaimTableRow[] {
  const map = new Map<string, ClaimTableRow>();
  for (const part of parts) {
    for (const r of part) {
      const k = rowDedupeKey(r);
      if (!map.has(k)) map.set(k, r);
    }
  }
  return [...map.values()].sort((a, b) => sortKey(a) - sortKey(b));
}

/** sourceOrdinal → klienta atskaitē tikai „Pārskats N”, bez failu nosaukumiem. */
export function extractClaimRowsForPdfInsight(text: string, sourceOrdinal: number): ClaimTableRow[] {
  const note = `Pārskats ${sourceOrdinal}`;
  const dense = parseClaimRowsFromDenseText(text, note);
  const lines = parseClaimRowsFromLineBasedText(text, note);
  return mergeClaimRowLists([dense, lines]);
}
