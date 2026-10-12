import type { VinScanBrowserId } from "@/lib/vin-scan/catalog";
import type { VinScanParse, VinScanStatus } from "@/lib/vin-scan/types";

export const VIN_SCAN_WANTED_BROWSER_IDS = ["vp_wanted", "lt_itpr"] as const;
export type VinScanWantedId = (typeof VIN_SCAN_WANTED_BROWSER_IDS)[number];

export function isVinScanWantedSource(id: string): id is VinScanWantedId {
  return (VIN_SCAN_WANTED_BROWSER_IDS as readonly string[]).includes(id);
}

export function vinScanWantedStatusLabel(status: VinScanStatus | "idle" | "checking"): string {
  if (status === "found") return "Meklēšanā";
  if (status === "none") return "Nav meklēšanā";
  return "";
}

export function vinScanWantedDotClass(status: VinScanStatus | "idle" | "checking"): string {
  if (status === "found") return "bg-rose-600";
  if (status === "none") return "bg-emerald-500";
  return "";
}

export function vinScanWantedTileClass(id: string, status: VinScanStatus | "idle" | "checking"): string {
  if (!isVinScanWantedSource(id)) return "";
  if (status === "found") return "border-rose-500/70 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  if (status === "none") return "border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20";
  return "";
}

function hasVin(text: string, vin: string): boolean {
  const wanted = vin.trim().toUpperCase();
  return Boolean(wanted) && text.toUpperCase().includes(wanted);
}

function isMissingPage(text: string): boolean {
  return /lapa netika atrasta|lapa nav atrasta|page not found|404 not found|šāda lapa neeksistē/i.test(text);
}

function isFormOnly(text: string): boolean {
  return /k[eė]bulo numeris|valstybinis numeris|variklio numeris|šasijas numurs|sasijas numurs/i.test(text);
}

function isClearNone(text: string): boolean {
  return /duomenų nerasta|įrašų nėra|įrašų nerasta|nerasta įrašų|pagal (jūsų )?nurodytus|neieškoma|nav meklēšanā|nav šajā sarakstā|sarakstā nav|transportlīdzeklis nav meklēšanā/i.test(
    text,
  );
}

function isWantedHit(text: string): boolean {
  return /paieškos priežast|paiešką paskelb|ieškoma transporto priemon|pavogt[ae]|vagyst|meklēšanā izsludin|izsludināts meklēšanā|\bnozagts\b|stolen vehicle|wanted vehicle/i.test(
    text,
  );
}

function extraBits(text: string): string {
  const reason =
    /paieškos priežast(?:is)?:?\s*([^\n.]{3,80})/i.exec(text)?.[1]?.replace(/\s+/g, " ").trim() ||
    /meklēšanas iemesls:?\s*([^\n.]{3,80})/i.exec(text)?.[1]?.replace(/\s+/g, " ").trim() ||
    "";
  const state =
    /paieškos būsen(?:a)?:?\s*([^\n.]{3,40})/i.exec(text)?.[1]?.replace(/\s+/g, " ").trim() ||
    /valstyb[eė]:?\s*([^\n.]{2,40})/i.exec(text)?.[1]?.replace(/\s+/g, " ").trim() ||
    "";
  return [reason, state].filter(Boolean).join(", ");
}

/** Meklēto TL lapa: found = ir sarakstā, none = nav sarakstā. 404 nav „nav meklēšanā”. */
export function classifyPoliceWanted(id: VinScanBrowserId, text: string, vin: string): VinScanParse | null {
  if (id !== "vp_wanted" && id !== "lt_itpr") return null;
  const flat = text.replace(/\u00a0/g, " ");
  if (isMissingPage(flat) && !isWantedHit(flat) && !isClearNone(flat)) {
    return { status: "unknown", summary: "Publiskā lapa nav pieejama" };
  }
  if (isClearNone(flat)) return { status: "none", summary: "Nav meklēšanā" };
  if (isWantedHit(flat) && (hasVin(flat, vin) || /paieškos priežast|meklēšanā izsludin/i.test(flat))) {
    const extra = extraBits(flat);
    return { status: "found", summary: extra ? `Meklēšanā. ${extra}` : "Meklēšanā" };
  }
  if (isFormOnly(flat) && !isWantedHit(flat) && !isClearNone(flat)) return null;
  return null;
}
