/**
 * Oficiālā reģistra piedziņa (Dānijas DMR / tjekbil.dk `traekkendeAksler`) pret sludinājumu / car.info.
 * 21.11 (Passat 2.0 TDI 176 kW universālis): DMR saka 1 dzenošā ass, bet AI komentārs rakstīja 4Motion,
 * jo pilnpiedziņa bija tikai sludinājumā / car.info. Reģistrs ir prioritārs; AWD apgalvojums ir pretruna.
 */
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { FactCheckFlag } from "@/lib/unit-facts/types";
import { TJEKBIL_DRIVEN_AXLES_LABEL } from "@/lib/vin-sources/tjekbil-map";

export type RegistryDrivetrain = {
  /** Dzenošo asu skaits no reģistra. */
  drivenAxles: number;
  /** true = pilnpiedziņa (2+ dzenošās asis vieglajam auto). */
  awd: boolean;
  sourceLabel: string;
};

/** Pilnpiedziņas apgalvojumi komentārā (LV / EN / ražotāju nosaukumi). */
export const AWD_CLAIM_RE =
  /4\s?motion|quattro|x\s?drive|4matic|\bawd\b|\b4wd\b|\b4x4\b|all[\s-]?wheel[\s-]?drive|pilnpiedziņ\p{L}*|visu\s+riteņu\s+piedziņ\p{L}*|haldex/iu;
/** „nav pilnpiedziņa”, „bez 4Motion”, „ne AWD” - noliegums nav pretruna. */
const AWD_NEGATION_RE =
  /(?:\bnav\b|\bbez\b|\bne\b|\bnevis\b|\bnot\b|\bno\b)(?:\s+\S+){0,3}?\s*(?:4\s?motion|quattro|x\s?drive|4matic|awd|4wd|4x4|pilnpiedziņ|visu\s+riteņu|haldex)/iu;

const DRIVEN_AXLES_LINE_RE = new RegExp(
  `${TJEKBIL_DRIVEN_AXLES_LABEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(\\d)`,
  "i",
);
const RAW_DRIVEN_AXLES_RE = /"traekkendeAksler"\s*:\s*"?(\d)"?/;
const FRONT_WHEEL_DRIVE_RE = /priekšējo\s+riteņu\s+piedziņa|aizmugurējo\s+riteņu\s+piedziņa/i;
const AWD_REGISTRY_RE = /pilnpiedziņa/i;

/** Piedziņa no oficiālā reģistra (šobrīd Dānijas DMR). Vecajiem pasūtījumiem - no saglabātā RAW JSON. */
export function extractRegistryDrivetrain(sourceBlocks: WorkspaceSourceBlocks): RegistryDrivetrain | null {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const dk = blocks.tjekbil;
  const sourceLabel = SOURCE_BLOCK_LABELS.tjekbil;
  const status = dk?.statusRecords ?? "";
  const fromLine = status.match(DRIVEN_AXLES_LINE_RE)?.[1] ?? dk?.rawUnprocessedData?.match(RAW_DRIVEN_AXLES_RE)?.[1];
  const n = fromLine ? Number(fromLine) : NaN;
  if (Number.isInteger(n) && n >= 1) return { drivenAxles: n, awd: n >= 2, sourceLabel };
  const powerLine = status.split("\n").find((l) => /^jauda\s*\/\s*piedziņa:/i.test(l.trim())) ?? "";
  if (FRONT_WHEEL_DRIVE_RE.test(powerLine)) return { drivenAxles: 1, awd: false, sourceLabel };
  if (AWD_REGISTRY_RE.test(powerLine)) return { drivenAxles: 2, awd: true, sourceLabel };
  return null;
}

/** Kanoniskās lapas rinda (AI promptam): reģistra piedziņa ar prioritāti. */
export function formatRegistryDrivetrainFactLine(dt: RegistryDrivetrain, otherSourcesClaimAwd: boolean): string {
  if (dt.awd) {
    return `Piedziņa (oficiālais reģistrs ${dt.sourceLabel}, prioritāte): pilnpiedziņa (${dt.drivenAxles} dzenošās asis)`;
  }
  return (
    `Piedziņa (oficiālais reģistrs ${dt.sourceLabel}, prioritāte pār sludinājumu / car.info): ${dt.drivenAxles} dzenošā ass - NAV pilnpiedziņa; ` +
    "aizliegts rakstīt 4Motion / quattro / xDrive / 4MATIC / AWD / 4x4 / Haldex riskus" +
    (otherSourcesClaimAwd
      ? ". PRETRUNA: sludinājums / citi avoti min pilnpiedziņu - tekstā drīkst minēt tikai kā neatbilstību reģistram"
      : "")
  );
}

/** Vai pārējie avoti (bez Dānijas reģistra) apgalvo pilnpiedziņu. */
export function otherSourcesClaimAwd(haystackWithoutRegistry: string): boolean {
  return (haystackWithoutRegistry ?? "")
    .split(/[\n.!?]+/)
    .some((s) => AWD_CLAIM_RE.test(s) && !AWD_NEGATION_RE.test(s));
}

export type DrivetrainContradiction = { message: string; sentence: string };

/** Komentārs apgalvo pilnpiedziņu, bet reģistrs saka 1 dzenošā ass. */
export function findDrivetrainContradictions(text: string, dt: RegistryDrivetrain | null): DrivetrainContradiction[] {
  if (!dt || dt.awd) return [];
  const plain = adminRichHtmlToPlainText(text ?? "").replace(/\s+/g, " ").trim();
  if (!plain) return [];
  const sentences = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
  const hit = sentences.find((s) => AWD_CLAIM_RE.test(s) && !AWD_NEGATION_RE.test(s) && !/neatbilst|pretrun/i.test(s));
  if (!hit) return [];
  return [
    {
      message: `Oficiālais reģistrs (${dt.sourceLabel}) saka ${dt.drivenAxles} dzenošā ass (nav pilnpiedziņa), teksts apgalvo 4Motion / AWD.`,
      sentence: hit,
    },
  ];
}

export function drivetrainContradictionsToFlags(hits: readonly DrivetrainContradiction[]): FactCheckFlag[] {
  return hits.map((hit) => ({
    id: "drivetrain_awd",
    level: "E",
    kind: "contradiction",
    message: hit.message,
    sentence: hit.sentence,
  }));
}
