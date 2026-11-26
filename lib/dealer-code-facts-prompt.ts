/**
 * OFICIĀLĀ DĪLERA DATI: „Koda faktu saraksts” AI komentāriem (Nils 22.11.2026).
 * Visi skaitļi ir tie paši, ko drukā PDF (kopsavilkums, eļļas tabula, lielie darbi, odometra atzīmes),
 * lai AI tekstam un tabulām nekad nebūtu divu dažādu skaitļu. Tikai fakti, bez secinājumiem.
 */
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { formatServiceWorkOdometer, type AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { findDealerOdometerDrops, findDealerOdometerOutliers } from "@/lib/dealer-odometer-checks";
import { isGearboxOilChangeWork } from "@/lib/dealer-major-works";
import { buildOilIntervalSeriesForBlock } from "@/lib/oil-change-interval-chart";
import { formatOilStepRangeFactLine } from "@/lib/oil-change-intervals";
import { printableDealerServiceWorks } from "@/lib/pdf-dealer-service-visits";
import { buildDealerVisitSummary } from "@/lib/pdf-dealer-timeline";
import { detectDealerTaxiSignals } from "@/lib/dealer-review-score";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { extractVehicleDrivetrain, formatRegistryDrivetrainFactLine } from "@/lib/registry-drivetrain";
import { resolveVehicleDisplayName } from "@/lib/vehicle-display-name";

function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function kmLabel(odometer: string): string {
  return formatServiceWorkOdometer(odometer) || "km nav";
}

/**
 * Pazīmes, ka „service_provider” nav autoserviss (masāžas prakse, ķegļu klubs, biedrība u.tml.).
 * Tikai skaidras ne-auto pazīmes: dīleris ar personas uzvārdu („Albert Bauer GmbH”) NAV atzīmēts.
 */
const NON_WORKSHOP_RE =
  /massage|massagepraxis|therapie|therapeut|physio|praxis\b|spezialpraxis|bindegewebs|arztpraxis|zahnarzt|\bkegel|kegelclub|kegelklub|gut\s+holz|\be\.\s?v\.?(?=\s|,|$)|\bverein\b|sportverein|\bclub\b|\bklub\b|restaurant|gaststätte|hotel|friseur|kosmetik|apotheke|kirche|schule\b|kindergarten/iu;

/** Auto / servisa pazīmes nosaukumā - tad vieta noteikti ir serviss. */
const WORKSHOP_HINT_RE =
  /auto|kfz|car\b|cars\b|motor|garage|werkstatt|workshop|service|servis|reifen|tyre|tire|karosserie|lackier|niederlassung|\bbmw\b|mercedes|benz|\bmini\b|audi|volkswagen|\bvw\b|opel|ford|renault|nissan|toyota|volvo|skoda|seat|porsche|peugeot|citro[eë]n|fiat|hyundai|\bkia\b|mazda|honda|land\s+rover|jaguar|tesla/iu;

/** Vai servisa vietas nosaukums acīmredzami nav autoserviss (sk. `NON_WORKSHOP_RE`). */
export function looksLikeNonWorkshopServiceProvider(location: string): boolean {
  const name = (location ?? "").split(",")[0]!.replace(/\s+/g, " ").trim();
  if (!name) return false;
  if (WORKSHOP_HINT_RE.test(name)) return false;
  return NON_WORKSHOP_RE.test(location ?? "");
}

function dealerRows(sourceBlocks: WorkspaceSourceBlocks): AutoRecordsServiceWorkRow[] {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  return printableDealerServiceWorks(blocks.auto_records.serviceWorks ?? []);
}

/** Dzinēja eļļas maiņas tieši tā, kā tās rāda PDF tabula (`buildOilIntervalSeriesForBlock`). */
export function dealerOilChangePointsForPrompt(
  sourceBlocks: WorkspaceSourceBlocks,
): { date: string; odometer: string }[] {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  return buildOilIntervalSeriesForBlock(blocks.auto_records).points.map((p) => ({
    date: p.date,
    odometer: p.odometer,
  }));
}

/** Mercedes taksometra / nomas rūpnīcas kodu latviskais skaidrojums (tikai fakts). */
const TAXI_CODE_LV: Record<string, string> = {
  "965": "elektroinstalācijas sagatave taksometram / nomas auto",
  "937": "taksometra / nomas pastiprinājuma pakete",
};

/**
 * Rūpnīcas aprīkojuma fakts par taksometra / nomas izpildījumu (Nils 23.11.2026, piem. WDD2120251A120979
 * E 350 CDI: 965 + 937). Tā pati noteikšana ar izņēmumiem kā ēnu režīma vērtējumā
 * (`detectDealerTaxiSignals`: 9A0, «Without taxi alarm», «Parts excluded for TAXI», «TAXI Adm variant» - nē).
 */
export function dealerTaxiEquipmentFactLine(sourceBlocks: WorkspaceSourceBlocks): string {
  const ar = mergeSourceBlocksWithDefaults(sourceBlocks).auto_records;
  const bundle = getAutoRecordsOutvinBundle(ar);
  const vin = bundle.vehicleInfo.vinCode || ar.outvinReport?.vehicleInfo?.vinCode || bundle.vin || "";
  const equipment = bundle.equipment.length > 0 ? bundle.equipment : (ar.outvinReport?.equipment ?? []);
  const signals = detectDealerTaxiSignals({
    vin,
    equipment,
    texts: [ar.rawUnprocessedData ?? "", ar.aiContextRaw ?? ""],
  }).filter((sig) => sig.kind === "taxi" || sig.kind === "rental");
  if (signals.length === 0) return "";
  const parts = signals.map((sig) => {
    const code = sig.text.match(/^(\d{3}[A-Z]?)\s/)?.[1] ?? "";
    const lv = TAXI_CODE_LV[code.replace(/[A-Z]$/, "")];
    return lv ? `${sig.text} (${lv})` : sig.text;
  });
  return (
    `- Rūpnīcas aprīkojums / reģistrs - taksometra vai nomas izpildījums: ${parts.join("; ")}. ` +
    "Laukā „Komentāri” to OBLIGĀTI min kā faktu ar kodu un nozīmi (piem. „Rūpnīcas aprīkojumā: 965 - elektroinstalācijas sagatave taksometram / nomas auto, 937 - taksometra / nomas pastiprinājuma pakete”), bez secinājumiem un ieteikumiem; eļļas laukā to neraksti."
  );
}

export function buildDealerCodeFactsForPrompt(
  sourceBlocks: WorkspaceSourceBlocks,
  nowMs: number = Date.now(),
): string {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const rows = dealerRows(sourceBlocks);
  if (rows.length === 0) return "";
  const facts = extractDealerFactsFromServiceWorks(rows, blocks.auto_records.oneautoIngest?.serviceTimelineOriginal);
  const summary = buildDealerVisitSummary(rows, facts, null, nowMs);
  const lines: string[] = [
    "=== Koda faktu saraksts (deterministisks; skaitļi tie paši, ko PDF - cits skaits aizliegts) ===",
  ];
  const name = resolveVehicleDisplayName(blocks);
  if (name) lines.push(`- Modelis (tas pats nosaukums, ko PDF): ${name}.`);
  // 23.11.2026 (W1K2132161A909201): AI rakstīja „4MATIC ar pilnpiedziņu”, lai gan ražotāja dati 4x2 (RWD).
  const drivetrain = extractVehicleDrivetrain(blocks);
  if (drivetrain) lines.push(`- ${formatRegistryDrivetrainFactLine(drivetrain, false)}.`);
  const taxi = dealerTaxiEquipmentFactLine(blocks);
  if (taxi) lines.push(taxi);
  if (summary) {
    lines.push(
      `- Dīlera ieraksti: ${rows.length}; pirmais ${summary.firstDate || "datums nav"}, pēdējais ${summary.lastDate || "datums nav"} (${summary.lastKm || "km nav"}).`,
    );
    if (summary.monthsSinceLast != null) {
      lines.push(`- Kopš pēdējā dīlera ieraksta līdz šodienai: ${summary.monthsSinceLast} mēn. (tas nav apgalvojums, ka apkopes nav veiktas).`);
    }
    const g = summary.longestGap;
    if (g) {
      const parts = [g.months != null ? `${g.months} mēn.` : "", g.km != null ? `${groupDigits(g.km)} km` : ""].filter(Boolean);
      lines.push(`- Garākais periods bez ierakstiem: ${parts.join(" / ")} (tekstā raksti „periods bez ierakstiem”, nekad „robs”).`);
    }
  }

  const oilSeries = buildOilIntervalSeriesForBlock(blocks.auto_records);
  const oil = oilSeries.points.map((p) => ({ date: p.date, odometer: p.odometer }));
  lines.push(
    oil.length > 0
      ? `- Dzinēja eļļas maiņas (tā pati tabula kā PDF): ${oil.length} (${oil.map((p) => `${p.date || "datums nav"} ${kmLabel(p.odometer)}`).join("; ")}).`
      : "- Dzinēja eļļas maiņas: kods dīlera datos neatrada nevienu. Neizdomā maiņas.",
  );
  const oilSteps = formatOilStepRangeFactLine(oilSeries);
  if (oilSteps) lines.push(`- ${oilSteps}`);

  const gearbox = rows.filter((r) => isGearboxOilChangeWork(r.works));
  if (gearbox.length > 0) {
    lines.push(`- Kārbas eļļas maiņas: ${gearbox.length} (${gearbox.map((r) => `${r.date} ${kmLabel(r.odometer)}`).join("; ")}).`);
  }

  for (const hit of summary?.majorWorks ?? []) {
    const times = hit.count && hit.count > 1 ? `, fiksēts ${hit.count} reizes, pēdējā reize` : "";
    lines.push(`- Lielais darbs: ${hit.label}${times} ${hit.date} ${hit.km}`.trim() + ".");
  }

  const campaigns = facts.rows.filter((r) => r.kind === "campaign");
  if (campaigns.length > 0) {
    lines.push(`- Kampaņas / profilaktiskie pasākumi dīlera datos: ${campaigns.map((c) => `${c.date} ${c.odometerKm != null ? `${groupDigits(c.odometerKm)} km` : "km nav"}`).join("; ")}.`);
  }

  for (const d of findDealerOdometerDrops(rows)) {
    const what =
      d.severity === "significant"
        ? "nobraukums mazāks nekā iepriekšējā ierakstā"
        : "iespējama nobraukuma ievades kļūda (sīka nobīde vai viens izlecošs rādījums)";
    lines.push(
      `- Odometrs: ${d.row.date} ${groupDigits(d.km)} km pēc ${d.previous.date} ${groupDigits(d.previousKm)} km - ${what}.`,
    );
  }
  const outliers = [...findDealerOdometerOutliers(rows)];
  if (outliers.length > 0) {
    lines.push(
      `- Rādījumi ārpus secības (periodu bez ierakstiem aprēķinā neizmantoti): ${outliers.map((r) => `${r.date} ${kmLabel(r.odometer)}`).join("; ")}.`,
    );
  }

  for (const r of rows) {
    if (!looksLikeNonWorkshopServiceProvider(r.location)) continue;
    const name = r.location.split(",")[0]!.trim();
    lines.push(`- Vieta ${r.date} „${name}” nav autoserviss (OneAuto norāde) - nesauc par oficiālo servisu.`);
  }
  return lines.join("\n");
}
