import { isValidScanPlate, type VinScanPlates } from "@/lib/vin-scan/plates";
import type { VinScanFlags, VinScanIndicator } from "@/lib/vin-scan/types";

export type FinlandLinkHit = {
  linked: boolean | null;
  source: string;
};

export type FinlandLinkRow = {
  id: string;
  status?: string;
  summary?: string;
  detail?: string;
  flags?: VinScanFlags | null;
};

const FI_TEXT_SOURCES = [
  "traficom",
  "carinfo",
  "csdd",
  "tjekbil",
  "nummerplade",
  "esyn",
  "biluppgifter",
  "mnt_ee",
] as const;

const SOURCE_LABEL: Record<(typeof FI_TEXT_SOURCES)[number], string> = {
  traficom: "Traficom",
  carinfo: "car.info",
  csdd: "CSDD",
  tjekbil: "tjekbil.dk",
  nummerplade: "nummerplade.net",
  esyn: "esyn.dk",
  biluppgifter: "biluppgifter.se",
  mnt_ee: "mnt.ee",
};

const FI_WORD =
  /(?:^|[^A-Za-zĀ-žÄÖäö])(?:somij[aāe]?|finland(?:e)?|suomi|finnish)(?:[^A-Za-zĀ-žÄÖäö]|$)/i;
/** FI tikai kā vesels, reģistrjutīgs tokens. Domēna gali (.fi) un VIN burti neskaitās. */
const FI_CODE = /(?<![A-Za-z0-9.])FI(?![A-Za-z0-9])/;

export function textMentionsFinland(raw: string): boolean {
  const text = String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/suomi\.fi/gi, " ");
  if (!text.trim()) return false;
  if (FI_WORD.test(text)) return true;
  return FI_CODE.test(text);
}

function rowMentionsFinland(row: FinlandLinkRow): boolean {
  if (row.flags?.registrationCountry === "FI") return true;
  return textMentionsFinland([row.summary, row.detail].filter(Boolean).join("\n"));
}

export function detectFinlandLink(
  rows: readonly FinlandLinkRow[],
  plates?: Pick<VinScanPlates, "fi"> | null,
): FinlandLinkHit {
  if (plates && isValidScanPlate("fi", plates.fi)) {
    return { linked: true, source: "FI numurs" };
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const id of FI_TEXT_SOURCES) {
    if (id === "traficom") continue;
    const row = byId.get(id);
    if (!row || row.status === "unknown" || row.status === "skipped" || row.status === "needs_input") continue;
    if (rowMentionsFinland(row)) return { linked: true, source: SOURCE_LABEL[id] };
  }
  const traficom = byId.get("traficom");
  // Traficom ir tikai manuāla saite (Suomi.fi forma). Tas nekad nav automātisks „atrasts”.
  if (traficom?.status === "none") {
    return { linked: false, source: SOURCE_LABEL.traficom };
  }
  return { linked: null, source: "" };
}

export function applyFinlandLink<T extends FinlandLinkRow>(
  rows: readonly T[],
  plates?: Pick<VinScanPlates, "fi"> | null,
): T[] {
  const hit = detectFinlandLink(rows, plates);
  return rows.map((row) => {
    if (row.id !== "traficom") return row;
    const flags: VinScanFlags = { ...(row.flags ?? {}) };
    if (hit.linked == null) {
      delete flags.finlandLinked;
      delete flags.finlandLinkSource;
      return { ...row, flags: Object.keys(flags).length ? flags : undefined };
    }
    flags.finlandLinked = hit.linked;
    flags.finlandLinkSource = hit.source;
    return { ...row, flags };
  });
}

export function finlandLinkStatusLine(flags?: VinScanFlags | null): string {
  if (!flags || flags.finlandLinked == null) return "";
  const answer = flags.finlandLinked ? "jā" : "nē";
  const source = String(flags.finlandLinkSource || "").trim();
  return source ? `Saistīts ar Somiju: ${answer} · ${source}` : `Saistīts ar Somiju: ${answer}`;
}

export function applyFinlandLinkToIndicators(
  rows: readonly VinScanIndicator[],
  plates?: Pick<VinScanPlates, "fi"> | null,
): VinScanIndicator[] {
  return applyFinlandLink(rows, plates);
}
