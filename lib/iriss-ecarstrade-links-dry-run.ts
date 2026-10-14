import { coerceIrissListingLinkList, filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
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

function cell(v: string): string {
  return v.replace(/\|/g, "/").trim() || "-";
}

function exactComparisonTable(rec: IrissEcarstradeDryRunRecord): string[] {
  const plans = planEcarstradeSearchUrls(rec);
  const lines = ["", "**Precīzais salīdzinājums (avots kā izsole to lasa vs ET)**", ""];
  for (const [i, plan] of plans.entries()) {
    const src = plan.sourceUrls[0] || "(brandModel / forma)";
    const parsed = plan.sourceUrls[0] ? describeEcarstradeFilter(parseListingSearchDetailed(plan.sourceUrls[0]).filter) : [];
    lines.push(`ET ${i + 1} avots: \`${src}\``);
    lines.push("");
    lines.push("| Kritērijs | Izsoles saite | ET URL |");
    lines.push("|---|---|---|");
    const etBits = describeEcarstradeFilter(plan.filter);
    const keys = ["marka", "modelis", "gadi", "nobraukums", "cena", "jauda", "degviela", "kārba", "virsbūve", "krāsa", "tilpums", "durvis", "piedziņa", "aprīkojums", "izslēgts"];
    for (const key of keys) {
      const srcRow = parsed.find((c) => c.startsWith(key)) ?? "";
      const etRow = etBits.find((c) => c.startsWith(key)) ?? "";
      if (!srcRow && !etRow) continue;
      lines.push(`| ${cell(key)} | ${cell(srcRow.replace(/^[^:]+:\s*/, ""))} | ${cell(etRow.replace(/^[^:]+:\s*/, ""))} |`);
    }
    lines.push(`| ET saite | - | \`${plan.url}\` |`);
    if (plan.unmapped.length) {
      lines.push(`| nav ET lauka | ${cell(plan.unmapped.join("; "))} | iriss_* post-filtrs / atzīmēts |`);
    }
    lines.push("");
  }
  if (plans.length === 0) lines.push("- nav ģenerējama ET saite (nav markas).", "");
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
    ...sourceLinkBlock("Mobile.de (ET neņem vērā)", rec.listingLinkMobile),
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
  lines.push(...exactComparisonTable(rec));
  return lines.join("\n");
}

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function strField(rec: Record<string, unknown>, key: string): string {
  const v = rec[key];
  return typeof v === "string" ? v : "";
}

/** Pasūtījumu backup → dry-run rindas. Bez vārda, e-pasta, tālruņa. */
export function dryRunRecordsFromPasutijumiBackup(payload: unknown): IrissEcarstradeDryRunRecord[] {
  const root = asRec(payload);
  const drafts = root && asRec(root.orderDrafts);
  if (!drafts) return [];
  const out: IrissEcarstradeDryRunRecord[] = [];
  for (const raw of Object.values(drafts)) {
    let rec: Record<string, unknown> | null = null;
    if (typeof raw === "string") {
      try {
        rec = asRec(JSON.parse(raw));
      } catch {
        rec = null;
      }
    } else {
      rec = asRec(raw);
    }
    if (!rec) continue;
    const id = strField(rec, "id") || `draft-${out.length + 1}`;
    const brandModel = strField(rec, "brandModel");
    out.push({
      kind: "pasutijums",
      id,
      label: brandModel || id.slice(0, 8),
      brandModel,
      productionYears: strField(rec, "productionYears"),
      totalBudget: strField(rec, "totalBudget"),
      engineType: strField(rec, "engineType"),
      transmission: strField(rec, "transmission"),
      bodyType: strField(rec, "bodyType"),
      driveType: strField(rec, "driveType"),
      seatCount: strField(rec, "seatCount"),
      maxMileage: strField(rec, "maxMileage"),
      preferredColors: strField(rec, "preferredColors"),
      nonPreferredColors: strField(rec, "nonPreferredColors"),
      equipmentRequired: strField(rec, "equipmentRequired"),
      dealVat21Required: rec.dealVat21Required === true,
      listingLinkAuto1: coerceIrissListingLinkList(rec.listingLinkAuto1),
      listingLinkOpenline: coerceIrissListingLinkList(rec.listingLinkOpenline),
      listingLinkAutobid: coerceIrissListingLinkList(rec.listingLinkAutobid),
      listingLinkMobile: coerceIrissListingLinkList(rec.listingLinkMobile),
      listingLinkEcarstrade: coerceIrissListingLinkList(rec.listingLinkEcarstrade),
    });
  }
  return out;
}

export function summarizeEcarstradeDryRun(records: readonly IrissEcarstradeDryRunRecord[]): string[] {
  let plans = 0;
  let makeOnly = 0;
  let unmappedBrand = 0;
  let porsche = 0;
  let singleYear = 0;
  let exactCc = 0;
  for (const rec of records) {
    const built = planEcarstradeSearchUrls(rec);
    plans += built.length;
    for (const p of built) {
      if (p.filter.makeIds.length > 0 && !p.filter.modelName) makeOnly += 1;
      if (p.unmapped.some((u) => /brandId/i.test(u))) unmappedBrand += 1;
      if (p.filter.makeNames.includes("Porsche")) porsche += 1;
      if (p.filter.yearFrom != null && p.filter.yearFrom === p.filter.yearTo) singleYear += 1;
      if (p.filter.engineFromCc != null && p.filter.engineFromCc === p.filter.engineToCc) exactCc += 1;
    }
  }
  return [
    `- ET plāni: ${plans}`,
    `- Make-only plāni (nav modeļa): ${makeOnly}`,
    `- Plāni ar nekartētu Autobid brandId: ${unmappedBrand}`,
    `- Plāni ar Porsche marku: ${porsche}`,
    `- Plāni ar vienu gadu (no=līdz): ${singleYear}`,
    `- Plāni ar precīzu cm3 (no=līdz): ${exactCc}`,
  ];
}

export function formatEcarstradeDryRunReport(
  records: readonly IrissEcarstradeDryRunRecord[],
  opts?: { realBackup?: boolean },
): string {
  const orders = records.filter((r) => r.kind === "pasutijums");
  const scans = records.filter((r) => r.kind === "scan");
  const flagged = records.filter((r) => planEcarstradeSearchUrls(r).some((p) => p.unmapped.length > 0));
  const intro = opts?.realBackup
    ? "Šis saraksts ir no IRISS pasūtījumu backup (anonymizēts: bez vārda, e-pasta, tālruņa). Produkcijas Blob netiek rakstīts."
    : "Šis saraksts ir no reprezentatīviem Auto1 / Autobid / Openlane filtriem (fixtures). Mobile.de ET saitei neņem vērā. Dzīvais Blob šajā vidē nav pieejams; pēc merge Nils palaiž Atjaunot ET uz pasūtījumiem un radaru. Live ecarstrade.com 2026-10-14: mark[] value Volvo=68, Audi=5, BMW=7, Mercedes=45, Lexus=39, Toyota=66, Porsche=54; fuel[]=Diesel un category[]=SUV/Off-road Vehicle/Pickup Truck sakrīt ar HTML. future_api mark[]=68&model[]=1866 atdod XC60; dīzeļa filtrs izslēdz hibrīdus.";
  const parts = [
    "# eCarsTrade precīzo saišu dry-run",
    "",
    "Produkcijas dati netiek rakstīti. Atjaunot ET palaižams pēc Nils apstiprinājuma.",
    intro,
    "",
    `- Pasūtījumi: ${orders.length}`,
    `- Radars / Meklētājs: ${scans.length}`,
    `- Ieraksti ar vismaz vienu nekartējamu kritēriju: ${flagged.length}`,
    ...(opts?.realBackup ? summarizeEcarstradeDryRun(records) : []),
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
