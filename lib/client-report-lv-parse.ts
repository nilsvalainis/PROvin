/**
 * Heuristikas CSDD / LTAB brīvā teksta izvilkšanai klienta PDF (2.1–2.3).
 */

export type LvRegistryBasics = {
  markModel: string | null;
  regNr: string | null;
  firstReg: string | null;
  euro: string | null;
  powerKw: string | null;
  massKg: string | null;
  roadTaxEur: string | null;
};

function firstMatch(csdd: string, re: RegExp): string | null {
  const m = csdd.replace(/\r/g, "").match(re);
  return m?.[1]?.trim().replace(/\s{2,}/g, " ") ?? null;
}

/** Kompakti lauki no reģistra piezīmēm (CSDD eksports). */
export function parseLvRegistryBasics(csdd: string): LvRegistryBasics {
  const t = csdd.replace(/\r/g, "");
  let markModel =
    firstMatch(t, /(?:marka|modelis)\s*[,&]?\s*(?:modelis|marka)?\s*[:\-]\s*([^\n]{2,80})/i) ??
    firstMatch(
      t,
      /\b(BMW|Audi|Mercedes-Benz|Mercedes|VW|Volkswagen|Toyota|Volvo|Opel|Ford|Peugeot|Renault|Hyundai|Kia|Škoda|Skoda|Nissan|Mazda|Honda|Citro[ëe]n|Tesla)\s+[A-Za-z0-9][A-Za-z0-9\s\-]{1,40}/i,
    );
  if (markModel) markModel = markModel.split(/\n/)[0]!.trim();

  const regNr =
    firstMatch(
      t,
      /(?:reģ\.?\s*nr\.?|reģistr[āa]cijas\s+numurs|valsts\s+numurzīme)\s*[:\-]?\s*([A-ZĀČĒĢĪĶĻŅŠŪŽa-zāčēģīķļņšūž0-9\s\-]{4,14})/i,
    ) ?? firstMatch(t, /\b([A-Z]{1,2}\s?\d{3,4})\b/);

  const firstReg =
    firstMatch(t, /pirm[āa]\s+reģistr[āa]cij[as]*\s*[:\-]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i) ??
    firstMatch(t, /pirm[āa]\s+reģistr[āa]cij[as]*\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i);

  const euro =
    firstMatch(t, /(?:emisijas\s+klase|euro\s*standarts?|euro)\s*[:\-]?\s*(EURO\s*\d|euro\s*\d|E\s*\d)/i) ??
    firstMatch(t, /\b(EURO\s*[1-6])\b/i);

  const powerKw =
    firstMatch(t, /(?:jauda|jauda\s*kw)\s*[:\-]?\s*(\d{2,4})\s*kW/i) ?? firstMatch(t, /\b(\d{2,4})\s*kW\b/i);

  const massKg =
    firstMatch(t, /(?:piln[āa]\s*masa|pielaujam[āa]\s*masa)\s*[:\-]?\s*([\d\s]{3,7})\s*kg/i) ??
    firstMatch(t, /(?:pašmasa)\s*[:\-]?\s*([\d\s]{3,7})\s*kg/i);

  const roadTaxEur =
    firstMatch(
      t,
      /(?:ceļa\s+nodoklis|gada\s+nodeva|ceļa\s+nodeva)[^\d\n]{0,50}?([\d\s]+[.,]\d{2})\s*(?:EUR|€)/i,
    ) ?? firstMatch(t, /(?:ceļa\s+nodoklis)[^\n]{0,80}?(\d{1,3}(?:\s\d{3})*[.,]\d{2})\s*(?:EUR|€)/i);

  return {
    markModel,
    regNr,
    firstReg,
    euro,
    powerKw,
    massKg,
    roadTaxEur,
  };
}

/** Bremžu efektivitāte: Ass 1 / Ass 2 (pirmās atbilstības). */
export function parseBrakeAssPairs(csdd: string): { ass1: string; ass2: string } | null {
  const t = csdd.replace(/\r/g, "");
  const m1 = t.match(/Ass\s*1\s*[:\-]\s*([^\n]{1,56})/i);
  const m2 = t.match(/Ass\s*2\s*[:\-]\s*([^\n]{1,56})/i);
  if (!m1 && !m2) return null;
  return {
    ass1: m1?.[1]?.trim() ?? "—",
    ass2: m2?.[1]?.trim() ?? "—",
  };
}

/** Īss fragments par pēdējo labu TA (0), ja atrodams. */
export function parseTaRating0Snippet(csdd: string): string | null {
  const t = csdd.replace(/\r/g, "");
  const block = t.match(
    /(?:p[ēe]d[ēe]j[āa]|aktual[āa])\s+(?:p[āa]rbaude|apskate)[^\n]{0,120}?vērt[ēe]jums\s*[:\-]?\s*0[^\n]{0,160}/i,
  );
  if (block) return block[0].replace(/\s+/g, " ").trim().slice(0, 220);
  if (/\bv[ēe]rt[ēe]jums\s*:\s*0\b/i.test(t) && /p[ēe]d[ēe]j/i.test(t)) {
    return "tekstā minēts vērtējums 0 (pēdējā pārbaude).";
  }
  return null;
}

/**
 * Rindas ar defektu kodiem pie vērtējuma „2” (pamatpārbaude) — renderēt sarkanā.
 */
export function parseTaRating2DefectLines(csdd: string): string[] {
  const lines = csdd.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let capture = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/pamatp[āa]rbaude|vērt[ēe]jums\s*[:\-]?\s*2\b|2\s*\/\s*5\b/i.test(line)) {
      capture = true;
      continue;
    }
    if (capture && /(?:p[ēe]d[ēe]j[āa]\s+)?p[āa]rbaude|vērt[ēe]jums\s*[:\-]?\s*0\b|0\s*\/\s*5\b/i.test(line)) {
      break;
    }
    if (capture && /^\d+\.\d+\.\d+[\s.\d\-–—]+/i.test(line)) {
      out.push(line);
    }
  }
  return out.slice(0, 24);
}

/** Agrākā gads no OCTA rindām („no kāda gada apdrošināts”). */
export function earliestInsuranceYearFromClaims(dates: string[]): string | null {
  let best: number | null = null;
  for (const d of dates) {
    const y = d.match(/\b(20\d{2})\b/)?.[1] ?? d.match(/(\d{2,4})[./]\d{1,2}[./](\d{4})/)?.[2];
    if (y) {
      const n = parseInt(y, 10);
      if (n >= 1990 && n <= 2100) best = best == null ? n : Math.min(best, n);
    }
  }
  return best != null ? String(best) : null;
}
