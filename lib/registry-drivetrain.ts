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

/** DMR RAW: „traekhjul”: „Baghjulstrukket” / „Forhjulstrukket” / „Firehjulstrukket”. */
const RAW_TRAEKHJUL_RE = /"traekhjul"\s*:\s*"([^"]+)"/i;

/**
 * Piedziņa no oficiālā reģistra (šobrīd Dānijas DMR). Vecajiem pasūtījumiem - no saglabātā RAW JSON.
 * 23.11 (Mercedes E 300 de, W1K2132161A909201): DMR `traekkendeAksler` = 2, bet tajā pašā DMR
 * „Baghjulstrukket” (aizmugurējo riteņu piedziņa) un ražotāja komplektācija 4x2 (RWD). Skaidri nosaukta
 * piedziņa (priekšējo / aizmugurējo riteņu vai pilnpiedziņa) ir prioritāra pār asu skaitu.
 */
export function extractRegistryDrivetrain(sourceBlocks: WorkspaceSourceBlocks): RegistryDrivetrain | null {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const dk = blocks.tjekbil;
  const sourceLabel = SOURCE_BLOCK_LABELS.tjekbil;
  const status = dk?.statusRecords ?? "";
  const powerLine = status.split("\n").find((l) => /^jauda\s*\/\s*piedziņa:/i.test(l.trim())) ?? "";
  const rawTraek = dk?.rawUnprocessedData?.match(RAW_TRAEKHJUL_RE)?.[1] ?? "";
  if (FRONT_WHEEL_DRIVE_RE.test(powerLine) || /^(?:bag|for)hjulstr(?:u|æ)kket$/i.test(rawTraek.trim())) {
    return { drivenAxles: 1, awd: false, sourceLabel };
  }
  if (AWD_REGISTRY_RE.test(powerLine) || /^firehjulstr(?:u|æ)kket$/i.test(rawTraek.trim())) {
    return { drivenAxles: 2, awd: true, sourceLabel };
  }
  const fromLine = status.match(DRIVEN_AXLES_LINE_RE)?.[1] ?? dk?.rawUnprocessedData?.match(RAW_DRIVEN_AXLES_RE)?.[1];
  const n = fromLine ? Number(fromLine) : NaN;
  if (Number.isInteger(n) && n >= 1) return { drivenAxles: n, awd: n >= 2, sourceLabel };
  return null;
}

/** Ražotāja komplektācijas avota nosaukums piedziņas faktam (bez komatiem / iekavām - lasa regex). */
export const OEM_DRIVETRAIN_SOURCE_LABEL = "ražotāja komplektācija - oficiālā dīlera dati";

const TWO_WD_TEXT_RE =
  /\b4\s?x\s?2\b|\b2wd\b|\brwd\b|\bfwd\b|rear[\s-]?wheel|front[\s-]?wheel|hinterrad|frontantrieb|vorderrad|aizmugur\p{L}*\s+(?:riteņu\s+)?piedziņ|priekšēj\p{L}*\s+(?:riteņu\s+)?piedziņ|baghjul|forhjul|sdrive/iu;
const AWD_TEXT_RE =
  /\b4\s?x\s?4\b|\b4wd\b|\bawd\b|all[\s-]?wheel|four[\s-]?wheel|allrad|4\s?matic|x\s?drive|quattro|4\s?motion|pilnpiedziņ|firehjul/iu;

/** „4x2 (RWD)” / „All-wheel Drive” / „Rear-Wheel Drive” -> piedziņa; nesaprotams teksts -> null. */
export function parseDrivetrainText(raw: string | null | undefined): { awd: boolean } | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (TWO_WD_TEXT_RE.test(t)) return { awd: false };
  if (AWD_TEXT_RE.test(t)) return { awd: true };
  return null;
}

function oneautoPayloadDrive(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const result = (payload as { result?: unknown }).result;
  if (!result || typeof result !== "object") return "";
  const v = (result as Record<string, unknown>).oem_drivetrain_desc;
  return typeof v === "string" ? v : "";
}

/**
 * Piedziņa no ražotāja komplektācijas (OneAuto build sheet / VIN Lookup `oem_drivetrain_desc`, dīlera
 * transportlīdzekļa tabulas lauks „Piedziņa”). Tas ir stiprākais pierādījums: ražotāja dati par ŠO VIN.
 */
export function extractOemDrivetrain(sourceBlocks: WorkspaceSourceBlocks): RegistryDrivetrain | null {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const ar = blocks.auto_records;
  const results = ar.oneautoIngest?.results ?? {};
  const candidates = [
    oneautoPayloadDrive((results as Record<string, { payload?: unknown } | undefined>).oe_build_sheet?.payload),
    oneautoPayloadDrive((results as Record<string, { payload?: unknown } | undefined>).oe_vin_lookup?.payload),
    ar.outvinReport?.vehicleInfo?.drive ?? "",
    ar.outvin?.vehicleInfo?.drive ?? "",
  ];
  for (const c of candidates) {
    const parsed = parseDrivetrainText(c);
    if (parsed) return { drivenAxles: parsed.awd ? 2 : 1, awd: parsed.awd, sourceLabel: OEM_DRIVETRAIN_SOURCE_LABEL };
  }
  return null;
}

/** Transportlīdzekļa piedziņa: ražotāja komplektācija (prioritāte), tad oficiālais reģistrs. */
export function extractVehicleDrivetrain(sourceBlocks: WorkspaceSourceBlocks): RegistryDrivetrain | null {
  return extractOemDrivetrain(sourceBlocks) ?? extractRegistryDrivetrain(sourceBlocks);
}

/**
 * Drošības tīkls pēc AI (Nils 23.11.2026): ja dati saka 2WD, izmet pilnpiedziņas apgalvojumus.
 * Teikumā vispirms izņem pašu marķieri („4MATIC”, „ar pilnpiedziņu”); ja teikums arī tad apgalvo AWD -
 * izmet teikumu. Noliegumu un pretrunas pieminēšanu („neatbilst reģistram”) atstāj.
 */
export function stripAwdClaimsForTwoWheelDrive(text: string, dt: RegistryDrivetrain | null): string {
  if (!dt || dt.awd || !text) return text;
  const MARKER_RE =
    /\s*(?:\bar\s+pilnpiedziņu\b|\bpilnpiedziņas\b(?=\s+(?:sistēm|transmisij))|\b4\s?MATIC\b|\bx\s?Drive\b|\bquattro\b|\b4\s?Motion\b)/giu;
  const lines = text.split(/(\n|<br\s*\/?>)/i);
  return lines
    .map((line) => {
      if (/^(?:\n|<br\s*\/?>)$/i.test(line) || !AWD_CLAIM_RE.test(line)) return line;
      const sentences = line.split(/(?<=[.!?])\s+/);
      return sentences
        .map((s) => {
          if (!AWD_CLAIM_RE.test(s) || AWD_NEGATION_RE.test(s) || /neatbilst|pretrun/i.test(s)) return s;
          const cleaned = s.replace(MARKER_RE, "").replace(/\s{2,}/g, " ");
          return AWD_CLAIM_RE.test(cleaned) ? "" : cleaned;
        })
        .filter((s) => s !== "")
        .join(" ");
    })
    .join("");
}

/** Kanoniskās lapas rinda (AI promptam): reģistra piedziņa ar prioritāti. */
export function formatRegistryDrivetrainFactLine(dt: RegistryDrivetrain, otherSourcesClaimAwd: boolean): string {
  if (dt.sourceLabel === OEM_DRIVETRAIN_SOURCE_LABEL) {
    if (dt.awd) return `Piedziņa (oficiālais avots ${dt.sourceLabel}, prioritāte): pilnpiedziņa (${dt.drivenAxles} dzenošās asis)`;
    return (
      `Piedziņa (oficiālais avots ${dt.sourceLabel}, prioritāte pār reģistru / sludinājumu / modeļa nosaukumu): ${dt.drivenAxles} dzenošā ass - NAV pilnpiedziņa; ` +
      "aizliegts rakstīt 4MATIC / xDrive / quattro / 4Motion / AWD / 4x4 / pilnpiedziņa" +
      (otherSourcesClaimAwd
        ? ". PRETRUNA: cits avots (piem. reģistra modeļa nosaukums) min pilnpiedziņu - tekstā drīkst minēt tikai kā neatbilstību ražotāja datiem"
        : "")
    );
  }
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
      message: `${dt.sourceLabel === OEM_DRIVETRAIN_SOURCE_LABEL ? "Ražotāja komplektācija" : "Oficiālais reģistrs"} (${dt.sourceLabel}) saka ${dt.drivenAxles} dzenošā ass (nav pilnpiedziņa), teksts apgalvo pilnpiedziņu (4MATIC / 4Motion / AWD).`,
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
