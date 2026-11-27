/**
 * CheckThisReg.com - ārējs dīlera datu avots (Nila lēmums 27.11.2026). Dīlera datu pasūtījumā
 * blakus ielases pogai JEBKURAM auto rāda pogas «CheckThisReg» un «auto-records.com», kas atver
 * vietni jaunā cilnē un nokopē VIN starpliktuvē (CheckThisReg nav publiska VIN URL parametra -
 * pārbaudīts 27.11, tāpēc tikai sākumlapa). Marku saraksts nosaka tikai CheckThisReg izcelšanu
 * (dīlera ielase «datu nav» + marka/gads atbilst).
 *
 * Markas un gadu sliekšņus papildina tikai šeit: CHECKTHISREG_STRONG_MAKES, CHECKTHISREG_MIN_YEAR,
 * aizstājvārdi teksta atpazīšanai un WMI tabula (rezerve, ja markas teksta nav).
 */

import { vinModelYears } from "@/lib/vin-decode";

export const CHECKTHISREG_URL = "https://www.checkthisreg.com/";

/** Otra ārējā dīlera datu saite (Nila lēmums 27.11) - redzama jebkuram auto, VIN starpliktuvē. */
export const AUTO_RECORDS_URL = "https://www.auto-records.com/";

/** Markas, kurām CheckThisReg ir spēcīgs dīlera datu avots (izpēte 27.11). */
export const CHECKTHISREG_STRONG_MAKES = [
  "RENAULT",
  "DACIA",
  "BMW",
  "MINI",
  "JAGUAR",
  "MERCEDES-BENZ",
  "SMART",
  "LAND ROVER",
  "AUDI",
  "SKODA",
  "VOLKSWAGEN",
  "SEAT",
  "CUPRA",
  "HONDA",
  "ROLLS-ROYCE",
] as const;

export type CheckThisRegMakeKey = (typeof CHECKTHISREG_STRONG_MAKES)[number];

/** Pirmās reģistrācijas / izlaiduma gads >= slieksnis. Markām bez ieraksta - bez gada ierobežojuma. */
export const CHECKTHISREG_MIN_YEAR: Partial<Record<CheckThisRegMakeKey, number>> = {
  "MERCEDES-BENZ": 2008,
  SMART: 2008,
  "LAND ROVER": 2009,
  AUDI: 2013,
  SKODA: 2013,
  VOLKSWAGEN: 2017,
  SEAT: 2017,
  CUPRA: 2017,
  HONDA: 2020,
  "ROLLS-ROYCE": 2020,
};

const DISPLAY: Record<CheckThisRegMakeKey, string> = {
  RENAULT: "Renault",
  DACIA: "Dacia",
  BMW: "BMW",
  MINI: "MINI",
  JAGUAR: "Jaguar",
  "MERCEDES-BENZ": "Mercedes-Benz",
  SMART: "smart",
  "LAND ROVER": "Land Rover",
  AUDI: "Audi",
  SKODA: "Škoda",
  VOLKSWAGEN: "Volkswagen",
  SEAT: "SEAT",
  CUPRA: "Cupra",
  HONDA: "Honda",
  "ROLLS-ROYCE": "Rolls-Royce",
};

/** Vārdu virknes tekstā (lielie burti, bez diakritikas), kas nozīmē marku. */
const ALIASES: Record<CheckThisRegMakeKey, string[][]> = {
  RENAULT: [["RENAULT"]],
  DACIA: [["DACIA"]],
  BMW: [["BMW"]],
  MINI: [["MINI"]],
  JAGUAR: [["JAGUAR"]],
  "MERCEDES-BENZ": [["MERCEDES"]],
  SMART: [["SMART"]],
  "LAND ROVER": [["LAND", "ROVER"], ["LANDROVER"], ["RANGE", "ROVER"]],
  AUDI: [["AUDI"]],
  SKODA: [["SKODA"]],
  VOLKSWAGEN: [["VOLKSWAGEN"], ["VW"]],
  SEAT: [["SEAT"]],
  CUPRA: [["CUPRA"]],
  HONDA: [["HONDA"]],
  "ROLLS-ROYCE": [["ROLLS", "ROYCE"], ["ROLLS"], ["ROLLSROYCE"]],
};

/** VIN WMI (1.-3. zīme) -> marka. Tikai rezerve, ja pasūtījumā nav markas teksta. */
export const CHECKTHISREG_WMI: Readonly<Record<string, CheckThisRegMakeKey>> = {
  VF1: "RENAULT",
  VF2: "RENAULT",
  VF6: "RENAULT",
  VF8: "RENAULT",
  VS5: "RENAULT",
  X7L: "RENAULT",
  UU1: "DACIA",
  UU3: "DACIA",
  WBA: "BMW",
  WBS: "BMW",
  WBY: "BMW",
  WMW: "MINI",
  SAJ: "JAGUAR",
  WDD: "MERCEDES-BENZ",
  WDB: "MERCEDES-BENZ",
  WDC: "MERCEDES-BENZ",
  WDF: "MERCEDES-BENZ",
  W1K: "MERCEDES-BENZ",
  W1N: "MERCEDES-BENZ",
  W1V: "MERCEDES-BENZ",
  WME: "SMART",
  SAL: "LAND ROVER",
  WAU: "AUDI",
  WUA: "AUDI",
  TRU: "AUDI",
  TMB: "SKODA",
  WVW: "VOLKSWAGEN",
  WV1: "VOLKSWAGEN",
  WV2: "VOLKSWAGEN",
  WVG: "VOLKSWAGEN",
  VSS: "SEAT",
  JHM: "HONDA",
  SHH: "HONDA",
  SHS: "HONDA",
  SCA: "ROLLS-ROYCE",
};

function normWords(s: string): string[] {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/** Marka no teksta (piem. «MERCEDES-BENZ C 220», «LAND ROVER RANGE ROVER»); null, ja nav sarakstā. */
export function checkThisRegMakeFromText(text: string): CheckThisRegMakeKey | null {
  const words = normWords(text);
  if (words.length === 0) return null;
  // Agrākā atbilsme tekstā uzvar (marka parasti ir pirmā; «BMW MINI» -> BMW).
  let best: { key: CheckThisRegMakeKey; at: number } | null = null;
  for (const key of CHECKTHISREG_STRONG_MAKES) {
    for (const seq of ALIASES[key]) {
      for (let i = 0; i + seq.length <= words.length; i++) {
        if (seq.every((w, j) => words[i + j] === w)) {
          if (!best || i < best.at) best = { key, at: i };
          break;
        }
      }
    }
  }
  return best?.key ?? null;
}

/** Gads no teksta («2015-03-12», «12.03.2015», «2015»). */
export function checkThisRegYearFromText(text: string | null | undefined): number | null {
  const m = /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/.exec((text ?? "").trim());
  return m ? Number(m[1]) : null;
}

export type CheckThisRegInput = {
  vin?: string | null;
  /** Markas teksti no pasūtījuma datiem (CSDD API marka, CSDD «Marka, modelis» u.c.). */
  makeTexts?: readonly (string | null | undefined)[];
  /** Pirmās reģistrācijas / izlaiduma gads; ja nav - pēc VIN 10. zīmes (jaunākais iespējamais). */
  year?: number | null;
  now?: Date;
};

/**
 * Atgriež markas nosaukumu (piem. «Renault»), ja CheckThisReg ir spēcīgs šim auto (izcelšanai); citādi null.
 * Teksta marka ir noteicošā: ja tā ir aizpildīta un nav sarakstā, VIN WMI netiek ņemts vērā.
 * Markām ar gada slieksni: ja gads nav zināms vai mazāks par slieksni - null.
 */
export function checkThisRegMake(input: CheckThisRegInput): string | null {
  const vin = (input.vin ?? "").trim().toUpperCase();
  const texts = (input.makeTexts ?? []).map((t) => (t ?? "").trim()).filter(Boolean);
  let key: CheckThisRegMakeKey | null = null;
  for (const t of texts) {
    key = checkThisRegMakeFromText(t);
    if (key) break;
  }
  if (!key && texts.length === 0 && vin.length >= 3) key = CHECKTHISREG_WMI[vin.slice(0, 3)] ?? null;
  if (!key) return null;
  const minYear = CHECKTHISREG_MIN_YEAR[key];
  if (minYear != null) {
    let year = input.year ?? null;
    if (year == null && vin.length === 17) year = vinModelYears(vin[9], input.now ?? new Date())[0] ?? null;
    if (year == null || year < minYear) return null;
  }
  return DISPLAY[key];
}

type BlocksLike = {
  csdd?: {
    makeModel?: string;
    firstRegistration?: string;
    registry?: { data?: { make?: string; year?: string; firstRegistrationIso?: string } };
  } | null;
} | null | undefined;

/** Markas teksti no pasūtījuma avotu blokiem. */
export function checkThisRegMakeTexts(blocks: BlocksLike): string[] {
  if (!blocks) return [];
  return [blocks.csdd?.registry?.data?.make ?? "", blocks.csdd?.makeModel ?? ""].filter((s) => s.trim());
}

/** Gads no CSDD: API izlaiduma gads -> API pirmā reģistrācija -> formas pirmā reģistrācija. */
export function checkThisRegYear(blocks: BlocksLike): number | null {
  const r = blocks?.csdd?.registry?.data;
  return (
    checkThisRegYearFromText(r?.year) ??
    checkThisRegYearFromText(r?.firstRegistrationIso) ??
    checkThisRegYearFromText(blocks?.csdd?.firstRegistration) ??
    null
  );
}

/** Ērtība komponentiem: marka pēc pasūtījuma blokiem + VIN. */
export function checkThisRegMakeFromBlocks(blocks: BlocksLike, vin: string): string | null {
  return checkThisRegMake({ vin, makeTexts: checkThisRegMakeTexts(blocks), year: checkThisRegYear(blocks) });
}

/** Izcelšana: dīlera ielase beidzās ar «datu nav» un marka/gads ir sarakstā. */
export function checkThisRegHighlighted(jobStatus: string | null | undefined, make: string | null | undefined): boolean {
  return jobStatus === "no_data" && Boolean(make);
}

export function checkThisRegHint(make: string): string {
  return `${make} dati - CheckThisReg`;
}

/** VIN starpliktuvē (navigator.clipboard, citādi textarea + execCommand). Kļūdas klusē. */
export function copyVinToClipboard(vin: string): void {
  const v = vin.trim();
  if (!v || typeof window === "undefined") return;
  const fallback = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = v;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      /* nav kritiski */
    }
  };
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(v).catch(fallback);
      return;
    }
  } catch {
    /* fallback zemāk */
  }
  fallback();
}
