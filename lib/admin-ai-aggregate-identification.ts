/**
 * Agregātu identifikācijas kopsavilkums ✨ promptam — jau izgūtie tehniskie parametri vienā vietā,
 * lai modelis varētu izsecināt visticamāko dzinēja / ātrumkārbas / piedziņas salikumu un kalibrēt
 * riskus pret aptuveno nobraukumu un vecumu (skat. AI_POWERTRAIN_IDENTIFICATION_RULES).
 */
import { extractVehicleReportFingerprint } from "@/lib/admin-vehicle-report-fingerprint";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import {
  outvinEquipmentLineHasData,
  type OutvinEquipmentLine,
} from "@/lib/outvin-dealer-types";
import {
  mergeSourceBlocksWithDefaults,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  collectUnifiedMileageRows,
  parseMileageDateForSort,
  parseOdometerKm,
} from "@/lib/unified-mileage";

export type AggregateIdentificationInput = {
  sourceBlocks: WorkspaceSourceBlocks;
  vin?: string | null;
  manufactureYear?: number | null;
  /** Testējamībai — noklusējums ir šodienas gads. */
  nowYear?: number;
};

type LatestOdometer = { km: number; date: string; sourceLabel: string } | null;

function latestOdometerReading(blocks: WorkspaceSourceBlocks): LatestOdometer {
  const rows = collectUnifiedMileageRows({
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    oneautoBlock: blocks.oneauto,
    ccVinBlock: blocks.cc_vin,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    citiAvotiBlock: blocks.citi_avoti,
    tirgusForm: blocks.tirgus,
  });
  let best: LatestOdometer = null;
  let bestTime = Number.NEGATIVE_INFINITY;
  let bestKm = -1;
  for (const row of rows) {
    const km = parseOdometerKm(row.odometer);
    if (km == null) continue;
    const time = parseMileageDateForSort(row.date);
    const newer = Number.isFinite(time) && time > bestTime;
    const sameTimeHigherKm = time === bestTime && km > bestKm;
    if (best == null || newer || sameTimeHigherKm) {
      best = { km, date: row.date, sourceLabel: row.sourceLabel };
      bestTime = Number.isFinite(time) ? time : bestTime;
      bestKm = km;
    }
  }
  return best;
}

function formatKm(km: number): string {
  return `${km.toLocaleString("lv-LV").replace(/\u00a0/g, " ")} km`;
}

const EXPENSIVE_AGE_OPTION_RE =
  /active.?steer|aktivlenkung|dynamic.?drive|adaptive.?drive|soft.?close|logic.?7|airmatic|magnetic.?ride|magneride|night.?vision|nightvision|distronic|luftfeder|pneimatisk|air.?suspension|abc.?sport|xdrive|4matic/i;

const EQUIPMENT_LINE_CAP = 24;

function collectEquipmentLines(blocks: WorkspaceSourceBlocks, vin?: string | null): OutvinEquipmentLine[] {
  const seen = new Set<string>();
  const out: OutvinEquipmentLine[] = [];
  const push = (line: OutvinEquipmentLine) => {
    if (!outvinEquipmentLineHasData(line)) return;
    const key = `${line.code.trim().toUpperCase()}|${line.description.trim().toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ code: line.code.trim(), description: line.description.trim() });
  };
  const report = blocks.auto_records.outvinReport;
  for (const line of report?.equipment ?? []) push(line);
  const bundle = getAutoRecordsOutvinBundle(blocks.auto_records, vin ?? "");
  for (const line of bundle.equipment ?? []) push(line);
  return out;
}

function formatDriveHint(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const u = t.toUpperCase();
  if (/HECK|RWD|REAR/.test(u)) return `${t} (aizmugures piedziņa)`;
  if (/ALLRAD|AWD|4WD|XDRIVE|4MATIC|QUATTRO/.test(u)) return `${t} (pilnpiedziņa)`;
  if (/FRONT|FWD|VORNE/.test(u)) return `${t} (priekšējā piedziņa)`;
  return t;
}

function formatEquipmentBrief(lines: OutvinEquipmentLine[]): string[] {
  if (lines.length === 0) {
    return [
      "- Aprīkojuma SA saraksts: nav / nepilnīgs — dārgā ekstraprīkojuma neesamību nedrīkst apgalvot; vispirms meklē šīs paaudzes tipiskos slazdus un pārbaudi pret dīlera datiem.",
    ];
  }
  const shown = lines.slice(0, EQUIPMENT_LINE_CAP);
  const extra = lines.length - shown.length;
  const listed = shown.map((l) => (l.code && l.description ? `${l.code} — ${l.description}` : l.code || l.description));
  const hits = lines.filter((l) => EXPENSIVE_AGE_OPTION_RE.test(`${l.code} ${l.description}`));
  const out = [
    `- Aprīkojums (dīleris, ${lines.length} poz.): ${listed.join("; ")}${extra > 0 ? `; … un vēl ${extra}` : ""}`,
  ];
  if (hits.length > 0) {
    out.push(
      `- Dārgas vecuma pozīcijas sarakstā: ${hits.map((l) => l.description || l.code).join("; ")}`,
    );
  } else if (lines.length >= 6) {
    out.push(
      "- Šie dārgie vecuma slazdi sarakstā NAV minēti (pārbaudīt, ja saraksts var būt nepilnīgs): Active Steering, Dynamic Drive, Soft Close, Logic 7, Airmatic, Magnetic Ride, Night Vision.",
    );
  }
  return out;
}

/** Orientējošs km/gadā — noapaļots, lai neizskatītos precīzāks, nekā ir. */
function averageKmPerYear(km: number, years: number): number | null {
  if (years < 1) return null;
  return Math.round(km / years / 500) * 500;
}

/**
 * Kompakts „### Agregātu identifikācijas dati” bloks ✨ promptam.
 * Tukša virkne, ja par agregātu nav nekādu izejas datu.
 */
export function buildAggregateIdentificationBrief(input: AggregateIdentificationInput): string {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const fp = extractVehicleReportFingerprint(blocks, {
    vin: input.vin,
    manufactureYear: input.manufactureYear,
  });
  const nowYear = input.nowYear ?? new Date().getFullYear();

  const lines: string[] = [];
  if (fp.makeModel) lines.push(`- Marka / modelis: ${fp.makeModel}`);
  if (fp.year != null) {
    const age = nowYear - fp.year;
    lines.push(
      `- Pirmā reģistrācija / izlaiduma gads: ${fp.year}${age >= 1 ? ` (vecums ~${age} gadi)` : ""}`,
    );
  }
  if (fp.fuelType) lines.push(`- Degvielas veids: ${fp.fuelType}`);
  if (fp.engineDisplacementCm3) lines.push(`- Darba tilpums: ${fp.engineDisplacementCm3} cm³`);
  if (fp.enginePowerKw) {
    const kw = Number.parseFloat(fp.enginePowerKw);
    const hp = Number.isFinite(kw) ? ` (~${Math.round(kw * 1.36)} zs)` : "";
    lines.push(`- Jauda: ${fp.enginePowerKw} kW${hp}`);
  }
  if (fp.emissionStandard) lines.push(`- Izmešu klase: ${fp.emissionStandard}`);
  if (fp.engineCode) lines.push(`- Dzinēja kods (dīlera / Outvin dati): ${fp.engineCode}`);
  if (fp.typeCode) lines.push(`- Tipa kods: ${fp.typeCode}`);
  const vi = blocks.auto_records.outvinReport?.vehicleInfo;
  const bundleVi = getAutoRecordsOutvinBundle(blocks.auto_records, input.vin ?? "").vehicleInfo;
  const drive = (vi?.drive || bundleVi.drive || "").trim();
  const body = (vi?.body || bundleVi.body || "").trim();
  const development = (vi?.developmentCode || bundleVi.developmentCode || "").trim();
  if (drive) lines.push(`- Piedziņa (dīleris): ${formatDriveHint(drive)}`);
  if (body) lines.push(`- Virsbūve (dīleris): ${body}`);
  if (development) lines.push(`- Izstrādes kods / šasija: ${development}`);
  if (fp.transmission === "auto") lines.push("- Ātrumkārba pēc avotiem: automātiskā (precīzs tips jāizsecina)");
  else if (fp.transmission === "manual") lines.push("- Ātrumkārba pēc avotiem: mehāniskā");
  const equipment = collectEquipmentLines(blocks, input.vin);
  if (equipment.length > 0 || lines.length > 0) {
    lines.push(...formatEquipmentBrief(equipment));
  }

  const latest = latestOdometerReading(blocks);
  if (latest) {
    const meta = [latest.date, latest.sourceLabel].filter(Boolean).join(", ");
    lines.push(`- Jaunākais nobraukuma ieraksts: ${formatKm(latest.km)}${meta ? ` (${meta})` : ""}`);
    if (fp.year != null) {
      const avg = averageKmPerYear(latest.km, nowYear - fp.year);
      if (avg != null) lines.push(`- Orientējoši ~${formatKm(avg)}/gadā (jaunākais ieraksts pret vecumu)`);
    }
  }

  if (lines.length === 0) return "";

  return `### Agregātu identifikācijas dati (izejas parametri — izsecinātu kodu nekad neraksti kā reģistrā nolasītu faktu)
${lines.join("\n")}

Ar šiem parametriem nosaki visticamāko dzinēja konstrukciju / kodu (vai 1–2 kandidātus), ātrumkārbas tipu un piedziņu, tad kalibrē riskus pret šo nobraukuma un vecuma posmu. Ja parametri pieļauj vairākas konstrukcijas ar būtiski atšķirīgu risku, to pasaki un norādi, kā apstiprināt. Ja šis agregāts nav paketē — vispirms meklē Eiropas forumos / speciālistu rakstos, tad raksti.`;
}
