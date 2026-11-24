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
import { archiveFieldGetter } from "@/lib/auction-archive-facts";
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

/**
 * Ražotāja kataloga avota nosaukums (OneAuto OE VIN Lookup / build sheet, Outvin `drive`).
 * 24.11 (Volvo XC90 2.4D AWD): OneAuto `oem_drivetrain_desc` = „Front-Wheel Drive” bija kataloga tips,
 * nevis ŠĪ auto komplektācija (rūpnīcas kodi AG02 „POWER TRAIN AWD”, K03 Haldex). Tāpēc katalogs ir
 * zemākā ticamība, nevis „oficiālā dīlera dati”. Bez komatiem - faktu lapas rindu lasa regex.
 */
export const OEM_DRIVETRAIN_SOURCE_LABEL = "ražotāja katalogs (OneAuto)";
/** OneAuto aprīkojuma produkts (build sheet) - nopirkts šim pasūtījumam, rūpnīcas dati par ŠO VIN. */
export const ONEAUTO_BUILD_SHEET_LABEL = "OneAuto aprīkojums (build sheet)";

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

/* ---------- 24.11: piedziņa no VISIEM avotiem ar ticamības līmeņiem ---------- */

/**
 * Ticamība (augstākā pirmā): rūpnīcas opciju kodi (CarVertical / AutoDNA / dīlera aprīkojuma kodi) >
 * oficiālais reģistrs (CSDD piedziņas lauka nav; Dānijas DMR) > CarVertical / AutoDNA specifikācija >
 * izsoles > ražotāja katalogs (OneAuto OE VIN Lookup / Outvin `drive`).
 */
export type DrivetrainTier = "factory_codes" | "registry" | "vendor_spec" | "auction" | "oem_catalog";

const TIER_RANK: Record<DrivetrainTier, number> = {
  factory_codes: 0,
  registry: 1,
  vendor_spec: 2,
  auction: 3,
  oem_catalog: 4,
};

/** Rūpnīcas kodi un reģistrs - spriedums paliek arī tad, ja zemākas ticamības avoti runā pretī. */
const STRONG_TIERS: ReadonlySet<DrivetrainTier> = new Set(["factory_codes", "registry"]);

export const DRIVETRAIN_TIER_LABEL_LV: Record<DrivetrainTier, string> = {
  factory_codes: "rūpnīcas opciju kodi",
  registry: "oficiālais reģistrs",
  vendor_spec: "specifikācija",
  auction: "izsoles dati",
  oem_catalog: "ražotāja katalogs",
};

export type DrivetrainEvidence = {
  tier: DrivetrainTier;
  /** Avota nosaukums atskaitē (bez komatiem). */
  source: string;
  awd: boolean;
  /** Teksta fragments, no kura nolasīts (tikai tehnisks, bez personas datiem). */
  detail: string;
};

export type DrivetrainResolution = {
  /** null = nav datu vai avoti runā pretī tā, ka piedziņu nevar noteikt. */
  drivetrain: RegistryDrivetrain | null;
  tier: DrivetrainTier | null;
  evidence: DrivetrainEvidence[];
  /** Vismaz divi avoti saka atšķirīgu piedziņu. */
  conflict: boolean;
  /** Pretrunā ir tikai ražotāja katalogs (OneAuto bez aprīkojuma / Outvin) - dabiska atšķirība. */
  conflictOnlyCatalog: boolean;
  /** Tikai katalogs: piedziņa „pēc kataloga, nav apstiprināta” - nekad neizraisa aizliegumu / dzēšanu. */
  catalogHint: { awd: boolean; source: string } | null;
};

/** Pilnpiedziņas marķieri rūpnīcas / specifikācijas tekstā (angļu, vācu, LV, ražotāju nosaukumi). */
const SPEC_AWD_RES: RegExp[] = [
  /\b(?:awd|4wd)(?![a-z])/i,
  /all[\s-]?wheel[\s-]?drive|four[\s-]?wheel[\s-]?drive|\b4[\s-]wheel[\s-]drive|allradantrieb|\ballrad\b/i,
  /haldex/i,
  /\bx\s?drive/i,
  /\b4[\s-]?matic/i,
  /\b4\s?motion/i,
  /\bquattro\b/i,
  /\b4x4\b/i,
  /pilnpiedziņ|visu\s+riteņu\s+piedziņ/iu,
];
const SPEC_2WD_RES: RegExp[] = [
  /front[\s-]?wheel[\s-]?drive|rear[\s-]?wheel[\s-]?drive|frontantrieb|hinterradantrieb/i,
  /\b(?:fwd|rwd|2wd)(?![a-z])/i,
  /\b4x2\b/i,
  /\bs\s?drive\s?\d/i,
  /priekšēj\p{L}*\s+(?:riteņu\s+)?piedziņ|aizmugurēj\p{L}*\s+(?:riteņu\s+)?piedziņ|priekšpiedziņ|aizmugurpiedziņ/iu,
];
/**
 * Rindas, kas piedziņu NEAPRAKSTA: „Quattro GmbH” riteņi / riepas, „quattro” plāksnītes (Audi 2Z* - var būt
 * arī tikai tipa zīme), modeļu saraksti ar gadu diapazonu („ID.4 Pro 4MOTION (2021 - 2024)” - līdzīgie modeļi),
 * apkopes grafiks („Haldex eļļa” - visa modeļa grafiks, ne šī auto).
 */
const SPEC_IGNORE_LINE_RE =
  /gmbh|nameplate|plāksnīt|type\s+sign|tipa\s+zīm|\(\s*\d{4}\s*[-–]\s*\d{4}\s*\)|eļļ\p{L}*\s*\(|iztukšot|uzpildīt/iu;
/** Rūpnīcas opciju koda rinda: „AG02POWER TRAIN AWD”, „1X2Four wheel drive”, „DB20Gear box”. */
const FACTORY_CODE_LINE_RE = /(?:^|[^A-Za-z0-9])(?=[A-Z0-9]*\d)[A-Z0-9]{3,5}(?=[A-Z][A-Za-z]{2})/;

const BRAND_DRIVE_WORD_RE = /\b4[\s-]?matic\b|\b4\s?motion\b|\bx\s?drive\w*|\bs\s?drive\w*|\bquattro\b/gi;

/** Vienas rindas spriedums: true = AWD, false = 2WD, null = nav vai abi („2wd and 4wd”). */
export function drivetrainFromSpecLine(line: string): boolean | null {
  const t = (line ?? "").trim();
  if (!t || t.length > 400 || SPEC_IGNORE_LINE_RE.test(t)) return null;
  const awd = SPEC_AWD_RES.some((re) => re.test(t));
  const twoWd = SPEC_2WD_RES.some((re) => re.test(t));
  if (awd === twoWd) return null;
  return awd;
}

function pushTextEvidence(
  out: DrivetrainEvidence[],
  text: string,
  vendor: string,
  opts: { codeLinesOnly?: boolean } = {},
): void {
  for (const line of (text ?? "").split(/\r?\n/)) {
    const v = drivetrainFromSpecLine(line);
    if (v == null) continue;
    // „4MATIC” / „4MOTION” pašas izskatās pēc koda + apraksta - pirms koda pārbaudes izņem.
    const isCode = opts.codeLinesOnly === true || FACTORY_CODE_LINE_RE.test(line.replace(BRAND_DRIVE_WORD_RE, " "));
    out.push({
      tier: isCode ? "factory_codes" : "vendor_spec",
      source: isCode ? `${vendor} rūpnīcas kodi` : `${vendor} specifikācija`,
      awd: v,
      detail: line.trim().slice(0, 160),
    });
  }
}

/** Izsoles ieraksta piedziņa (TheCarApi lauki). */
export function auctionLotDrivetrain(get: { tail: (...names: string[]) => string }): boolean | null {
  const awdRaw = get.tail("isfourwheeldrive");
  if (/^(yes|true|1|jā)$/i.test(awdRaw)) return true;
  if (/^(no|false|0|nē)$/i.test(awdRaw)) return false;
  const driveRaw = get.tail("drive", "drivetrain", "drivetype");
  if (/4x4|awd|4wd|all|allrad|quattro|xdrive|4matic|4motion/i.test(driveRaw)) return true;
  if (/front|rear|fwd|rwd|2wd|4x2|vorder|hinter/i.test(driveRaw)) return false;
  return null;
}

/** Visi piedziņas pierādījumi no ielādētajiem avotiem (bez AI komentāriem un operatora piezīmēm). */
export function collectDrivetrainEvidence(sourceBlocks: WorkspaceSourceBlocks): DrivetrainEvidence[] {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const out: DrivetrainEvidence[] = [];

  // 1) CarVertical / AutoDNA RAW: rūpnīcas kodu rindas un specifikācija.
  pushTextEvidence(out, blocks.carvertical?.aiContextRaw ?? "", SOURCE_BLOCK_LABELS.carvertical);
  pushTextEvidence(out, blocks.autodna?.aiContextRaw ?? "", SOURCE_BLOCK_LABELS.autodna);
  // Dīlera aprīkojuma kodi (kods + apraksts) - arī rūpnīcas kodi.
  const ar = blocks.auto_records;
  const equipLines = [...(ar.outvinReport?.equipment ?? []), ...(ar.outvin?.equipment ?? [])]
    .map((e) => (e && typeof e === "object" ? `${(e as { code?: string }).code ?? ""} ${(e as { description?: string }).description ?? ""}` : ""))
    .filter((l) => l.trim());
  pushTextEvidence(out, equipLines.join("\n"), "Dīlera aprīkojuma", { codeLinesOnly: true });

  // 2) Oficiālais reģistrs (Dānijas DMR). CSDD piedziņas lauku nedod; modeļa nosaukumu („4MATIC”) neņem.
  const reg = extractRegistryDrivetrain(blocks);
  if (reg) out.push({ tier: "registry", source: reg.sourceLabel, awd: reg.awd, detail: `${reg.drivenAxles} dzenošās asis` });

  // 4) Izsoles (TheCarApi).
  for (const r of blocks.cc_vin?.thecarapiRecords ?? []) {
    const v = auctionLotDrivetrain(archiveFieldGetter(r));
    if (v == null) continue;
    out.push({ tier: "auction", source: (r.site || r.venue || "Izsole").trim().replace(/,/g, " "), awd: v, detail: "" });
  }

  // 5) Ražotāja katalogs: OneAuto OE VIN Lookup / build sheet, Outvin `drive` (bieži OneAuto kopija).
  const results = (ar.oneautoIngest?.results ?? {}) as Record<string, { payload?: unknown } | undefined>;
  // Nils 24.11: OneAuto aprīkojumu (build sheet) bieži nepērkam - bez tā VIN Lookup piedziņa ir vispārīgā
  // kataloga tips (piem. «XC90 I (275) D5»), ne šī auto komplektācija. Nopirkts build sheet = rūpnīcas dati.
  const buildSheetDrive = parseDrivetrainText(oneautoPayloadDrive(results.oe_build_sheet?.payload));
  if (buildSheetDrive) {
    out.push({
      tier: "factory_codes",
      source: ONEAUTO_BUILD_SHEET_LABEL,
      awd: buildSheetDrive.awd,
      detail: oneautoPayloadDrive(results.oe_build_sheet?.payload).trim().slice(0, 80),
    });
  }
  const catalog: { source: string; raw: string }[] = [
    { source: OEM_DRIVETRAIN_SOURCE_LABEL, raw: oneautoPayloadDrive(results.oe_vin_lookup?.payload) },
    { source: "ražotāja katalogs (Outvin)", raw: ar.outvinReport?.vehicleInfo?.drive ?? "" },
    { source: "ražotāja katalogs (Outvin)", raw: ar.outvin?.vehicleInfo?.drive ?? "" },
  ];
  for (const c of catalog) {
    const parsed = parseDrivetrainText(c.raw);
    if (parsed) out.push({ tier: "oem_catalog", source: c.source, awd: parsed.awd, detail: c.raw.trim().slice(0, 80) });
  }
  return out;
}

function tierVerdict(evidence: readonly DrivetrainEvidence[], tier: DrivetrainTier): boolean | "mixed" | null {
  const vals = new Set(evidence.filter((e) => e.tier === tier).map((e) => e.awd));
  if (vals.size === 0) return null;
  if (vals.size > 1) return "mixed";
  return [...vals][0]!;
}

/**
 * Piedziņa no visiem avotiem. Augstākās ticamības līmenis ar viennozīmīgu spriedumu nosaka rezultātu:
 * - rūpnīcas kodi / reģistrs: spriedums paliek, zemākie avoti pretī - tikai `conflict` (brīdinājums);
 *   ja rūpnīcas kodi un reģistrs savā starpā nesakrīt vai līmenī ir abi varianti - null;
 * - specifikācija / izsoles: spriedums tikai tad, ja šie avoti savā starpā sakrīt; citādi null;
 * - ražotāja katalogs (OneAuto VIN Lookup bez aprīkojuma, Outvin) piedziņu NEKAD nenosaka (Nils 24.11) -
 *   tikai `catalogHint` faktu lapai („pēc kataloga, nav apstiprināts”).
 */
export function resolveVehicleDrivetrain(sourceBlocks: WorkspaceSourceBlocks): DrivetrainResolution {
  const evidence = collectDrivetrainEvidence(sourceBlocks);
  const conflict = new Set(evidence.map((e) => e.awd)).size > 1;
  const nonCatalog = evidence.filter((e) => e.tier !== "oem_catalog");
  const conflictOnlyCatalog = conflict && new Set(nonCatalog.map((e) => e.awd)).size <= 1;
  const catalogVerdict = tierVerdict(evidence, "oem_catalog");
  const catalogHint =
    nonCatalog.length === 0 && typeof catalogVerdict === "boolean"
      ? { awd: catalogVerdict, source: evidence.find((e) => e.tier === "oem_catalog")!.source }
      : null;
  const empty: DrivetrainResolution = { drivetrain: null, tier: null, evidence, conflict, conflictOnlyCatalog, catalogHint };
  if (nonCatalog.length === 0) return empty;
  const tiers = (Object.keys(TIER_RANK) as DrivetrainTier[])
    .filter((t) => t !== "oem_catalog")
    .sort((a, b) => TIER_RANK[a] - TIER_RANK[b]);
  const top = tiers.find((t) => tierVerdict(evidence, t) != null);
  if (!top) return empty;
  const verdict = tierVerdict(evidence, top);
  if (verdict === "mixed" || verdict == null) return empty;
  if (STRONG_TIERS.has(top)) {
    for (const t of STRONG_TIERS) {
      const v = tierVerdict(evidence, t);
      if (v != null && v !== verdict) return empty;
    }
  } else if (new Set(nonCatalog.map((e) => e.awd)).size > 1) {
    // Specifikācija / izsoles savstarpēji nesakrīt - nezināms. Katalogs vājos avotus neapgāž.
    return empty;
  }
  const first = evidence.find((e) => e.tier === top && e.awd === verdict)!;
  return {
    drivetrain: { drivenAxles: verdict ? 2 : 1, awd: verdict, sourceLabel: first.source },
    tier: top,
    evidence,
    conflict,
    conflictOnlyCatalog,
    catalogHint: null,
  };
}

/**
 * Tikai ražotāja katalogs (OneAuto / Outvin). Zemākā ticamība - lēmumiem lieto `extractVehicleDrivetrain`.
 */
export function extractOemDrivetrain(sourceBlocks: WorkspaceSourceBlocks): RegistryDrivetrain | null {
  const cat = collectDrivetrainEvidence(sourceBlocks).filter((e) => e.tier === "oem_catalog");
  if (cat.length === 0 || new Set(cat.map((e) => e.awd)).size > 1) return null;
  const awd = cat[0]!.awd;
  return { drivenAxles: awd ? 2 : 1, awd, sourceLabel: cat[0]!.source };
}

/** Transportlīdzekļa piedziņa no visiem avotiem (sk. `resolveVehicleDrivetrain`); null = nezināma. */
export function extractVehicleDrivetrain(sourceBlocks: WorkspaceSourceBlocks): RegistryDrivetrain | null {
  return resolveVehicleDrivetrain(sourceBlocks).drivetrain;
}

/** Vai piedziņas avots ir oficiālais reģistrs (DMR u.c.), nevis rūpnīcas kodi / katalogs. */
function isRegistrySource(label: string): boolean {
  return label === SOURCE_BLOCK_LABELS.tjekbil;
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

/** Faktu lapas rinda, ja piedziņa zināma tikai no kataloga - bez aizlieguma. */
export function formatCatalogDrivetrainHintLine(hint: { awd: boolean; source: string }): string {
  return `Piedziņa pēc ${hint.source} - nav apstiprināta (vispārīgs kataloga tips; aprīkojuma dati nav pirkti): ${hint.awd ? "pilnpiedziņa" : "viena ass"}. Neraksti kā faktu; ja citi dati min citu piedziņu - nepretrunā.`;
}

/** Kanoniskās lapas rinda (AI promptam): piedziņa ar avotu un prioritāti. */
export function formatRegistryDrivetrainFactLine(dt: RegistryDrivetrain, otherSourcesClaimAwd: boolean): string {
  const head = isRegistrySource(dt.sourceLabel)
    ? `Piedziņa (oficiālais reģistrs ${dt.sourceLabel}, prioritāte pār sludinājumu / car.info)`
    : `Piedziņa (avots ${dt.sourceLabel}, prioritāte pār zemākas ticamības avotiem)`;
  if (dt.awd) return `${head}: pilnpiedziņa (${dt.drivenAxles} dzenošās asis)`;
  return (
    `${head}: ${dt.drivenAxles} dzenošā ass - NAV pilnpiedziņa; ` +
    "aizliegts rakstīt 4Motion / quattro / xDrive / 4MATIC / AWD / 4x4 / Haldex riskus" +
    (otherSourcesClaimAwd
      ? ". PRETRUNA: sludinājums / citi avoti min pilnpiedziņu - tekstā drīkst minēt tikai kā neatbilstību šim avotam"
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
      message: `${isRegistrySource(dt.sourceLabel) ? "Oficiālais reģistrs" : "Piedziņas avots"} (${dt.sourceLabel}) saka ${dt.drivenAxles} dzenošā ass (nav pilnpiedziņa), teksts apgalvo pilnpiedziņu (4MATIC / 4Motion / AWD).`,
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
