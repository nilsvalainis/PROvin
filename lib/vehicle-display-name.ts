/**
 * Viena modeļa nosaukuma noteikšanas kārtība visām vietām (Nils 23.11.2026): PDF galvene, kopsavilkuma
 * karte, galvenes / kājenes josla, dīlera tabula „Transportlīdzekļa informācija”, AI fakti.
 *
 * Prioritāte:
 *   1) operatora adminā ar roku labotā vērtība (vienmēr uzvar);
 *   2) CSDD marka / modelis (auto ir LV reģistrā);
 *   3) citi reģistri / VIN SCAN avoti ar konkrētu modeli (Dānijas DMR u.c.);
 *   4) OneAuto VIN Lookup `oem_vehicle_desc` / `vehicle_desc`, dīlera API modelis - pēdējais;
 *   5) sludinājums / LTAB (tikai, ja nekā cita nav).
 * Nekad tikai marka, ja kādā avotā ir modelis. Pilnpiedziņas marķieri (4MATIC, xDrive, quattro, 4Motion)
 * nosaukumā izmet, ja ražotāja komplektācija skaidri saka 2WD (4x2 / RWD / FWD) - nekādu minējumu.
 */
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { extractOemDrivetrain } from "@/lib/registry-drivetrain";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";

export type VehicleNameCandidate = { value: string | null | undefined; source: VehicleNameSource };

export type VehicleNameSource = "manual" | "csdd" | "registry" | "dealer_api" | "fallback";

const MAKE_ONLY_RE =
  /^(?:mercedes(?:[\s-]+benz)?|bmw|audi|volkswagen|vw|skoda|škoda|seat|cupra|porsche|opel|ford|volvo|toyota|lexus|nissan|honda|mazda|hyundai|kia|peugeot|citro[eë]n|ds|renault|dacia|fiat|alfa\s+romeo|jeep|land\s+rover|range\s+rover|jaguar|mini|tesla|subaru|suzuki|mitsubishi|smart|chevrolet|dodge|chrysler|cadillac|infiniti|genesis|polestar|lynx|lynk\s*&\s*co|mg|byd|iveco|man|saab)$/iu;

const AWD_NAME_MARKER_RE = /\s*\b(?:4\s?matic\+?|x\s?drive|quattro|4\s?motion|all4|awd|4x4|4wd)\b/giu;

function clean(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

/** „MERCEDES-BENZ”, „Mercedes Benz”, „BMW” - tikai marka bez modeļa. */
export function isMakeOnlyVehicleName(raw: string | null | undefined): boolean {
  const t = clean(raw);
  return t.length > 0 && MAKE_ONLY_RE.test(t);
}

/**
 * Izvēlas nosaukumu pēc prioritātes. Kandidāts, kas ir tikai marka, uzvar tikai tad, ja nevienā
 * citā avotā nav modeļa.
 */
export function pickVehicleDisplayName(
  candidates: readonly VehicleNameCandidate[],
  opts?: { twoWheelDrive?: boolean },
): { name: string; source: VehicleNameSource | null } {
  const filled = candidates
    .map((c) => ({ name: clean(c.value), source: c.source }))
    .filter((c) => c.name.length >= 2);
  const withModel = filled.find((c) => !isMakeOnlyVehicleName(c.name));
  const pick = withModel ?? filled[0] ?? null;
  if (!pick) return { name: "", source: null };
  let name = pick.name;
  // Operatora labojumu neaiztiekam; citiem avotiem 2WD auto nedrīkst nest pilnpiedziņas marķieri.
  if (opts?.twoWheelDrive && pick.source !== "manual") {
    const stripped = clean(name.replace(AWD_NAME_MARKER_RE, ""));
    if (stripped.length >= 2) name = stripped;
  }
  return { name, source: pick.source };
}

function oneautoVinLookupName(results: unknown): string {
  if (!results || typeof results !== "object") return "";
  const lookup = (results as Record<string, { payload?: unknown } | undefined>).oe_vin_lookup?.payload;
  if (!lookup || typeof lookup !== "object") return "";
  const r = (lookup as { result?: unknown }).result;
  if (!r || typeof r !== "object") return "";
  const o = r as Record<string, unknown>;
  for (const key of ["oem_vehicle_desc", "vehicle_desc"]) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Dānijas DMR (tjekbil RAW): marka + modelis + variants, piem. „MERCEDES-BENZ E-Klasse 300 de Stationcar”. */
export function dmrVehicleName(raw: string | null | undefined): string {
  const t = raw ?? "";
  if (!t.trim()) return "";
  const pick = (key: string) => t.match(new RegExp(`"${key}"\\s*:\\s*"([^"]{1,80})"`))?.[1]?.trim() ?? "";
  const make = pick("maerkeTypeNavn");
  const model = pick("modelTypeNavn");
  const variant = pick("variantTypeNavn").replace(/\s*\b\d{1,2}G-TRONIC\b/i, "").trim();
  if (!make || !model) return "";
  return clean([make, model, variant].filter(Boolean).join(" "));
}

/**
 * Operatora labotais modelis: dīlera tabulas lauks adminā (`outvinReport`), ja tas atšķiras no API
 * vērtības (`outvin`). Ja abi vienādi - tas ir API dati, ne labojums.
 */
export function manualDealerModel(sourceBlocks: WorkspaceSourceBlocks): string {
  const ar = mergeSourceBlocksWithDefaults(sourceBlocks).auto_records;
  const edited = clean(ar.outvinReport?.vehicleInfo?.model);
  if (!edited) return "";
  const api = clean(ar.outvin?.vehicleInfo?.model);
  if (!api) return "";
  return edited.toLocaleLowerCase("lv") === api.toLocaleLowerCase("lv") ? "" : edited;
}

export type VehicleDisplayNameExtras = {
  csddMakeModel?: string | null;
  /** Fallback avoti (sludinājums, LTAB, CSDD RAW teksts), secībā. */
  fallbacks?: readonly (string | null | undefined)[];
};

/** Kandidāti no darba lapas avotu blokiem pēc Nila kārtības. */
export function vehicleNameCandidatesFromBlocks(
  sourceBlocks: WorkspaceSourceBlocks,
  extras: VehicleDisplayNameExtras = {},
): VehicleNameCandidate[] {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const ar = blocks.auto_records;
  const csdd = clean(extras.csddMakeModel) || clean(blocks.csdd?.makeModel);
  const bundleModel = clean(getAutoRecordsOutvinBundle(ar).vehicleInfo.model);
  return [
    { value: manualDealerModel(blocks), source: "manual" },
    { value: csdd, source: "csdd" },
    { value: dmrVehicleName(blocks.tjekbil?.rawUnprocessedData), source: "registry" },
    { value: oneautoVinLookupName(ar.oneautoIngest?.results), source: "dealer_api" },
    { value: bundleModel, source: "dealer_api" },
    { value: clean(ar.outvinReport?.vehicleInfo?.model), source: "dealer_api" },
    ...(extras.fallbacks ?? []).map((value) => ({ value, source: "fallback" as const })),
  ];
}

/** Viens modeļa nosaukums visām atskaites vietām. */
export function resolveVehicleDisplayName(
  sourceBlocks: WorkspaceSourceBlocks,
  extras: VehicleDisplayNameExtras = {},
): string {
  const oem = extractOemDrivetrain(sourceBlocks);
  return pickVehicleDisplayName(vehicleNameCandidatesFromBlocks(sourceBlocks, extras), {
    twoWheelDrive: oem ? !oem.awd : false,
  }).name;
}

/** „E220” pret „E 300 de”: tā pati klase (burti), cits numurs - sērija ir pretrunā modelim. */
export function modelSeriesContradictsName(series: string | null | undefined, name: string | null | undefined): boolean {
  const s = clean(series).match(/^([a-z]{1,3})[\s-]?(\d{2,3})[a-z]{0,3}$/i);
  if (!s) return false;
  const cls = s[1]!.toLowerCase();
  const num = s[2]!;
  const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${cls}[\\s-]?(\\d{2,3})(?![\\p{N}])`, "giu");
  const nums = [...clean(name).toLowerCase().matchAll(re)].map((m) => m[1]!);
  return nums.length > 0 && !nums.includes(num);
}

/**
 * Dīlera tabulas / vāka transportlīdzekļa dati attēlošanai: „Modelis” = vienotais nosaukums (ja tas nav tikai
 * marka); „Modeļa sērija”, kas runā pretī modelim (OneAuto „E220” pie E 300 de), netiek rādīta - bez minējuma.
 */
export function dealerVehicleInfoForDisplay<T extends { model: string; modelSeries: string }>(
  vi: T,
  displayName: string | null | undefined,
): T {
  const name = clean(displayName);
  const model = name && !isMakeOnlyVehicleName(name) ? name : vi.model;
  const modelSeries = modelSeriesContradictsName(vi.modelSeries, model) ? "" : vi.modelSeries;
  if (model === vi.model && modelSeries === vi.modelSeries) return vi;
  return { ...vi, model, modelSeries };
}
