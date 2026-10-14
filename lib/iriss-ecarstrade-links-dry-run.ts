import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import { describeEcarstradeFilter, parseListingSearchDetailed } from "@/lib/iriss-listings-ecarstrade-search";
import { planEcarstradeSearchUrls, type IrissEcarstradeLinkSource } from "@/lib/iriss-scan-ecarstrade-links";

export type IrissEcarstradeDryRunKind = "pasutijums" | "scan";

export type IrissEcarstradeDryRunRecord = IrissEcarstradeLinkSource & {
  kind: IrissEcarstradeDryRunKind;
  label?: string;
};

function sourceLinkBlock(title: string, urls: readonly string[]): string[] {
  const filled = filledIrissListingLinks(urls);
  if (filled.length === 0) return [];
  const lines = [`- **${title}**`];
  for (const url of filled) {
    const parsed = parseListingSearchDetailed(url);
    const criteria = describeEcarstradeFilter(parsed.filter);
    lines.push(`  - \`${url}\``);
    if (criteria.length) lines.push(`    - kritēriji: ${criteria.join("; ")}`);
    else lines.push("    - kritēriji: (nav nolasāmu filtru; aizpilda brandModel / pasūtījuma lauki)");
  }
  return lines;
}

export function formatEcarstradeDryRunEntry(rec: IrissEcarstradeDryRunRecord): string {
  const plans = planEcarstradeSearchUrls(rec);
  const title = rec.label?.trim() || rec.brandModel.trim() || rec.id;
  const kind = rec.kind === "pasutijums" ? "Pasūtījums" : "Radars";
  const lines = [`### ${kind}: ${title}`, "", `- id: \`${rec.id}\``, `- brandModel: ${rec.brandModel.trim() || "(tukšs)"}`];
  if (rec.productionYears) lines.push(`- gadi (forma): ${rec.productionYears}`);
  if (rec.maxMileage) lines.push(`- max km (forma): ${rec.maxMileage}`);
  if (rec.totalBudget) lines.push(`- budžets (forma): ${rec.totalBudget}`);
  if (rec.engineType) lines.push(`- dzinējs (forma): ${rec.engineType}`);
  if (rec.transmission) lines.push(`- kārba (forma): ${rec.transmission}`);
  if (rec.bodyType) lines.push(`- virsbūve (forma): ${rec.bodyType}`);
  if (rec.driveType) lines.push(`- piedziņa (forma): ${rec.driveType}`);
  if (rec.preferredColors) lines.push(`- krāsas (forma): ${rec.preferredColors}`);
  if (rec.nonPreferredColors) lines.push(`- nevēlamas krāsas (forma): ${rec.nonPreferredColors}`);
  if (rec.equipmentRequired) lines.push(`- aprīkojums (forma): ${rec.equipmentRequired}`);
  lines.push("", "**Avotu saites**");
  const src = [
    ...sourceLinkBlock("Auto1", rec.listingLinkAuto1),
    ...sourceLinkBlock("Openlane", rec.listingLinkOpenline),
    ...sourceLinkBlock("Autobid", rec.listingLinkAutobid),
    ...sourceLinkBlock("Mobile.de", rec.listingLinkMobile),
  ];
  if (src.length) lines.push(...src);
  else lines.push("- (nav Auto1 / Openlane / Autobid / Mobile saišu; ET no brandModel / formas)");
  lines.push("", "**Rezultāta eCarsTrade**");
  if (plans.length === 0) lines.push("- nav ģenerējama ET saite (nav markas).");
  for (const [i, plan] of plans.entries()) {
    lines.push(`- ET ${i + 1} no ${plan.sourceUrls.length ? plan.sourceUrls.length : 0} avota saišu:`);
    if (plan.sourceUrls.length) {
      for (const u of plan.sourceUrls) lines.push(`  - avots: \`${u}\``);
    }
    lines.push(`  - saite: \`${plan.url}\``);
    if (plan.criteria.length) lines.push(`  - kartēts: ${plan.criteria.filter((c) => !c.startsWith("nav kartējams")).join("; ")}`);
    if (plan.unmapped.length) {
      lines.push("  - **nav kartējams uz ET URL** (ingest post-filtrs / ignorēts):");
      for (const u of plan.unmapped) lines.push(`    - ${u}`);
    }
  }
  const existing = filledIrissListingLinks(rec.listingLinkEcarstrade);
  if (existing.length) {
    lines.push("", "**Pašreizējā saglabātā ET** (netiek pārrakstīta šajā dry-run)");
    for (const u of existing) lines.push(`- \`${u}\``);
  }
  return lines.join("\n");
}

export function formatEcarstradeDryRunReport(records: readonly IrissEcarstradeDryRunRecord[]): string {
  const orders = records.filter((r) => r.kind === "pasutijums");
  const scans = records.filter((r) => r.kind === "scan");
  const flagged = records.filter((r) => planEcarstradeSearchUrls(r).some((p) => p.unmapped.length > 0));
  const parts = [
    "# eCarsTrade precīzo saišu dry-run",
    "",
    "Produkcijas dati netiek rakstīti. Atjaunot ET palaižams pēc Nils apstiprinājuma.",
    "Šis saraksts ir no reprezentatīviem Auto1 / Autobid / Openlane / Mobile filtriem (fixtures). Dzīvais Blob šajā vidē nav pieejams; pēc merge Nils palaiž Atjaunot ET uz pasūtījumiem un radaru.",
    "",
    `- Pasūtījumi: ${orders.length}`,
    `- Radars / Meklētājs: ${scans.length}`,
    `- Ieraksti ar vismaz vienu nekartējamu kritēriju: ${flagged.length}`,
    "",
  ];
  if (orders.length) {
    parts.push("## Pasūtījumi", "");
    for (const rec of orders) parts.push(formatEcarstradeDryRunEntry(rec), "");
  }
  if (scans.length) {
    parts.push("## Radars / Meklētājs", "");
    for (const rec of scans) parts.push(formatEcarstradeDryRunEntry(rec), "");
  }
  return parts.join("\n").trim() + "\n";
}
