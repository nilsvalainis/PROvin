/**
 * Heuristikas CSDD / LTAB brīvā teksta izvilkšanai klienta PDF (2.1–2.3).
 *
 * Kartējums (izstrādātāja rokasgrāmata):
 * - nobraukums = odometrs = km (izvadē „km”, aprakstos „nobraukums”)
 * - gross_weight ↔ pilnā masa; curb_weight ↔ pašmasa
 * - road_tax ↔ ekspluatācijas / ceļa nodoklis — summas EUR, bez iekavās esoša papildteksta
 * - euro_standard ↔ emisiju standarts
 * - smoke_opacity ↔ dūmainības koeficients
 */

export type LvRegistryBasics = {
  markModel: string | null;
  regNr: string | null;
  firstReg: string | null;
  euro: string | null;
  powerKw: string | null;
  /** Pilnā / pielaujamā masa (kg), nevis pašmasa. */
  grossMassKg: string | null;
  /** Pašmasa (kg). */
  curbWeightKg: string | null;
  roadTaxEur: string | null;
  smokeOpacity: string | null;
};

/** Strukturēti lauki no tabulas / `atslēga: vērtība` (admin ielīme). */
export type RegistryStructuredFields = {
  firstReg: string | null;
  enginePower: string | null;
  engineDisplacementCm3: string | null;
  grossWeight: string | null;
  curbWeight: string | null;
  fuelType: string | null;
  roadTax: string | null;
  smokeOpacity: string | null;
  euroStandard: string | null;
  makeModel: string | null;
  plateNumber: string | null;
  status: string | null;
  particulateMatter: string | null;
};

function firstMatch(csdd: string, re: RegExp): string | null {
  const m = csdd.replace(/\r/g, "").match(re);
  return m?.[1]?.trim().replace(/\s{2,}/g, " ") ?? null;
}

function normKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/:\s*$/g, "")
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** No nodokļa rindas noņem apakštekstu iekavās (piem. papildu skaidrojums pēc summas). */
export function stripParentheticalTail(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

/**
 * Ceļa / ekspluatācijas nodokļa rinda drukai — noņem tekstu iekavās pēc summas.
 * Piem.: "237,00 EUR (…)" → "237,00 EUR"
 */
export function normalizeRoadTaxDisplay(raw: string): string {
  return stripParentheticalTail(raw.replace(/\r/g, "").trim());
}

export type OdometerHistoryPoint = { t: number; mileageKm: number; label?: string };

/**
 * Intervāla nobraukums: jaunākais odometrs mīnus iepriekšējais (šķirot pēc datuma augošā secībā).
 */
export function intervalRunKm(sortedAsc: OdometerHistoryPoint[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < sortedAsc.length; i++) {
    if (i === 0) {
      out.push(0);
      continue;
    }
    out.push(Math.max(0, sortedAsc[i]!.mileageKm - sortedAsc[i - 1]!.mileageKm));
  }
  return out;
}

/**
 * Izlasa strukturētas atslēgas (`first_reg_date`, `gross_weight`, `road_tax`, u.c.)
 * no TAB vai `atslēga: vērtība` rindām (CSDD eksports, AI JSON lauku nosaukumi).
 */
export function extractRegistryStructuredFields(csdd: string): RegistryStructuredFields {
  const out: RegistryStructuredFields = {
    firstReg: null,
    enginePower: null,
    engineDisplacementCm3: null,
    grossWeight: null,
    curbWeight: null,
    fuelType: null,
    roadTax: null,
    smokeOpacity: null,
    euroStandard: null,
    makeModel: null,
    plateNumber: null,
    status: null,
    particulateMatter: null,
  };
  for (const raw of csdd.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let key: string | null = null;
    let val: string | null = null;
    const tabs = line.split("\t");
    if (tabs.length >= 2) {
      key = tabs[0].replace(/:\s*$/g, "").trim();
      val = tabs.slice(1).join("\t").trim();
    } else {
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (m) {
        key = m[1].trim();
        val = m[2].trim();
      }
    }
    if (!key || !val) continue;
    const nk = normKey(key);
    if (
      nk === "first_reg_date" ||
      nk.includes("first_reg") ||
      nk.includes("pirma_registracija") ||
      nk.includes("pirmas_registracijas") ||
      (nk.includes("registr") && nk.includes("dat") && nk.includes("pirm"))
    ) {
      out.firstReg = val;
      continue;
    }
    if (
      nk === "engine_power" ||
      nk.includes("engine_power") ||
      nk === "jauda" ||
      nk.includes("dzineja_jauda") ||
      nk.includes("motor_power")
    ) {
      out.enginePower = val;
      continue;
    }
    if (
      nk.includes("motor_tilpums") ||
      nk.includes("engine_displacement") ||
      (nk.includes("tilpums") && (nk.includes("cm") || nk.includes("dzineja") || nk.includes("motor"))) ||
      nk.includes("displacement")
    ) {
      out.engineDisplacementCm3 = val;
      continue;
    }
    if (
      nk === "gross_weight" ||
      nk.includes("gross_weight") ||
      nk.includes("pilna_masa") ||
      nk.includes("pilnamasa") ||
      nk.includes("pielaujamamasa") ||
      nk.includes("pilnas_masas") ||
      (nk.includes("pilna") && nk.includes("masa") && !nk.includes("pas"))
    ) {
      out.grossWeight = val;
      continue;
    }
    if (
      nk === "curb_weight" ||
      nk.includes("curb_weight") ||
      nk.includes("pasmasa") ||
      nk === "pas_masa" ||
      (nk.includes("pas") && nk.includes("masa"))
    ) {
      out.curbWeight = val;
      continue;
    }
    if (
      nk === "fuel_type" ||
      nk.includes("fuel_type") ||
      (nk.includes("fuel") && nk.includes("type")) ||
      nk.includes("degvielas_veids") ||
      nk === "degviela"
    ) {
      out.fuelType = val;
      continue;
    }
    if (
      nk === "road_tax" ||
      nk.includes("road_tax") ||
      (nk.includes("ekspluatacijas") && nk.includes("nodokl")) ||
      nk.includes("celja_nodoklis") ||
      nk.includes("celanodoklis") ||
      (nk.includes("transporta") && nk.includes("nodokl"))
    ) {
      out.roadTax = val;
      continue;
    }
    if (
      nk === "smoke_opacity" ||
      nk.includes("smoke_opacity") ||
      nk.includes("dumainibas") ||
      nk.includes("dumainiba")
    ) {
      out.smokeOpacity = val;
      continue;
    }
    if (
      nk === "euro_standard" ||
      nk.includes("euro_standard") ||
      (nk.includes("emisiju") && nk.includes("standart")) ||
      nk.includes("emisijas_klase")
    ) {
      out.euroStandard = val;
      continue;
    }
    if (
      nk === "vehicle_make_model" ||
      nk === "make_model" ||
      (nk.includes("make") && nk.includes("model")) ||
      (nk.includes("marka") && nk.includes("model"))
    ) {
      out.makeModel = val;
      continue;
    }
    if (nk === "plate_number" || nk.includes("plate_number") || nk.includes("numurzime") || nk === "reg_nr") {
      out.plateNumber = val;
      continue;
    }
    if (
      nk === "status" ||
      nk === "vehicle_status" ||
      nk.includes("uzskate") ||
      nk.includes("registracijas_status") ||
      (nk.includes("registr") && nk.includes("status"))
    ) {
      out.status = val;
      continue;
    }
    if (
      nk.includes("cietas_dalinas") ||
      nk.includes("atgazu_cietas") ||
      nk.includes("particulate")
    ) {
      out.particulateMatter = val;
      continue;
    }
  }
  return out;
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

  const grossMassKg = firstMatch(
    t,
    /(?:piln[āa]\s*masa|pielaujam[āa]\s*masa)\s*[:\-]?\s*([\d\s]{3,7})\s*kg/i,
  );

  const curbWeightKg = firstMatch(t, /(?:pašmasa)\s*[:\-]?\s*([\d\s]{3,7})\s*kg/i);

  const roadTaxEur =
    firstMatch(
      t,
      /(?:ceļa\s+nodoklis|gada\s+nodeva|ceļa\s+nodeva|ekspluat[āa]cijas\s+nodoklis|transportl[īi]dzek[ļl]a\s+ekspluat[āa]cijas\s+nodoklis)[^\d\n]{0,50}?([\d\s]+[.,]\d{2})\s*(?:EUR|€)/i,
    ) ??
    firstMatch(t, /(?:ceļa\s+nodoklis)[^\n]{0,80}?(\d{1,3}(?:\s\d{3})*[.,]\d{2})\s*(?:EUR|€)/i);

  const smokeOpacity = firstMatch(
    t,
    /(?:d[ūu]main[īi]bas\s+koeficients|d[ūu]main[īi]ba)\s*[:\-]?\s*([^\n]{1,32})/i,
  );

  return {
    markModel,
    regNr,
    firstReg,
    euro,
    powerKw,
    grossMassKg,
    curbWeightKg,
    roadTaxEur,
    smokeOpacity,
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
