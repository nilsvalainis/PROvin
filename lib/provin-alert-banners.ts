/**
 * Dinamiskie brīdinājuma baneri (PDF + admin) — krāsa atbilst avotu līmenim (dzeltens / sarkans).
 */

import {
  ltabRowHasData,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
  type TirgusFormFields,
} from "@/lib/admin-source-blocks";
import { shouldShowListedForSaleCriticalBanner } from "@/lib/tirgus-listed-ui";
import {
  getNextInspectionDateUiFlag,
  getParticulateMatterUiFlag,
  type CsddFieldUiFlag,
} from "@/lib/csdd-ui-flags";
import { aggregateLossAmountFlags } from "@/lib/loss-amount-ui";
import {
  collectUnifiedMileageRows,
  computeOdometerAnomalyBySourceOrder,
  filterDuplicateOdometerKmReadings,
  hasAnyOdometerAnomaly,
  type UnifiedMileageRow,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";
import {
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { computeLatviaRegistrationTenure } from "@/lib/latvia-registration-tenure";
import { ccVinAlertChecks, type CcVinBlockState, type CcVinCheckRow } from "@/lib/cc-vin-report";

export type ProvinInfoBannerKind = "lv_registration_tenure";

export type ProvinAlertBannerKind =
  | "odometer"
  | "tirgus_high_supply"
  | "incidents"
  | "particulate"
  | "inspection";

/** Starptautiskās vēstures brīdinājums — `ccvin:` + stabils slugs no reģistra nosaukuma. */
export type ProvinCcVinBannerKind = `ccvin:${string}`;

export type ProvinBannerKind = ProvinAlertBannerKind | ProvinInfoBannerKind | ProvinCcVinBannerKind;

const CCVIN_BANNER_KIND_RE = /^ccvin:[a-z0-9_]{1,40}$/;

export function isCcVinBannerKind(raw: string): raw is ProvinCcVinBannerKind {
  return CCVIN_BANNER_KIND_RE.test(raw);
}

/** Stabils banera `kind` no reģistra etiķetes, lai labojumi saglabātos pēc atkārtotas ielādes. */
export function ccVinBannerKindFromLabel(label: string): ProvinCcVinBannerKind {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `ccvin:${slug || "check"}`;
}

/** Manuāli pievienoti augšējās joslas brīdinājumi (admin). */
export type ProvinManualBannerSeverity = "grey" | "yellow" | "red";

export type ProvinManualBanner = {
  id: string;
  text: string;
  severity: ProvinManualBannerSeverity;
  /** Kartītes virsraksts kopsavilkumā; tukšs → noklusējums pēc krāsas. */
  title?: string;
  /** Kartītes galvenā vērtība (īsa atbilde, piem. „Nav ierakstu”). */
  value?: string;
  /** `false` = nerādīt PDF; trūkstošs vai `true` = rādīt. */
  includeInPdf?: boolean;
  /**
   * Ja aizpildīts, ieraksts nav patstāvīgs baneris, bet **aprēķinātā** brīdinājuma labojums:
   * tukšie lauki paliek pēc noklusējuma, aizpildītie pārraksta aprēķināto tekstu / krāsu.
   */
  kind?: ProvinBannerKind;
};

/** `false` = neiekļaut PDF; trūkstošs vai `true` = rādīt (noklusējums). */
export type ProvinBannerPdfInclude = Partial<Record<ProvinBannerKind, boolean>>;

export const PROVIN_ALERT_BANNER_KINDS = [
  "odometer",
  "tirgus_high_supply",
  "incidents",
  "particulate",
  "inspection",
] as const satisfies readonly ProvinAlertBannerKind[];

export const PROVIN_INFO_BANNER_KINDS = [
  "lv_registration_tenure",
] as const satisfies readonly ProvinInfoBannerKind[];

const MANUAL_BANNER_SEVERITIES = new Set<ProvinManualBannerSeverity>(["grey", "yellow", "red"]);

const PROVIN_BANNER_KINDS = new Set<ProvinBannerKind>([
  ...PROVIN_ALERT_BANNER_KINDS,
  ...PROVIN_INFO_BANNER_KINDS,
]);

export function isProvinBannerKind(raw: string): raw is ProvinBannerKind {
  return PROVIN_BANNER_KINDS.has(raw as ProvinBannerKind) || isCcVinBannerKind(raw);
}

/** Aprēķinātā brīdinājuma labojums glabājas tajā pašā sarakstā ar šādu id. */
export function provinBannerOverrideId(kind: ProvinBannerKind): string {
  return `kind:${kind}`;
}

export function isProvinBannerOverride(b: ProvinManualBanner): boolean {
  return typeof b.kind === "string" && isProvinBannerKind(b.kind);
}

export function isProvinBannerIncludedInPdf(
  kind: ProvinBannerKind,
  settings?: ProvinBannerPdfInclude | null,
): boolean {
  return settings?.[kind] !== false;
}

export function mergeProvinBannerPdfInclude(raw: unknown): ProvinBannerPdfInclude {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: ProvinBannerPdfInclude = {};
  for (const [key, value] of Object.entries(o)) {
    if (typeof value === "boolean" && isProvinBannerKind(key)) out[key] = value;
  }
  return out;
}

export function mergeProvinManualBanners(raw: unknown): ProvinManualBanner[] {
  if (!Array.isArray(raw)) return [];
  const out: ProvinManualBanner[] = [];
  const seenKinds = new Set<ProvinBannerKind>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = typeof o.kind === "string" && isProvinBannerKind(o.kind) ? o.kind : null;
    const id = kind ? provinBannerOverrideId(kind) : typeof o.id === "string" ? o.id.trim() : "";
    const text = typeof o.text === "string" ? o.text : "";
    const severity = o.severity;
    if (!id) continue;
    if (kind && seenKinds.has(kind)) continue;
    if (typeof severity !== "string" || !MANUAL_BANNER_SEVERITIES.has(severity as ProvinManualBannerSeverity)) {
      continue;
    }
    const banner: ProvinManualBanner = {
      id: id.slice(0, 64),
      text: text.slice(0, 2000),
      severity: severity as ProvinManualBannerSeverity,
    };
    if (typeof o.title === "string" && o.title.trim()) banner.title = o.title.trim().slice(0, 80);
    if (typeof o.value === "string" && o.value.trim()) banner.value = o.value.trim().slice(0, 80);
    if (typeof o.includeInPdf === "boolean") banner.includeInPdf = o.includeInPdf;
    if (kind) {
      banner.kind = kind;
      seenKinds.add(kind);
    }
    out.push(banner);
  }
  return out.slice(0, 48);
}

/** Tikai operatora pašrocīgi veidotie baneri (bez aprēķināto brīdinājumu labojumiem). */
export function ownManualBanners(banners: ProvinManualBanner[]): ProvinManualBanner[] {
  return banners.filter((b) => !isProvinBannerOverride(b));
}

export function filterManualBannersForPdf(banners: ProvinManualBanner[]): ProvinManualBanner[] {
  return ownManualBanners(banners).filter(
    (b) =>
      b.includeInPdf !== false &&
      (b.text.trim().length > 0 || (b.value ?? "").trim().length > 0 || (b.title ?? "").trim().length > 0),
  );
}

/** Aprēķinātā brīdinājuma labojums pēc veida. */
export function provinBannerOverrideFor(
  banners: ProvinManualBanner[] | null | undefined,
  kind: ProvinBannerKind,
): ProvinManualBanner | null {
  return (banners ?? []).find((b) => b.kind === kind) ?? null;
}

/** Izveido vai atjauno aprēķinātā brīdinājuma labojumu; `null` patch → noklusējums (labojums tiek dzēsts). */
export function upsertProvinBannerOverride(
  banners: ProvinManualBanner[],
  kind: ProvinBannerKind,
  patch: Partial<Omit<ProvinManualBanner, "id" | "kind">> | null,
): ProvinManualBanner[] {
  if (patch === null) return banners.filter((b) => b.kind !== kind);
  const existing = provinBannerOverrideFor(banners, kind);
  const next: ProvinManualBanner = {
    ...(existing ?? { id: provinBannerOverrideId(kind), text: "", severity: "grey" }),
    ...patch,
    id: provinBannerOverrideId(kind),
    kind,
  };
  if (existing) return banners.map((b) => (b.kind === kind ? next : b));
  return [...banners, next];
}

export function createEmptyManualBanner(severity: ProvinManualBannerSeverity = "grey"): ProvinManualBanner {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { id, title: "", value: "", text: "", severity, includeInPdf: true };
}

export function filterAlertBannersForPdf(
  banners: ProvinAlertBanner[],
  settings?: ProvinBannerPdfInclude | null,
): ProvinAlertBanner[] {
  return banners.filter((b) => isProvinBannerIncludedInPdf(b.kind, settings));
}

export function filterInfoBannersForPdf(
  banners: ProvinInfoBanner[],
  settings?: ProvinBannerPdfInclude | null,
): ProvinInfoBanner[] {
  return banners.filter((b) => isProvinBannerIncludedInPdf(b.kind, settings));
}

export type ProvinInfoBanner = {
  kind: ProvinInfoBannerKind;
  /** Pilns teikums (admin saraksts). */
  text: string;
  /** Kopsavilkuma kartīte PDF: virsraksts, galvenā vērtība, paskaidrojums. */
  label: string;
  value: string;
  note: string;
};

/** Banera vizuālais līmenis — sakrīt ar avotu dzelteno/sarkano. */
export type ProvinAlertSeverity = "red" | "yellow";

export type ProvinAlertBanner = {
  kind: ProvinAlertBannerKind | ProvinCcVinBannerKind;
  text: string;
  severity: ProvinAlertSeverity;
  /** Kopsavilkuma kartīte starptautiskās vēstures brīdinājumam (fiksētajiem veidiem — `PROVIN_ALERT_CARD_DEFAULTS`). */
  card?: ProvinBannerCardCopy;
};

export const PROVIN_ALERT_TEXT = {
  odometer:
    "Uzmanību! Transportlīdzekļa vēsturē konstatētas odometra rādījumu neatbilstības (anomālijas).",
  tirgus_high_supply:
    "Brīdinājums: Transportlīdzeklis tirgū atrodas neierasti ilgi (virs 200 dienām), kas var liecināt par zemu likviditāti vai slēptiem defektiem.",
  incidents:
    "Brīdinājums: Transportlīdzeklim reģistrēti ceļu satiksmes negadījumi vai fiksēti būtiski zaudējumu atlīdzības prasījumi.",
  particulate:
    "Uzmanību! Pēdējā apskatē fiksēts paaugstināts atgāzu cieto daļiņu līmenis, kas var norādīt uz izplūdes sistēmas defektiem.",
  inspection:
    "Brīdinājums: Transportlīdzeklim nav derīgas tehniskās apskates vai tās termiņš drīzumā beidzas.",
} as const;

/** Kopsavilkuma kartītes teksti. */
export type ProvinBannerCardCopy = { label: string; value: string; note: string };

/**
 * Noklusējuma kartīte katram aprēķinātajam brīdinājumam kopsavilkumā.
 * `null` — kartīti nerāda, jo tie paši dati jau ir bāzes plāksnītē (odometrs, negadījumi).
 */
export const PROVIN_ALERT_CARD_DEFAULTS: Record<ProvinAlertBannerKind, ProvinBannerCardCopy | null> = {
  odometer: null,
  incidents: null,
  tirgus_high_supply: {
    label: "Sludinājuma vecums",
    value: "Ilgi pārdošanā",
    note: "Tirgū virs 200 dienām — iespējama zema likviditāte vai slēpti defekti",
  },
  particulate: {
    label: "Izplūdes cietās daļiņas",
    value: "Paaugstināts līmenis",
    note: "Pēdējā apskatē fiksēts pārsniegums — iespējami izplūdes sistēmas defekti",
  },
  inspection: {
    label: "Tehniskā apskate",
    value: "Termiņš beidzas",
    note: "Nav derīgas apskates vai tās termiņš tuvojas beigām",
  },
};

/** Kartītes virsraksts, ja ne noklusējums, ne operators to nav norādījis. */
export const PROVIN_BANNER_DEFAULT_LABEL: Record<ProvinManualBannerSeverity, string> = {
  grey: "Informācija",
  yellow: "Brīdinājums",
  red: "Svarīgi",
};

/** Aprēķinātais brīdinājums pēc operatora labojumiem — vienots skats admin joslai un PDF kartītei. */
export type ProvinResolvedBanner = {
  kind: ProvinBannerKind;
  /** Joslas teksts admin panelī (labojums vai aprēķinātais teikums). */
  text: string;
  severity: ProvinManualBannerSeverity;
  /** Kopsavilkuma kartīte; `null` — kartīti nerāda. */
  card: ProvinBannerCardCopy | null;
  /** Aprēķinātie noklusējumi (redaktora placeholderiem un „atjaunot noklusējumu”). */
  defaults: { text: string; severity: ProvinManualBannerSeverity; card: ProvinBannerCardCopy | null };
  /** Operatora labojums, ja tāds ir saglabāts. */
  override: ProvinManualBanner | null;
  /** Labojums tiešām maina saturu (nevis tikai tukšs ieraksts). */
  edited: boolean;
};

function bannerOverrideChangesAnything(
  override: ProvinManualBanner | null,
  computedSeverity: ProvinManualBannerSeverity,
): boolean {
  if (!override) return false;
  if (override.severity !== computedSeverity) return true;
  return Boolean((override.title ?? "").trim() || (override.value ?? "").trim() || override.text.trim());
}

function alertSeverityToManual(s: ProvinAlertSeverity): ProvinManualBannerSeverity {
  return s === "red" ? "red" : "yellow";
}

function resolveBannerCard(
  defaults: ProvinBannerCardCopy | null,
  override: ProvinManualBanner | null,
  severity: ProvinManualBannerSeverity,
): ProvinBannerCardCopy | null {
  const title = (override?.title ?? "").trim();
  const value = (override?.value ?? "").trim();
  const note = (override?.text ?? "").trim();
  if (!defaults && !title && !value && !note) return null;
  return {
    label: title || defaults?.label || PROVIN_BANNER_DEFAULT_LABEL[severity],
    value: value || defaults?.value || "",
    note: note || defaults?.note || "",
  };
}

/**
 * Aprēķinātie brīdinājumi + informatīvie ieraksti vienā sarakstā tādā secībā, kādā tie drukājas PDF.
 * Labojumi (`manualBanners` ieraksti ar `kind`) pārraksta tekstu, kartītes laukus un krāsu.
 */
export function resolveProvinBanners(args: {
  alertBanners?: ProvinAlertBanner[] | null;
  infoBanners?: ProvinInfoBanner[] | null;
  manualBanners?: ProvinManualBanner[] | null;
}): ProvinResolvedBanner[] {
  const out: ProvinResolvedBanner[] = [];

  for (const kind of PROVIN_ALERT_BANNER_KINDS) {
    const computed = (args.alertBanners ?? []).find((b) => b.kind === kind);
    if (!computed) continue;
    const override = provinBannerOverrideFor(args.manualBanners, kind);
    const computedSeverity = alertSeverityToManual(computed.severity);
    const severity = override?.severity ?? computedSeverity;
    const defaultCard = PROVIN_ALERT_CARD_DEFAULTS[kind];
    out.push({
      kind,
      text: (override?.text ?? "").trim() || computed.text,
      severity,
      card: resolveBannerCard(defaultCard, override, severity),
      defaults: { text: computed.text, severity: computedSeverity, card: defaultCard },
      override,
      edited: bannerOverrideChangesAnything(override, computedSeverity),
    });
  }

  for (const computed of args.alertBanners ?? []) {
    if (!isCcVinBannerKind(computed.kind)) continue;
    const override = provinBannerOverrideFor(args.manualBanners, computed.kind);
    const computedSeverity = alertSeverityToManual(computed.severity);
    const severity = override?.severity ?? computedSeverity;
    const defaultCard = computed.card ?? null;
    out.push({
      kind: computed.kind,
      text: (override?.text ?? "").trim() || computed.text,
      severity,
      card: resolveBannerCard(defaultCard, override, severity),
      defaults: { text: computed.text, severity: computedSeverity, card: defaultCard },
      override,
      edited: bannerOverrideChangesAnything(override, computedSeverity),
    });
  }

  for (const kind of PROVIN_INFO_BANNER_KINDS) {
    const computed = (args.infoBanners ?? []).find((b) => b.kind === kind);
    if (!computed) continue;
    const override = provinBannerOverrideFor(args.manualBanners, kind);
    const severity = override?.severity ?? "grey";
    const defaultCard: ProvinBannerCardCopy = {
      label: computed.label,
      value: computed.value,
      note: computed.note,
    };
    out.push({
      kind,
      text: (override?.text ?? "").trim() || computed.text,
      severity,
      card: resolveBannerCard(defaultCard, override, severity),
      defaults: { text: computed.text, severity: "grey", card: defaultCard },
      override,
      edited: bannerOverrideChangesAnything(override, "grey"),
    });
  }

  return out;
}

function flagToSeverity(f: Exclude<CsddFieldUiFlag, "none">): ProvinAlertSeverity {
  return f === "red" ? "red" : "yellow";
}

function collectIncidentRows(
  ltab: ClientManualLtabBlockPdf | null | undefined,
  vendors: ClientManualVendorBlockPdf[] | undefined,
): { lossAmount: string }[] {
  const out: { lossAmount: string }[] = [];
  for (const r of ltab?.rows ?? []) {
    if (ltabRowHasData(r)) out.push({ lossAmount: r.lossAmount });
  }
  for (const b of vendors ?? []) {
    for (const r of b.incidentRows) {
      if (ltabRowHasData(r)) out.push({ lossAmount: r.lossAmount });
    }
  }
  return out;
}

/**
 * Negadījumu banera severitāte: balstīta uz „Zaudējumu summa” laukiem.
 * Ja rindas ir, bet visas summas tukšas → dzeltens (brīdinājums bez skaitliskās summas).
 */
export function computeIncidentBannerSeverity(
  ltab: ClientManualLtabBlockPdf | null | undefined,
  vendors: ClientManualVendorBlockPdf[] | undefined,
): ProvinAlertSeverity | null {
  const rows = collectIncidentRows(ltab, vendors);
  if (rows.length === 0) return null;
  const agg = aggregateLossAmountFlags(rows.map((r) => r.lossAmount));
  if (agg === "red") return "red";
  if (agg === "yellow") return "yellow";
  return "yellow";
}

export function shouldShowIncidentBanner(
  ltab: ClientManualLtabBlockPdf | null | undefined,
  vendors: ClientManualVendorBlockPdf[] | undefined,
): boolean {
  return collectIncidentRows(ltab, vendors).length > 0;
}

export function computeProvinAlertBanners(args: {
  unifiedMileageRows: UnifiedMileageRow[];
  csddForm: CsddFormFields | null | undefined;
  manualLtabBlock: ClientManualLtabBlockPdf | null | undefined;
  manualVendorBlocks: ClientManualVendorBlockPdf[] | undefined;
  tirgusForm?: TirgusFormFields | null;
  ccVinBlock?: CcVinBlockState | null;
  referenceDate?: Date;
}): ProvinAlertBanner[] {
  const ref = args.referenceDate ?? new Date();
  const out: ProvinAlertBanner[] = [];

  const anomalyMap = computeOdometerAnomalyBySourceOrder(args.unifiedMileageRows);
  if (hasAnyOdometerAnomaly(anomalyMap)) {
    out.push({ kind: "odometer", text: PROVIN_ALERT_TEXT.odometer, severity: "red" });
  }

  if (args.tirgusForm && shouldShowListedForSaleCriticalBanner(args.tirgusForm.listedForSale)) {
    out.push({
      kind: "tirgus_high_supply",
      text: PROVIN_ALERT_TEXT.tirgus_high_supply,
      severity: "red",
    });
  }

  const incSev = computeIncidentBannerSeverity(args.manualLtabBlock, args.manualVendorBlocks);
  if (incSev !== null) {
    out.push({ kind: "incidents", text: PROVIN_ALERT_TEXT.incidents, severity: incSev });
  }

  const pm = args.csddForm?.particulateMatter?.trim() ?? "";
  if (pm) {
    const f = getParticulateMatterUiFlag(pm);
    if (f !== "none") {
      out.push({ kind: "particulate", text: PROVIN_ALERT_TEXT.particulate, severity: flagToSeverity(f) });
    }
  }

  const next = args.csddForm?.nextInspectionDate?.trim() ?? "";
  if (next) {
    const f = getNextInspectionDateUiFlag(next, ref);
    if (f !== "none") {
      out.push({ kind: "inspection", text: PROVIN_ALERT_TEXT.inspection, severity: flagToSeverity(f) });
    }
  }

  out.push(...computeCcVinAlertBanners(args.ccVinBlock));

  return out;
}

const CC_VIN_BANNER_NOTE = "Starptautiskajos vēstures reģistros fiksēta atzīme.";

export function computeCcVinAlertBanners(block: CcVinBlockState | null | undefined): ProvinAlertBanner[] {
  const seen = new Set<string>();
  const out: ProvinAlertBanner[] = [];
  for (const check of ccVinAlertChecks(block)) {
    const kind = ccVinBannerKindFromLabel(check.label);
    if (seen.has(kind)) continue;
    seen.add(kind);
    out.push(ccVinCheckToBanner(check, kind));
  }
  return out;
}

function ccVinCheckToBanner(check: CcVinCheckRow, kind: ProvinCcVinBannerKind): ProvinAlertBanner {
  const label = check.label.trim();
  const status = check.status.trim() || "Atrasts ieraksts";
  return {
    kind,
    text: `${label}: ${status}`,
    severity: "red",
    card: {
      label,
      value: status,
      note: CC_VIN_BANNER_NOTE,
    },
  };
}

/** Payload ar tiem pašiem laukiem kā `ClientReportPayload` nobraukuma daļai. */
export function computeProvinAlertBannersFromPayloadSlice(
  p: UnifiedMileageSourcePayload & {
    csddForm?: CsddFormFields | null;
    manualLtabBlock?: ClientManualLtabBlockPdf | null;
    manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
    tirgusForm?: TirgusFormFields | null;
  },
  referenceDate?: Date,
): ProvinAlertBanner[] {
  const rows = filterDuplicateOdometerKmReadings(collectUnifiedMileageRows(p));
  return computeProvinAlertBanners({
    unifiedMileageRows: rows,
    csddForm: p.csddForm,
    manualLtabBlock: p.manualLtabBlock,
    manualVendorBlocks: p.manualVendorBlocks ?? undefined,
    tirgusForm: p.tirgusForm,
    ccVinBlock: p.ccVinBlock,
    referenceDate,
  });
}

export function computeProvinInfoBannersFromPayloadSlice(
  p: UnifiedMileageSourcePayload & {
    csddForm?: CsddFormFields | null;
    manualLtabBlock?: ClientManualLtabBlockPdf | null;
    manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
    autoRecordsBlock?: import("@/lib/admin-source-blocks").AutoRecordsBlockState | null;
    citiAvotiBlock?: import("@/lib/admin-source-blocks").CitiAvotiBlockState | null;
  },
  referenceDate?: Date,
): ProvinInfoBanner[] {
  const out: ProvinInfoBanner[] = [];

  const tenure = computeLatviaRegistrationTenure({
    csddForm: p.csddForm,
    autoRecordsBlock: p.autoRecordsBlock ?? null,
    manualVendorBlocks: p.manualVendorBlocks ?? null,
    manualLtabBlock: p.manualLtabBlock ?? null,
    referenceDate,
  });
  if (tenure) {
    const days = tenure.daysRegistered;
    out.push({
      kind: "lv_registration_tenure",
      text: tenure.sentence,
      label: "Reģistrācija Latvijā",
      value: `${days} ${days === 1 ? "diena" : "dienas"}`,
      note: tenure.firstDateDisplay ? `Kopš ${tenure.firstDateDisplay}` : "",
    });
  }

  return out;
}

export function computeProvinInfoBannersFromWorkspace(
  ws: WorkspaceSourceBlocks,
  referenceDate?: Date,
): ProvinInfoBanner[] {
  return computeProvinInfoBannersFromPayloadSlice(
    {
      csddForm: ws.csdd,
      autoRecordsBlock: ws.auto_records,
      ccVinBlock: ws.cc_vin,
      manualVendorBlocks: toPdfManualVendorBlocks(ws),
      manualLtabBlock: toPdfLtabManualBlock(ws.ltab),
      citiAvotiBlock: ws.citi_avoti,
    },
    referenceDate,
  );
}

export function computeProvinAlertBannersFromWorkspace(
  ws: WorkspaceSourceBlocks,
  referenceDate?: Date,
): ProvinAlertBanner[] {
  return computeProvinAlertBannersFromPayloadSlice(
    {
      csddForm: ws.csdd,
      autoRecordsBlock: ws.auto_records,
      ccVinBlock: ws.cc_vin,
      manualVendorBlocks: toPdfManualVendorBlocks(ws),
      citiAvotiBlock: ws.citi_avoti,
      manualLtabBlock: toPdfLtabManualBlock(ws.ltab),
      tirgusForm: ws.tirgus,
    },
    referenceDate,
  );
}
