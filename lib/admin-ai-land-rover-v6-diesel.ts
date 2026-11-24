/**
 * PROVIN AI likums (Nils 24.11.2026): Land Rover / Range Rover (un Jaguar ar to pašu dzinēju)
 * 3.0 V6 dīzelis - Ford/PSA «Lion» konstrukcija (306DT; TDV6 / SDV6), arī agrākais 2.7 TDV6 (276DT).
 * Kad dzinējs identificēts, AI tekstos jābūt mūsu skaidram viedoklim, ka dzinējs ir riskants.
 */
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import {
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  detectLandRoverV6Diesel,
  landRoverV6DieselLabel,
  LR_V6_DIESEL_INSPECTION_STEPS,
  LR_V6_DIESEL_TYPICAL_FAULTS,
  type LrV6DieselMatch,
} from "@/lib/land-rover-v6-diesel";

export * from "@/lib/land-rover-v6-diesel";

export function detectLandRoverV6DieselFromBlocks(
  sourceBlocks: WorkspaceSourceBlocks,
  opts?: { vin?: string | null; manufactureYear?: number | null },
): LrV6DieselMatch | null {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const vin = (opts?.vin ?? "").trim().toUpperCase();
  const csdd = blocks.csdd;
  const vi = blocks.auto_records.outvinReport?.vehicleInfo;
  const bundleVi = getAutoRecordsOutvinBundle(blocks.auto_records, vin).vehicleInfo;
  const pick = (k: "model" | "modelSeries" | "engineCode" | "power" | "modelCode" | "developmentCode") =>
    (vi?.[k] || bundleVi[k] || "").trim();
  const cm3 = Number.parseInt((csdd.engineDisplacementCm3 || "").replace(/\D/g, ""), 10);
  const regYear = (csdd.firstRegistration || "").match(/\b(19|20)\d{2}\b/);
  const year = regYear
    ? Number.parseInt(regYear[0], 10)
    : opts?.manufactureYear != null && Number.isFinite(opts.manufactureYear)
      ? opts.manufactureYear
      : null;
  return detectLandRoverV6Diesel({
    makeModel: csdd.makeModel || pick("model"),
    extraIdentityText: [pick("model"), pick("modelSeries"), pick("power"), pick("modelCode"), pick("developmentCode")]
      .filter(Boolean)
      .join(" "),
    engineCode: pick("engineCode"),
    fuel: `${csdd.fuelType || ""} ${vi?.fuel || bundleVi.fuel || ""}`,
    displacementCm3: Number.isFinite(cm3) && cm3 > 0 ? cm3 : null,
    year,
    vin,
  });
}

/** Deterministisks prompta bloks ✨ tekstiem - tukšs, ja dzinējs nav šis. */
export function buildLandRoverV6DieselBrief(
  sourceBlocks: WorkspaceSourceBlocks,
  opts?: { vin?: string | null; manufactureYear?: number | null },
): string {
  const m = detectLandRoverV6DieselFromBlocks(sourceBlocks, opts);
  if (!m) return "";
  const lines = [
    "### Land Rover V6 dīzelis - PROVIN nostāja (deterministisks - NEIZDOMĀ pretējo)",
    `- Dzinējs: ${landRoverV6DieselLabel(m)}. Noteikts pēc: ${m.evidence}.`,
    "- PROVIN viedoklis: mūsu vērtējumā šis dzinējs ir riskants. To skaidri pasaki klientam savos vārdos (piem. „Mūsu vērtējumā šis dzinējs ir riskants”), ne tikai uzskaiti mezglus. Tonis atturīgs, bez biedēšanas.",
    `- OBLIGĀTI „1. Tehnisko risku analīze”: dzinējs ir galvenais pirkuma risks. Tipiskās kaites: ${LR_V6_DIESEL_TYPICAL_FAULTS}`,
  ];
  if (m.variant === "2.7") {
    lines.push(
      "- 2.7 TDV6 ir šīs konstrukcijas agrākā versija; tieši tai kloķvārpstas lūzumi ir visvairāk dokumentēti.",
    );
  }
  if (m.ladderFrame) {
    lines.push(
      "- Šis ir rāmja modelis: daudzi dzinēja darbi prasa virsbūves nocelšanu no rāmja, tāpēc remonts ir darbietilpīgs.",
    );
  }
  lines.push(
    `- OBLIGĀTI „2. Ieteikumi klātienes apskatei”: ${LR_V6_DIESEL_INSPECTION_STEPS}`,
    "- OBLIGĀTI kopsavilkumā: viens teikums ar PROVIN viedokli, ka dzinējs ir riskants, un kas risku samazina (pilna eļļas maiņu vēsture, dokumentēta zobsiksnu maiņa, tīrs aukstais starts, diagnostika bez kļūdām).",
    "- Remonta un rezerves daļu EUR summas NERAKSTI. Citu dzinēju kaites nekopē. Ja šī auto dati rāda pretējo (piem. dzinējs jau mainīts ar dokumentiem) - to pasaki, bet viedokli par dzinēja konstrukciju saglabā.",
  );
  return lines.join("\n");
}
