/**
 * Dzinēja / degvielas patiesība komentāriem.
 * OE VIN Lookup (ja ielādēts) ir avots; citādi dīlera lauki, tad CSDD.
 * Tekstu, kas runā pretī ielādētajai degvielai / kodam, nedrīkst atstāt.
 */
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { extractVehicleReportFingerprint } from "@/lib/admin-vehicle-report-fingerprint";
import { emptyOneautoIngest, type AutoRecordsOneautoIngest } from "@/lib/oneauto-to-auto-records";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

export type PowertrainFuelKind = "petrol" | "diesel" | "electric" | "hybrid" | "lpg" | "unknown";

export type LoadedPowertrainIdentity = {
  engineCode: string;
  fuelKind: PowertrainFuelKind;
  fuelRaw: string;
  source: "oe_vin_lookup" | "dealer" | "csdd" | "unknown";
};

export type GeneratedAgainstPowertrain = {
  engineCode: string;
  fuelKind: PowertrainFuelKind;
};

const DIESEL_FUEL_RE =
  /\b(?:dīze[lļ](?:is|degviela|degvielu|degvielas)?|dizel(?:is)?|diesel|tdi|cdi|hdi|crdi)\b/i;
const PETROL_FUEL_RE =
  /\b(?:benzīn(?:s|a|u|am)?|benzin|petrol|gasoline|otto|tfsi|tsi|gdi|mpi|fsi)\b/i;
const ELECTRIC_FUEL_RE = /\b(?:elektro|electric|bev|ev)\b/i;
const HYBRID_FUEL_RE = /\b(?:hibrīd|hybrid|phev|mhev|mild\s*hybrid)\b/i;
const LPG_FUEL_RE = /\b(?:lpg|gāze|autogāz|cng)\b/i;
const DIESEL_ONLY_KIT_RE =
  /\b(?:dpf|fap|adblue|ad\s*blue|scr|egr\s+dzesēt|common[\s-]?rail|pd\s+sprausl|sodi[\s-]?caurules)\b/i;
const ENGINE_CODE_RE = /\b(?:OM\d{3}(?:\.\d{2,3})?|[A-Z]{2,4}\d{2,4}[A-Z]{0,3})\b/g;
const ENGINE_CODE_FALSE_POSITIVE = new Set([
  "EURO",
  "CSDD",
  "LTAB",
  "AUTO",
  "AUDI",
  "BMW",
  "TDI",
  "TFSI",
  "TSI",
  "FSI",
  "GDI",
  "CDI",
  "HDI",
  "CRDI",
  "DPF",
  "EGR",
  "OEM",
  "VIN",
  "PROVIN",
  "IRISS",
]);

export function classifyFuelKind(raw: string): PowertrainFuelKind {
  const t = raw.trim().toLowerCase();
  if (!t) return "unknown";
  if (ELECTRIC_FUEL_RE.test(t) && !HYBRID_FUEL_RE.test(t) && !PETROL_FUEL_RE.test(t) && !DIESEL_FUEL_RE.test(t)) {
    return "electric";
  }
  if (HYBRID_FUEL_RE.test(t)) return "hybrid";
  if (LPG_FUEL_RE.test(t) && !PETROL_FUEL_RE.test(t) && !DIESEL_FUEL_RE.test(t)) return "lpg";
  if (DIESEL_FUEL_RE.test(t) && !PETROL_FUEL_RE.test(t)) return "diesel";
  if (PETROL_FUEL_RE.test(t) && !DIESEL_FUEL_RE.test(t)) return "petrol";
  if (DIESEL_FUEL_RE.test(t)) return "diesel";
  if (PETROL_FUEL_RE.test(t)) return "petrol";
  return "unknown";
}

export function powertrainIdentityKey(identity: Pick<LoadedPowertrainIdentity, "engineCode" | "fuelKind">): string {
  return `${identity.engineCode}|${identity.fuelKind}`;
}

export function parseGeneratedAgainstPowertrain(raw: unknown): GeneratedAgainstPowertrain | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const engineCode = typeof o.engineCode === "string" ? o.engineCode.trim().toUpperCase().slice(0, 24) : "";
  const fuelKind = classifyFuelKind(typeof o.fuelKind === "string" ? o.fuelKind : "");
  if (!engineCode && fuelKind === "unknown") return undefined;
  return { engineCode, fuelKind };
}

function oeVinLookupLoaded(ingest: AutoRecordsOneautoIngest | null | undefined): boolean {
  return ingest?.results.oe_vin_lookup?.ok === true;
}

export function extractLoadedPowertrainIdentity(
  sourceBlocks: WorkspaceSourceBlocks,
  opts?: { vin?: string | null },
): LoadedPowertrainIdentity {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const fp = extractVehicleReportFingerprint(blocks, { vin: opts?.vin });
  const lookup = oeVinLookupLoaded(blocks.auto_records.oneautoIngest);
  const source: LoadedPowertrainIdentity["source"] = lookup
    ? "oe_vin_lookup"
    : fp.engineCode || fp.fuelType
      ? fp.engineCode
        ? "dealer"
        : "csdd"
      : "unknown";
  return {
    engineCode: fp.engineCode,
    fuelKind: classifyFuelKind(fp.fuelType),
    fuelRaw: fp.fuelType,
    source,
  };
}

function mentionedEngineCodes(text: string): string[] {
  const out = new Set<string>();
  const matches = text.toUpperCase().match(ENGINE_CODE_RE) ?? [];
  for (const raw of matches) {
    const t = raw.replace(/[.,;:]+$/, "");
    if (t.length < 4 || ENGINE_CODE_FALSE_POSITIVE.has(t) || /^\d+$/.test(t)) continue;
    out.add(t);
  }
  return [...out];
}

function firstMatchingSentence(sentences: string[], re: RegExp): string {
  return sentences.find((s) => re.test(s)) ?? sentences[0] ?? "";
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type PowertrainContradiction = {
  id: "powertrain_fuel" | "powertrain_engine";
  message: string;
  sentence: string;
};

export function findPowertrainContradictions(
  text: string,
  identity: LoadedPowertrainIdentity,
): PowertrainContradiction[] {
  const plain = adminRichHtmlToPlainText(text).replace(/\s+/g, " ").trim();
  if (!plain) return [];
  const sentences = splitSentences(plain);
  const out: PowertrainContradiction[] = [];

  if (identity.fuelKind === "petrol") {
    if (DIESEL_FUEL_RE.test(plain)) {
      out.push({
        id: "powertrain_fuel",
        message: `Ielādētā degviela ir benzīns${identity.fuelRaw ? ` (${identity.fuelRaw})` : ""}, teksts saka dīzeli.`,
        sentence: firstMatchingSentence(sentences, DIESEL_FUEL_RE),
      });
    } else if (DIESEL_ONLY_KIT_RE.test(plain) && !/\bbez\s+(?:dpf|fap|adblue|scr)\b/i.test(plain)) {
      out.push({
        id: "powertrain_fuel",
        message: "Ielādētā degviela ir benzīns, teksts min dīzeļa mezglus (DPF / AdBlue / common-rail).",
        sentence: firstMatchingSentence(sentences, DIESEL_ONLY_KIT_RE),
      });
    }
  }
  if (identity.fuelKind === "diesel" && PETROL_FUEL_RE.test(plain) && !DIESEL_FUEL_RE.test(plain)) {
    out.push({
      id: "powertrain_fuel",
      message: `Ielādētā degviela ir dīzelis${identity.fuelRaw ? ` (${identity.fuelRaw})` : ""}, teksts saka benzīnu.`,
      sentence: firstMatchingSentence(sentences, PETROL_FUEL_RE),
    });
  }

  if (identity.engineCode) {
    const mentioned = mentionedEngineCodes(plain).filter((c) => c !== identity.engineCode);
    if (mentioned.length > 0) {
      out.push({
        id: "powertrain_engine",
        message: `Ielādētais dzinēja kods ir ${identity.engineCode}, teksts nosauc ${mentioned.join(", ")}.`,
        sentence:
          sentences.find((s) => mentioned.some((c) => s.toUpperCase().includes(c))) ?? sentences[0] ?? identity.engineCode,
      });
    }
  }
  return out;
}

export function commentContradictsPowertrain(text: string, identity: LoadedPowertrainIdentity): boolean {
  return findPowertrainContradictions(text, identity).length > 0;
}

export function powertrainContradictionsToFlags(hits: readonly PowertrainContradiction[]): FactCheckFlag[] {
  return hits.map((hit) => ({
    id: hit.id,
    level: "E",
    kind: hit.id === "powertrain_fuel" ? "powertrain_fuel" : "powertrain_engine",
    message: hit.message,
    sentence: hit.sentence,
  }));
}

export function generatedAgainstIsStale(
  generated: GeneratedAgainstPowertrain | null | undefined,
  current: LoadedPowertrainIdentity,
): boolean {
  if (!generated) return false;
  if (current.engineCode && generated.engineCode && current.engineCode !== generated.engineCode) return true;
  if (
    current.fuelKind !== "unknown" &&
    generated.fuelKind !== "unknown" &&
    current.fuelKind !== generated.fuelKind
  ) {
    return true;
  }
  return false;
}

export function commentsNeedPowertrainRegenerate(args: {
  sourceBlocks: WorkspaceSourceBlocks;
  commentTexts: readonly string[];
  vin?: string | null;
}): boolean {
  const identity = extractLoadedPowertrainIdentity(args.sourceBlocks, { vin: args.vin });
  const filled = args.commentTexts.map((t) => adminRichHtmlToPlainText(t).trim()).filter(Boolean);
  if (filled.length === 0) return false;
  if (filled.some((t) => commentContradictsPowertrain(t, identity))) return true;
  const generated = parseGeneratedAgainstPowertrain(
    mergeSourceBlocksWithDefaults(args.sourceBlocks).auto_records.oneautoIngest?.generatedAgainst,
  );
  return generatedAgainstIsStale(generated, identity);
}

export const POWERTRAIN_REGENERATE_PROMPT_LV =
  "Dzinēja vai degvielas dati ir mainīti. Ģenerē komentāru no jauna, lai teksts nesakrīt ar ielādētajiem laukiem.";

export function powertrainIdentityPromptBlock(identity: LoadedPowertrainIdentity): string {
  if (identity.fuelKind === "unknown" && !identity.engineCode) return "";
  const fuelLabel =
    identity.fuelKind === "petrol"
      ? "benzīns (ne dīzelis)"
      : identity.fuelKind === "diesel"
        ? "dīzelis (ne benzīns)"
        : identity.fuelRaw || identity.fuelKind;
  const source =
    identity.source === "oe_vin_lookup"
      ? "OE VIN Lookup (avots)"
      : identity.source === "dealer"
        ? "oficiālā dīlera lauki"
        : "CSDD";
  return [
    "IELĀDĒTĀ AGREGĀTU PATIESĪBA (nerunā pretī):",
    identity.engineCode && `- Dzinēja kods: ${identity.engineCode}`,
    identity.fuelKind !== "unknown" && `- Degviela: ${fuelLabel}`,
    `- Avots: ${source}`,
    "Ja teksts saka citu degvielu vai citu motora kodu, tas ir kļūda.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function toGeneratedAgainst(identity: LoadedPowertrainIdentity): GeneratedAgainstPowertrain {
  return { engineCode: identity.engineCode, fuelKind: identity.fuelKind };
}

export function stampGeneratedAgainstOnBlocks(
  sourceBlocks: WorkspaceSourceBlocks,
  vin?: string | null,
): WorkspaceSourceBlocks {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const identity = extractLoadedPowertrainIdentity(blocks, { vin });
  const prev = blocks.auto_records.oneautoIngest;
  return {
    ...blocks,
    auto_records: {
      ...blocks.auto_records,
      oneautoIngest: {
        ...(prev ?? emptyOneautoIngest()),
        generatedAgainst: toGeneratedAgainst(identity),
      },
    },
  };
}
