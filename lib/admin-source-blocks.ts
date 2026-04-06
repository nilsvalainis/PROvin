/**
 * Strukturēti avotu bloki admin portfelī → sintēze uz PDF / km / VIN heuristiku.
 */

export const SOURCE_BLOCK_KEYS = [
  "csdd",
  "autodna",
  "carvertical",
  "auto_records",
  "ltab",
  "tirgus",
  "citi_avoti",
  "listing_analysis",
] as const;

export type SourceBlockKey = (typeof SOURCE_BLOCK_KEYS)[number];

/** Režģa standarta bloki (rindas + komentāri; bez CSDD, citi_avoti, Sludinājuma analīzes). */
export type StandardSourceBlockKey = Exclude<SourceBlockKey, "csdd" | "listing_analysis" | "citi_avoti">;

export const STANDARD_SOURCE_BLOCK_KEYS: StandardSourceBlockKey[] = [
  "tirgus",
  "autodna",
  "carvertical",
  "auto_records",
  "ltab",
];

export const SOURCE_BLOCK_LABELS: Record<SourceBlockKey, string> = {
  csdd: "CSDD",
  tirgus: "Tirgus dati",
  autodna: "AutoDNA",
  carvertical: "CarVertical",
  auto_records: "Auto-Records",
  ltab: "LTAB",
  citi_avoti: "Citi avoti",
  listing_analysis: "Sludinājuma analīze",
};

/** Ātrās saites avotiem — tikai admin panelis (ne PDF). */
export const SOURCE_BLOCK_EXTERNAL_URL: Record<SourceBlockKey, string> = {
  csdd: "https://e.csdd.lv/tadati/",
  ltab: "https://services.ltab.lv/lv/VehicleInsAndAcc",
  tirgus: "https://tirgusdati.lv/app/listings/history",
  autodna: "https://www.autodna.com",
  carvertical: "https://www.carvertical.lv",
  auto_records: "https://www.auto-records.com",
  citi_avoti: "https://www.provin.lv",
  listing_analysis: "https://www.ss.lv",
};

/** Virsraksta krāsa admin UI (Tailwind). */
export const SOURCE_BLOCK_ADMIN_TITLE_COLOR: Record<SourceBlockKey, string> = {
  csdd: "text-emerald-900",
  ltab: "text-red-900",
  tirgus: "text-blue-900",
  autodna: "text-sky-700",
  carvertical: "text-yellow-600",
  auto_records: "text-orange-500",
  citi_avoti: "text-stone-700",
  listing_analysis: "text-green-700",
};

/** Avotu virsraksta teksta izmērs admin UI (11px, saskaņots ar laukiem). */
export const SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS = "text-[11px]";

/** Nobraukuma vēsture LV — viena rinda (admin + PDF tabula). */
export type CsddMileageHistoryRow = {
  date: string;
  odometer: string;
  distance: string;
};

/** CSDD statiskā forma — lauku atslēgas. */
export type CsddFormFields = {
  /** Tikai admin panelis — ielīmētais neapstrādātais teksts; netiek drukāts PDF. */
  rawUnprocessedData: string;
  makeModel: string;
  firstRegDate: string;
  regNumber: string;
  odometer: string;
  enginePowerKw: string;
  grossMassKg: string;
  curbWeightKg: string;
  roadTaxYearly: string;
  solidParticlesCm3: string;
  nextInspectionDate: string;
  prevInspectionDate: string;
  prevInspectionRating: string;
  comments: string;
  mileageHistoryLv: CsddMileageHistoryRow[];
};

/** Etiķetes PDF un admin — precīzi kā specifikācijā. */
export const CSDD_FORM_SHORT_FIELDS: {
  key: keyof CsddFormFields;
  label: string;
}[] = [
  { key: "makeModel", label: "Marka/modelis:" },
  { key: "firstRegDate", label: "Pirmās reģistrācijas datums:" },
  { key: "regNumber", label: "Reģistrācijas numurs:" },
  { key: "odometer", label: "Odometra rādījums:" },
  { key: "enginePowerKw", label: "Motora maksimālā jauda (kW):" },
  { key: "grossMassKg", label: "Pilna masa (kg):" },
  { key: "curbWeightKg", label: "Pašmasa (kg):" },
  { key: "roadTaxYearly", label: "Transportlīdzekļa ekspluatācijas nodoklis" },
  { key: "solidParticlesCm3", label: "Atgāzu cietās daļiņas (cm-3):" },
  { key: "nextInspectionDate", label: "Nākamās apskates datums:" },
  { key: "prevInspectionDate", label: "Iepriekšējās apskates datums:" },
];

export const CSDD_LABEL_PREV_RATING = "Iepriekšējās apskates vērtējums:";
export const CSDD_LABEL_COMMENTS = "Komentāri:";

/** Tirgus dati — admin un PDF etiķetes (precīzi). */
export type TirgusFormFields = {
  listedForSale: string;
  listingCreated: string;
  priceDrop: string;
  comments: string;
};

export const TIRGUS_LABEL_LISTED = "Auto pārdošanā:";
export const TIRGUS_LABEL_CREATED = "Izveidots:";
export const TIRGUS_LABEL_PRICE_DROP = "Cenas kritums:";
export const TIRGUS_LABEL_COMMENTS = "Komentāri:";

export function emptyTirgusFields(): TirgusFormFields {
  return { listedForSale: "", listingCreated: "", priceDrop: "", comments: "" };
}

export function tirgusFormHasContent(f: TirgusFormFields | null | undefined): boolean {
  if (!f) return false;
  return (
    f.listedForSale.trim().length > 0 ||
    f.listingCreated.trim().length > 0 ||
    f.priceDrop.trim().length > 0 ||
    f.comments.trim().length > 0
  );
}

export function tirgusFormToPlainText(f: TirgusFormFields): string {
  const lines: string[] = [];
  if (f.listedForSale.trim()) lines.push(`${TIRGUS_LABEL_LISTED} ${f.listedForSale.trim()}`);
  if (f.listingCreated.trim()) lines.push(`${TIRGUS_LABEL_CREATED} ${f.listingCreated.trim()}`);
  if (f.priceDrop.trim()) lines.push(`${TIRGUS_LABEL_PRICE_DROP} ${f.priceDrop.trim()}`);
  if (f.comments.trim()) lines.push(`${TIRGUS_LABEL_COMMENTS}\n${f.comments.trim()}`);
  return lines.join("\n");
}

export function emptyCsddFields(): CsddFormFields {
  return {
    rawUnprocessedData: "",
    makeModel: "",
    firstRegDate: "",
    regNumber: "",
    odometer: "",
    enginePowerKw: "",
    grossMassKg: "",
    curbWeightKg: "",
    roadTaxYearly: "",
    solidParticlesCm3: "",
    nextInspectionDate: "",
    prevInspectionDate: "",
    prevInspectionRating: "",
    comments: "",
    mileageHistoryLv: [],
  };
}

export const CSDD_MILEAGE_HISTORY_TITLE = "Nobraukuma vēsture LV";

export function emptyCsddMileageRow(): CsddMileageHistoryRow {
  return { date: "", odometer: "", distance: "" };
}

function csddMileageRowHasData(r: CsddMileageHistoryRow): boolean {
  return Boolean(r.date.trim() || r.odometer.trim() || r.distance.trim());
}

export function csddFormHasContent(f: CsddFormFields): boolean {
  return (
    CSDD_FORM_SHORT_FIELDS.some(({ key }) => (f[key] as string).trim().length > 0) ||
    f.prevInspectionRating.trim().length > 0 ||
    f.comments.trim().length > 0 ||
    f.mileageHistoryLv.some(csddMileageRowHasData)
  );
}

/** Teksts km/VIN heuristiku (`extractKmCandidates`, u.c.). */
export function csddFormToPlainText(f: CsddFormFields): string {
  const lines: string[] = [];
  for (const { key, label } of CSDD_FORM_SHORT_FIELDS) {
    const v = (f[key] as string).trim();
    if (v) lines.push(`${label} ${v}`);
  }
  if (f.odometer.trim()) {
    const o = f.odometer.replace(/\s/g, "");
    if (o && !lines.some((l) => /\d/.test(l) && l.includes(o)))
      lines.push(`${o} km`);
  }
  const mh = f.mileageHistoryLv.filter(csddMileageRowHasData);
  if (mh.length > 0) {
    lines.push(CSDD_MILEAGE_HISTORY_TITLE);
    for (const row of mh) {
      const cells = [row.date, row.odometer, row.distance].map((c) => c.replace(/\s+/g, " ").trim()).join("\t");
      lines.push(cells);
    }
  }
  if (f.prevInspectionRating.trim()) lines.push(`${CSDD_LABEL_PREV_RATING}\n${f.prevInspectionRating.trim()}`);
  if (f.comments.trim()) lines.push(`${CSDD_LABEL_COMMENTS}\n${f.comments.trim()}`);
  return lines.join("\n");
}

export type SourceDataRow = {
  date: string;
  km: string;
  amount: string;
};

export type StandardSourceBlockState = {
  rows: SourceDataRow[];
  comments: string;
};

/** LTAB / OCTA — viena negadījuma rinda (horizontāli). */
export type LtabIncidentRow = {
  incidentNo: string;
  csngDate: string;
  lossAmount: string;
};

export type LtabBlockState = {
  rows: LtabIncidentRow[];
  comments: string;
};

/** Citi avoti — viens brīvā teksta lauks (PDF: „Komentāri” zonā). */
export type CitiAvotiBlockState = {
  comments: string;
};

/** Sludinājuma analīze — trīs brīvā teksta lauki (PDF: apakškategorijas ar „Komentāri”). */
export type ListingAnalysisBlockState = {
  sellerPortrait: string;
  photoAnalysis: string;
  listingDescription: string;
};

export type WorkspaceSourceBlocks = {
  csdd: CsddFormFields;
  tirgus: TirgusFormFields;
  autodna: StandardSourceBlockState;
  carvertical: StandardSourceBlockState;
  auto_records: StandardSourceBlockState;
  ltab: LtabBlockState;
  citi_avoti: CitiAvotiBlockState;
  listing_analysis: ListingAnalysisBlockState;
};

export function emptyDataRow(): SourceDataRow {
  return { date: "", km: "", amount: "" };
}

export function emptyStandardBlock(): StandardSourceBlockState {
  return { rows: [emptyDataRow()], comments: "" };
}

export function emptyLtabRow(): LtabIncidentRow {
  return { incidentNo: "", csngDate: "", lossAmount: "" };
}

export function emptyLtabBlock(): LtabBlockState {
  return { rows: [emptyLtabRow()], comments: "" };
}

export function emptyCitiAvotiBlock(): CitiAvotiBlockState {
  return { comments: "" };
}

export function citiAvotiHasContent(b: CitiAvotiBlockState): boolean {
  return b.comments.trim().length > 0;
}

export function citiAvotiToPlainText(b: CitiAvotiBlockState): string {
  return b.comments.trim();
}

export function emptyListingAnalysisBlock(): ListingAnalysisBlockState {
  return { sellerPortrait: "", photoAnalysis: "", listingDescription: "" };
}

export function listingAnalysisHasContent(b: ListingAnalysisBlockState): boolean {
  return (
    b.sellerPortrait.trim().length > 0 ||
    b.photoAnalysis.trim().length > 0 ||
    b.listingDescription.trim().length > 0
  );
}

export const LISTING_ANALYSIS_SUBSECTIONS = {
  sellerPortrait: "Pārdevēja portrets",
  photoAnalysis: "Fotogrāfiju analīze",
  listingDescription: "Sludinājuma apraksts",
} as const;

export function listingAnalysisToPlainText(b: ListingAnalysisBlockState): string {
  const L = LISTING_ANALYSIS_SUBSECTIONS;
  const parts: string[] = [];
  if (b.sellerPortrait.trim()) {
    parts.push(`${L.sellerPortrait}\nKomentāri\n${b.sellerPortrait.trim()}`);
  }
  if (b.photoAnalysis.trim()) {
    parts.push(`${L.photoAnalysis}\nKomentāri\n${b.photoAnalysis.trim()}`);
  }
  if (b.listingDescription.trim()) {
    parts.push(`${L.listingDescription}\nKomentāri\n${b.listingDescription.trim()}`);
  }
  return parts.join("\n\n");
}

function parseListingAnalysisRaw(raw: Record<string, unknown>): ListingAnalysisBlockState {
  const clip = (v: unknown) => String(v ?? "").slice(0, 8000);
  return {
    sellerPortrait: clip(raw.sellerPortrait),
    photoAnalysis: clip(raw.photoAnalysis),
    listingDescription: clip(raw.listingDescription),
  };
}

export function createDefaultSourceBlocks(): WorkspaceSourceBlocks {
  return {
    csdd: emptyCsddFields(),
    tirgus: emptyTirgusFields(),
    autodna: emptyStandardBlock(),
    carvertical: emptyStandardBlock(),
    auto_records: emptyStandardBlock(),
    ltab: emptyLtabBlock(),
    citi_avoti: emptyCitiAvotiBlock(),
    listing_analysis: emptyListingAnalysisBlock(),
  };
}

export function rowHasData(r: SourceDataRow): boolean {
  return Boolean(r.date.trim() || r.km.trim() || r.amount.trim());
}

export function standardBlockHasContent(b: StandardSourceBlockState): boolean {
  return b.rows.some(rowHasData) || b.comments.trim().length > 0;
}

export function standardBlockToPlainText(b: StandardSourceBlockState): string {
  const lines = b.rows.filter(rowHasData).map((r) => `${r.date.trim()}\t${r.km.trim()}\t${r.amount.trim()}`);
  const c = b.comments.trim();
  return [...lines, ...(c ? [c] : [])].join("\n");
}

export function ltabRowHasData(r: LtabIncidentRow): boolean {
  return Boolean(r.incidentNo.trim() || r.csngDate.trim() || r.lossAmount.trim());
}

export function ltabBlockHasContent(b: LtabBlockState): boolean {
  return b.rows.some(ltabRowHasData) || b.comments.trim().length > 0;
}

/**
 * Teksts apdrošināšanas / OCTA heuristiku: katrā rindā datums + EUR, lai `parseClaimRowsFromLineBasedText` varētu nolasīt.
 */
export function ltabBlockToPlainText(b: LtabBlockState): string {
  const lines = b.rows.filter(ltabRowHasData).map((r) => {
    const d = r.csngDate.trim();
    const rawAmt = r.lossAmount.trim();
    const amt =
      rawAmt && !/EUR|€/i.test(rawAmt) ? `${rawAmt.replace(/\s+/g, " ")} EUR` : rawAmt.replace(/\s+/g, " ");
    const n = r.incidentNo.trim();
    const core = [d, amt].filter(Boolean).join("\t");
    return n ? `${core}\t${n}`.trim() : core;
  });
  const c = b.comments.trim();
  return [...lines, ...(c ? [c] : [])].join("\n");
}

const VENDOR_KEYS = ["autodna", "carvertical", "auto_records"] as const satisfies readonly StandardSourceBlockKey[];

export function mergeVendorBlocksPlain(blocks: WorkspaceSourceBlocks): string {
  const parts: string[] = [];
  for (const k of VENDOR_KEYS) {
    const t = standardBlockToPlainText(blocks[k]);
    if (!t) continue;
    parts.push(`【${SOURCE_BLOCK_LABELS[k]}】\n${t}`);
  }
  return parts.join("\n\n");
}

export function blocksToLegacyFlatFields(blocks: WorkspaceSourceBlocks): {
  csdd: string;
  ltab: string;
  tirgus: string;
  citi: string;
} {
  const vendorPlain = mergeVendorBlocksPlain(blocks);
  const extra = blocks.citi_avoti.comments.trim();
  const citiParts: string[] = [];
  if (vendorPlain) citiParts.push(vendorPlain);
  if (extra) citiParts.push(`【${SOURCE_BLOCK_LABELS.citi_avoti}】\n${extra}`);
  return {
    csdd: csddFormToPlainText(blocks.csdd),
    ltab: ltabBlockToPlainText(blocks.ltab),
    tirgus: tirgusFormToPlainText(blocks.tirgus),
    citi: citiParts.join("\n\n"),
  };
}

export type ClientManualVendorBlockPdf = {
  title: string;
  rows: SourceDataRow[];
  comments: string;
  /** Trešās kolonnas virsraksts PDF tabulā. */
  amountColumnLabel?: string;
};

/** Strukturēts LTAB bloks PDF — atsevišķi panelī pēc AutoDNA / CV / Auto-Records (kā admin režģī). */
export type ClientManualLtabBlockPdf = {
  rows: LtabIncidentRow[];
  comments: string;
};

function vendorPdfAmountColumnLabel(): string {
  return "Zaudējumu summa";
}

export function toPdfManualVendorBlocks(blocks: WorkspaceSourceBlocks): ClientManualVendorBlockPdf[] {
  const out: ClientManualVendorBlockPdf[] = [];
  for (const k of VENDOR_KEYS) {
    const b = blocks[k];
    if (!standardBlockHasContent(b)) continue;
    out.push({
      title: SOURCE_BLOCK_LABELS[k],
      rows: b.rows.filter(rowHasData),
      comments: b.comments.trim(),
      amountColumnLabel: vendorPdfAmountColumnLabel(),
    });
  }
  return out;
}

export function toPdfLtabManualBlock(b: LtabBlockState): ClientManualLtabBlockPdf | null {
  if (!ltabBlockHasContent(b)) return null;
  return {
    rows: b.rows.filter(ltabRowHasData),
    comments: b.comments.trim(),
  };
}

function parseStandardBlockRaw(raw: Record<string, unknown>): StandardSourceBlockState {
  const rowsIn = Array.isArray(raw.rows) ? raw.rows : [];
  const rows: SourceDataRow[] = rowsIn
    .map((row) => {
      if (!row || typeof row !== "object") return emptyDataRow();
      const x = row as Record<string, unknown>;
      return {
        date: String(x.date ?? "").slice(0, 120),
        km: String(x.km ?? "").slice(0, 120),
        amount: String(x.amount ?? "").slice(0, 120),
      };
    })
    .filter((row) => row.date || row.km || row.amount);
  const comments = typeof raw.comments === "string" ? raw.comments : "";
  return {
    rows: rows.length > 0 ? rows : [emptyDataRow()],
    comments,
  };
}

function parseLtabBlockRaw(raw: Record<string, unknown>): LtabBlockState {
  const rowsIn = Array.isArray(raw.rows) ? raw.rows : [];
  const rows: LtabIncidentRow[] = rowsIn.map((row) => {
    if (!row || typeof row !== "object") return emptyLtabRow();
    const x = row as Record<string, unknown>;
    if ("incidentNo" in x || "csngDate" in x || "lossAmount" in x) {
      return {
        incidentNo: String(x.incidentNo ?? "").slice(0, 120),
        csngDate: String(x.csngDate ?? "").slice(0, 120),
        lossAmount: String(x.lossAmount ?? "").slice(0, 120),
      };
    }
    return {
      incidentNo: String(x.km ?? "").slice(0, 120),
      csngDate: String(x.date ?? "").slice(0, 120),
      lossAmount: String(x.amount ?? "").slice(0, 120),
    };
  });
  const filtered = rows.filter(ltabRowHasData);
  const comments = typeof raw.comments === "string" ? raw.comments : "";
  return {
    rows: filtered.length > 0 ? filtered : [emptyLtabRow()],
    comments,
  };
}

function parseCsddMileageHistoryRaw(raw: unknown): CsddMileageHistoryRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: CsddMileageHistoryRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const x = row as Record<string, unknown>;
    rows.push({
      date: String(x.date ?? "").slice(0, 120),
      odometer: String(x.odometer ?? "").slice(0, 120),
      distance: String(x.distance ?? "").slice(0, 120),
    });
  }
  return rows;
}

function parseCsddFieldsRaw(raw: Record<string, unknown>): CsddFormFields {
  const clip = (v: unknown) => String(v ?? "").slice(0, 4000);
  const mileage = parseCsddMileageHistoryRaw(raw.mileageHistoryLv);
  return {
    rawUnprocessedData: clip(raw.rawUnprocessedData),
    makeModel: clip(raw.makeModel),
    firstRegDate: clip(raw.firstRegDate),
    regNumber: clip(raw.regNumber),
    odometer: clip(raw.odometer),
    enginePowerKw: clip(raw.enginePowerKw),
    grossMassKg: clip(raw.grossMassKg),
    curbWeightKg: clip(raw.curbWeightKg),
    roadTaxYearly: clip(raw.roadTaxYearly),
    solidParticlesCm3: clip(raw.solidParticlesCm3),
    nextInspectionDate: clip(raw.nextInspectionDate),
    prevInspectionDate: clip(raw.prevInspectionDate),
    prevInspectionRating: clip(raw.prevInspectionRating),
    comments: clip(raw.comments),
    mileageHistoryLv: mileage.length > 0 ? mileage : [],
  };
}

function parseTirgusBlockRaw(raw: Record<string, unknown>): TirgusFormFields {
  const clip = (v: unknown) => String(v ?? "").slice(0, 4000);
  if ("listedForSale" in raw || "listingCreated" in raw || "priceDrop" in raw) {
    return {
      listedForSale: clip(raw.listedForSale),
      listingCreated: clip(raw.listingCreated),
      priceDrop: clip(raw.priceDrop),
      comments: typeof raw.comments === "string" ? raw.comments : "",
    };
  }
  if ("rows" in raw || "comments" in raw) {
    const old = parseStandardBlockRaw(raw);
    const t = standardBlockToPlainText(old).trim();
    return t ? { ...emptyTirgusFields(), comments: t } : emptyTirgusFields();
  }
  return emptyTirgusFields();
}

/** Vecais CSDD { rows, comments } → forma (teksts komentāros). */
export function migrateLegacyCsddBlock(old: StandardSourceBlockState): CsddFormFields {
  const t = standardBlockToPlainText(old).trim();
  if (!t) return emptyCsddFields();
  return { ...emptyCsddFields(), comments: t };
}

export function mergeSourceBlocksWithDefaults(partial: unknown): WorkspaceSourceBlocks {
  const base = createDefaultSourceBlocks();
  if (!partial || typeof partial !== "object") return base;
  const o = partial as Record<string, unknown>;

  const rawCsdd = o.csdd;
  if (rawCsdd && typeof rawCsdd === "object") {
    const c = rawCsdd as Record<string, unknown>;
    if ("makeModel" in c || "fields" in c) {
      const fields = c.fields && typeof c.fields === "object" ? (c.fields as Record<string, unknown>) : c;
      base.csdd = { ...emptyCsddFields(), ...parseCsddFieldsRaw(fields) };
    } else if ("rows" in c || "comments" in c) {
      base.csdd = migrateLegacyCsddBlock(parseStandardBlockRaw(c));
    }
  }

  for (const key of STANDARD_SOURCE_BLOCK_KEYS) {
    if (key === "ltab" || key === "tirgus") continue;
    const raw = o[key];
    if (!raw || typeof raw !== "object") continue;
    base[key] = parseStandardBlockRaw(raw as Record<string, unknown>);
  }

  const rawTirgus = o.tirgus;
  if (rawTirgus && typeof rawTirgus === "object") {
    base.tirgus = parseTirgusBlockRaw(rawTirgus as Record<string, unknown>);
  }

  const rawLtab = o.ltab;
  if (rawLtab && typeof rawLtab === "object") {
    base.ltab = parseLtabBlockRaw(rawLtab as Record<string, unknown>);
  }

  const rawListing = o.listing_analysis;
  if (rawListing && typeof rawListing === "object") {
    base.listing_analysis = parseListingAnalysisRaw(rawListing as Record<string, unknown>);
  }

  const rawCitiAvoti = o.citi_avoti;
  if (rawCitiAvoti && typeof rawCitiAvoti === "object") {
    base.citi_avoti = parseCitiAvotiRaw(rawCitiAvoti as Record<string, unknown>);
  }

  return base;
}

function parseCitiAvotiRaw(raw: Record<string, unknown>): CitiAvotiBlockState {
  return {
    comments: typeof raw.comments === "string" ? raw.comments.slice(0, 12000) : "",
  };
}

export function migrateFlatWorkspaceToBlocks(flat: {
  csdd?: string;
  ltab?: string;
  tirgus?: string;
  citi?: string;
}): WorkspaceSourceBlocks {
  const b = createDefaultSourceBlocks();
  if (flat.csdd?.trim()) b.csdd = { ...emptyCsddFields(), comments: flat.csdd.trim() };
  if (flat.ltab?.trim()) b.ltab = { rows: [emptyLtabRow()], comments: flat.ltab.trim() };
  if (flat.tirgus?.trim()) b.tirgus = { ...emptyTirgusFields(), comments: flat.tirgus.trim() };
  if (flat.citi?.trim()) {
    b.citi_avoti = { comments: flat.citi.trim() };
  }
  return b;
}

export function hydrateWorkspaceFromStorage(raw: string | null): {
  sourceBlocks: WorkspaceSourceBlocks;
  iriss: string;
  apskatesPlāns: string;
  previewConfirmed: boolean;
} | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    let sourceBlocks: WorkspaceSourceBlocks;
    if (p.sourceBlocks && typeof p.sourceBlocks === "object") {
      sourceBlocks = mergeSourceBlocksWithDefaults(p.sourceBlocks);
    } else if ("csdd" in p || "ltab" in p || "tirgus" in p || "citi" in p) {
      sourceBlocks = migrateFlatWorkspaceToBlocks({
        csdd: typeof p.csdd === "string" ? p.csdd : "",
        ltab: typeof p.ltab === "string" ? p.ltab : "",
        tirgus: typeof p.tirgus === "string" ? p.tirgus : "",
        citi: typeof p.citi === "string" ? p.citi : "",
      });
    } else {
      return null;
    }
    return {
      sourceBlocks,
      iriss: typeof p.iriss === "string" ? p.iriss : "",
      apskatesPlāns: typeof p.apskatesPlāns === "string" ? p.apskatesPlāns : "",
      previewConfirmed: Boolean(p.previewConfirmed),
    };
  } catch {
    return null;
  }
}
