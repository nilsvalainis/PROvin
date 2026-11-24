/**
 * Land Rover / Range Rover (un Jaguar ar to pašu dzinēju) «Lion» V6 dīzeļa identifikācija - tīra funkcija
 * bez servera importiem (lieto gan ✨ brīfs, gan statiskās agregātu pakas).
 * 3.0 V6 dīzelis = 306DT (TDV6 / SDV6); agrākais 2.7 TDV6 = 276DT.
 * Konservatīva: Ingenium (2.0 / 3.0 I6 MHEV), 4.4 SDV8, benzīna 3.0 V6 S/C un citas markas NETRĀPA.
 */
export type LrV6DieselVariant = "3.0" | "2.7";

export type LrV6DieselInput = {
  makeModel: string;
  /** Dīlera / Outvin modeļa, sērijas, jaudas u.c. teksti - tikai šī auto identitāte, ne sludinājuma proza. */
  extraIdentityText?: string;
  engineCode?: string;
  fuel?: string;
  displacementCm3?: number | null;
  year?: number | null;
  vin?: string | null;
};

export type LrV6DieselMatch = {
  variant: LrV6DieselVariant;
  brand: "Land Rover" | "Jaguar";
  /** Kā noteikts - prompta pierādījumam. */
  evidence: string;
  /** Discovery 3/4 vai Range Rover Sport L320 - rāmja konstrukcija. */
  ladderFrame: boolean;
};

const LR_RE = /LAND\s*-?\s*ROVER|RANGE\s*-?\s*ROVER|\bDISCOVERY\b|\bDEFENDER\b|\bVELAR\b|\bEVOQUE\b/;
const JAGUAR_RE = /\bJAGUAR\b/;
const DIESEL_RE = /D[IĪ]ZE[LĻ]|DIESEL|\bTDV6\b|\bSDV6\b/;

/** Lion dzinēju kodi / apzīmējumi. 306DT tikai kā vesels vārds (ne DT306 / 306DTA). */
const LION_30_RE = /\b(?:306DT|30DDTX?|AJ-?V6D|AJD-?V6|3[.,]0\s*(?:L\s*)?[TS]DV6|[TS]DV6\s*3[.,]0)\b/;
const LION_27_RE = /\b(?:276DT|2[.,]7\s*(?:L\s*)?TDV6|TDV6\s*2[.,]7)\b/;
const LION_ANY_RE = /\b(?:TDV6|SDV6)\b/;

/** Skaidri cits dzinējs - nekad neattiecina likumu. */
const OTHER_ENGINE_RE =
  /\bINGENIUM\b|\bMHEV\b|\bDT306\b|\bAJ20D6\b|\bAJ200D\b|\b204DT[A-Z]?\b|\b20[0-9]DT[A-Z]\b|\b448DT\b|\b368DT\b|\b224DT\b|\bSDV8\b|\bTDV8\b|\bSD4\b|\bTD4\b|\bED4\b|\b306PS\b|\b508PS\b|\bAJ126\b|\bAJ133\b|\bAJ20P\d?\b|\bPT\d{3}\b/;

function brandOf(hay: string, vin: string): "Land Rover" | "Jaguar" | null {
  if (LR_RE.test(hay) || vin.startsWith("SAL")) return "Land Rover";
  if (JAGUAR_RE.test(hay) || vin.startsWith("SAJ") || vin.startsWith("SADC") || vin.startsWith("SADF")) {
    return "Jaguar";
  }
  return null;
}

function isLadderFrame(hay: string, year: number | null | undefined): boolean {
  if (year == null) return false;
  if (/\bDISCOVERY\b/.test(hay) && !/DISCOVERY\s*SPORT/.test(hay) && year <= 2016) return true;
  if (/RANGE\s*-?\s*ROVER\s*SPORT/.test(hay) && year <= 2013) return true;
  return false;
}

export function detectLandRoverV6Diesel(input: LrV6DieselInput): LrV6DieselMatch | null {
  const code = (input.engineCode ?? "").trim().toUpperCase();
  const hay = `${input.makeModel} ${input.extraIdentityText ?? ""} ${code}`.toUpperCase();
  const vin = (input.vin ?? "").trim().toUpperCase();
  const brand = brandOf(hay, vin);
  if (!brand) return null;
  if (OTHER_ENGINE_RE.test(hay)) return null;

  const fuel = (input.fuel ?? "").toUpperCase();
  const diesel = DIESEL_RE.test(fuel) || DIESEL_RE.test(hay);
  const year = input.year ?? null;
  const cm3 = input.displacementCm3 ?? null;
  const ladderFrame = brand === "Land Rover" && isLadderFrame(hay, year);
  const hit = (variant: LrV6DieselVariant, evidence: string): LrV6DieselMatch => ({
    variant,
    brand,
    evidence,
    ladderFrame,
  });

  // 1) Tiešs kods / apzīmējums.
  if (LION_27_RE.test(hay)) return hit("2.7", "dzinēja kods / apzīmējums (276DT / 2.7 TDV6)");
  if (LION_30_RE.test(hay)) return hit("3.0", "dzinēja kods / apzīmējums (306DT / 3.0 TDV6 / SDV6)");
  if (LION_ANY_RE.test(hay)) {
    if (cm3 != null && cm3 >= 2650 && cm3 <= 2760) return hit("2.7", "TDV6 + ~2720 cm³");
    if (cm3 == null || (cm3 >= 2950 && cm3 <= 3010)) return hit("3.0", "TDV6 / SDV6 apzīmējums");
    return null;
  }

  // 2) Bez koda: dīzelis + tilpums (+ gads).
  if (!diesel || cm3 == null) return null;
  if (cm3 >= 2700 && cm3 <= 2730 && (year == null || year <= 2012)) {
    return hit("2.7", `${brand} dīzelis ${cm3} cm³ (276DT tilpums)`);
  }
  // 306DT = 2993 cm³; Ingenium 3.0 I6 dīzelis = 2997 cm³ - tos nošķir tilpums.
  if (cm3 >= 2980 && cm3 <= 2995 && (year == null || year <= 2021)) {
    return hit("3.0", `${brand} dīzelis ${cm3} cm³ (306DT tilpums)`);
  }
  // Noapaļots tilpums (piem. 3000): tikai pirms Ingenium I6 laika.
  if (cm3 >= 2996 && cm3 <= 3010 && year != null && year <= 2019) {
    return hit("3.0", `${brand} dīzelis ~3.0 l, ${year}. g. (pirms Ingenium I6)`);
  }
  return null;
}

export function landRoverV6DieselLabel(m: LrV6DieselMatch): string {
  const engine = m.variant === "2.7" ? "2.7 TDV6 (276DT)" : "3.0 V6 dīzelis (306DT, TDV6 / SDV6)";
  return `${m.brand} ${engine} - Ford/PSA «Lion» V6 dīzeļa konstrukcija`;
}

/** Tipiskās kaites - viena vieta brīfam un statiskajai pakai. */
export const LR_V6_DIESEL_TYPICAL_FAULTS =
  "kloķvārpstas lūzums un klaņu / pamatgultņu bojājumi (bieži pēc eļļas bada - nolietota eļļa, gari maiņas intervāli, kritis eļļas spiediens); eļļas sūkņa un eļļas spiediena problēmas; turbokompresori un to eļļas padeve; EGR vārsti un dzesētāji, DPF aizsērēšana īsos braucienos; sadales zobsiksnas (priekšā) un degvielas sūkņa piedziņas siksnas (aizmugurē) maiņa pēc ražotāja intervāla. Kloķvārpstas vai gultņu bojājuma gadījumā praktiskais risinājums parasti ir dzinēja maiņa - dārgs remonts.";

export const LR_V6_DIESEL_INSPECTION_STEPS =
  "pilna eļļas maiņu vēsture ar datumiem un km (gari intervāli šim dzinējam paaugstina risku); dokumentēta zobsiksnu maiņa; aukstā starta skaņa - metāliska klaboņa vai klauvējieni no dzinēja apakšas pirmajās sekundēs; eļļas spiediena un kļūdu kodu nolasīšana ar ražotāja līmeņa diagnostiku; turbo svilpšana, dūmi vai jaudas zudums paātrinoties; DPF / EGR kļūdas; eļļas noplūdes.";
