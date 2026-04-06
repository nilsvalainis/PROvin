/**
 * CSDD defektu kodi (X.X.X / X.X.X.X) un aprakstu sadalīšana — „Detalizētais vērtējums”, „Iepriekšējās apskates dati”.
 */

export type CsddDefectRow = {
  code: string;
  rating: string;
  defects: string;
};

const DEFECT_CODE_RE = /(\d+\.\d+\.\d+(?:\.\d+)?)/g;

/** Pirmā rinda „1 - …” kā novērtējums, pārējais — trūkumi. */
function splitRatingAndDefects(body: string): { rating: string; defects: string } {
  const trimmed = body.trim();
  if (!trimmed) return { rating: "", defects: "" };
  const nl = trimmed.indexOf("\n");
  const firstLine = nl >= 0 ? trimmed.slice(0, nl).trim() : trimmed;
  const rest = nl >= 0 ? trimmed.slice(nl + 1).trim() : "";
  if (/^\d+\s*-\s*.+/.test(firstLine) && firstLine.length < 220) {
    return { rating: firstLine, defects: rest };
  }
  return { rating: "", defects: trimmed };
}

/**
 * Sadala tekstu pēc koda paraugiem X.X.X vai X.X.X.X (arī salipušiem, piem. 6.1.1.2Nesošās…).
 * Ja kodu nav — viss teksts tiek traktēts kā apraksts (novērtējums no pirmās „1 - …” rindas).
 */
export function parseDefectRowsFromText(block: string): CsddDefectRow[] {
  const raw = block.replace(/\r/g, "").trim();
  if (!raw) return [];

  const normalized = raw.replace(/^\s*\*?\s*Kods\s*:\s*/gim, "");

  const matches = [...normalized.matchAll(DEFECT_CODE_RE)];
  if (matches.length === 0) {
    const { rating, defects } = splitRatingAndDefects(normalized);
    return [{ code: "", rating, defects }];
  }

  const rows: CsddDefectRow[] = [];
  for (let i = 0; i < matches.length; i++) {
    const code = matches[i][1];
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : normalized.length;
    const body = normalized.slice(start, end).trim();
    const { rating, defects } = splitRatingAndDefects(body);
    rows.push({ code, rating, defects });
  }

  return rows.filter((r) => r.code.trim() || r.rating.trim() || r.defects.trim());
}

export function defectRowHasData(r: CsddDefectRow): boolean {
  return Boolean(r.code.trim() || r.rating.trim() || r.defects.trim());
}

export function emptyCsddDefectRow(): CsddDefectRow {
  return { code: "", rating: "", defects: "" };
}
