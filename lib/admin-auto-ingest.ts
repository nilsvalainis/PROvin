/**
 * Automātiskās ielases (CSDD, DK/EE/SE, sludinājuma vēsture) statuss pēc apmaksas.
 * Tīri tipi un čipu lēmumi (bez I/O), lai var testēt un rādīt adminā.
 */

import { countryLabelToIso2 } from "@/lib/country-names-lv";

export const AUTO_INGEST_PART_KEYS = [
  "listing",
  "csdd",
  "tjekbil",
  "mnt_ee",
  "lkf_ee",
  "carinfo",
] as const;

export type AutoIngestPartKey = (typeof AUTO_INGEST_PART_KEYS)[number];

export type AutoIngestStatus = {
  at: string;
  parts: Partial<Record<AutoIngestPartKey, string>>;
};

export type AutoIngestChipTone = "failed" | "no_data";

export type AutoIngestChip = {
  label: string;
  tone: AutoIngestChipTone;
};

/** Seed daļa → avota bloka atslēgas admin darba zonā. */
export const AUTO_INGEST_PART_BLOCKS: Record<AutoIngestPartKey, readonly string[]> = {
  listing: ["listing_analysis", "tirgus"],
  csdd: ["csdd"],
  tjekbil: ["tjekbil"],
  mnt_ee: ["mnt_ee"],
  lkf_ee: ["lkf_ee"],
  carinfo: ["carinfo"],
};

const OK_OR_SKIP = new Set([
  "filled",
  "paste",
  "skip",
  "not_found",
  "no_adify_data",
  "no_listing_url",
  "no_vin",
]);

export function isAutoIngestFailure(part: string | undefined): boolean {
  if (!part) return false;
  if (OK_OR_SKIP.has(part)) return false;
  return true;
}

export function autoIngestChipForPart(part: string | undefined): AutoIngestChip | null {
  if (!isAutoIngestFailure(part)) return null;
  if (part === "no_solver") return { label: "nav captcha", tone: "no_data" };
  return { label: "kļūda", tone: "failed" };
}

/** Bloka atslēga → čips (tikai neveiksmes). */
export function autoIngestChipsByBlock(
  status: AutoIngestStatus | null | undefined,
): Partial<Record<string, AutoIngestChip>> {
  if (!status) return {};
  const out: Partial<Record<string, AutoIngestChip>> = {};
  for (const key of AUTO_INGEST_PART_KEYS) {
    const chip = autoIngestChipForPart(status.parts[key]);
    if (!chip) continue;
    for (const block of AUTO_INGEST_PART_BLOCKS[key]) {
      if (!out[block] || (out[block].tone !== "failed" && chip.tone === "failed")) {
        out[block] = chip;
      }
    }
  }
  return out;
}

/**
 * Valsts (ISO2) → automātiskās ielases reģistra daļa, kas meklē pēc VIN.
 * lkf_ee (OCTA atlīdzības) te nav: «nav atlīdzību» ir normāls rezultāts.
 */
export const AUTO_INGEST_REGISTRY_PART_BY_COUNTRY: Readonly<Record<string, AutoIngestPartKey>> = {
  DK: "tjekbil",
  EE: "mnt_ee",
  SE: "carinfo",
};

export type CsddForeignCountryInput = {
  /** CSDD nobraukuma vēstures rindas (arī «Nobraukums ārvalstīs»). */
  mileageHistory?: ReadonlyArray<{ country?: string | null }> | null;
  previousRegistrationCountry?: string | null;
};

/** ISO2 valstis (ne LV), kuras CSDD min nobraukuma vēsturē vai iepriekšējās reģistrācijas laukā. */
export function csddForeignCountryIsos(csdd: CsddForeignCountryInput | null | undefined): string[] {
  if (!csdd) return [];
  const labels = [
    ...(csdd.mileageHistory ?? []).map((r) => String(r?.country ?? "")),
    String(csdd.previousRegistrationCountry ?? ""),
  ];
  const out = new Set<string>();
  for (const label of labels) {
    const iso = countryLabelToIso2(label);
    if (iso && iso !== "LV") out.add(iso);
  }
  return [...out];
}

/**
 * Pretruna: CSDD rāda ierakstu valstī X, bet X reģistrs pēc VIN auto neatrada.
 * Tas nav koda kļūmes čips, bet signāls operatoram (vajag ārvalsts numurzīmi vai citu avotu).
 * `blockHasData` - ja bloks jau aizpildīts (piem. ar roku), čipu nerāda.
 */
export function autoIngestCsddCountryMismatchChips(
  status: AutoIngestStatus | null | undefined,
  csdd: CsddForeignCountryInput | null | undefined,
  blockHasData: (blockKey: string) => boolean = () => false,
): Partial<Record<string, AutoIngestChip>> {
  if (!status) return {};
  const out: Partial<Record<string, AutoIngestChip>> = {};
  for (const iso of csddForeignCountryIsos(csdd)) {
    const part = AUTO_INGEST_REGISTRY_PART_BY_COUNTRY[iso];
    if (!part || status.parts[part] !== "not_found") continue;
    for (const block of AUTO_INGEST_PART_BLOCKS[part]) {
      if (blockHasData(block)) continue;
      out[block] = { label: `CSDD rāda ${iso}`, tone: "no_data" };
    }
  }
  return out;
}

/** Kļūmju čipi + CSDD valsts pretrunas čipi (kļūme ir svarīgāka). */
export function autoIngestChipsWithCsddCountry(
  status: AutoIngestStatus | null | undefined,
  csdd: CsddForeignCountryInput | null | undefined,
  blockHasData?: (blockKey: string) => boolean,
): Partial<Record<string, AutoIngestChip>> {
  return {
    ...autoIngestCsddCountryMismatchChips(status, csdd, blockHasData),
    ...autoIngestChipsByBlock(status),
  };
}

export function parseAutoIngestStatus(raw: unknown): AutoIngestStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const at = typeof o.at === "string" && o.at.trim() ? o.at.trim() : "";
  if (!at) return null;
  const partsRaw = o.parts && typeof o.parts === "object" ? (o.parts as Record<string, unknown>) : {};
  const parts: AutoIngestStatus["parts"] = {};
  for (const key of AUTO_INGEST_PART_KEYS) {
    const v = partsRaw[key];
    if (typeof v === "string" && v.trim()) parts[key] = v.trim().slice(0, 300);
  }
  return { at, parts };
}
