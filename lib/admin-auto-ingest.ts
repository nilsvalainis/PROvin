/**
 * Automātiskās ielases (CSDD, DK/EE/SE, sludinājuma vēsture) statuss pēc apmaksas.
 * Tīri tipi un čipu lēmumi (bez I/O), lai var testēt un rādīt adminā.
 */

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
