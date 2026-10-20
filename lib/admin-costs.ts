/**
 * Admin izmaksu sadaļa (PRO + IRISS): katalogs, formāts un mēneša kopsavilkums.
 * Viens datu slānis. UI tēmas: `AdminCostsView` ar `workspace` pro | iriss.
 * Bez tīkla un bez noslēpumiem: der arī pārlūka komponentam.
 */

import {
  formatLvMonthTitle,
  formatYearMonthKey,
  parseYearMonthKey,
  rigaDaysInMonth,
  rigaMonthDayNumber,
  rigaYearMonthKey,
  shiftYearMonth,
} from "@/lib/admin-riga-calendar";

export const COST_GROUP_IDS = ["ai", "api", "google", "infra", "payments"] as const;
export type CostGroupId = (typeof COST_GROUP_IDS)[number];

export const COST_SOURCE_IDS = [
  "anthropic",
  "gemini",
  "apify",
  "carfax",
  "autodna",
  "carvertical",
  "statvin",
  "maps-dynamic",
  "maps-geocoding",
  "vercel",
  "fixie",
  "stripe",
] as const;
export type CostSourceId = (typeof COST_SOURCE_IDS)[number];

export type CostFreshness = "live" | "hourly" | "daily";
export type CostDataMode = "events" | "marketplace" | "snapshot";
export type CostLimitSource = "account" | "budget" | "manual";
export type CostAlertLevel = 80 | 100;

export type CostEvent = {
  id: string;
  source: CostSourceId;
  sku: string;
  units: number;
  usd: number;
  ref: string;
  createdAt: string;
};

export type CostLimit = {
  source: CostSourceId;
  sku: string;
  period: "month" | "call";
  limitUsd: number | null;
  limitUnits: number | null;
  hard: boolean;
  sourceOfLimit: CostLimitSource;
  readAt: string | null;
};

export type CostSnapshot = {
  source: CostSourceId;
  sku: string;
  period: string;
  usd: number;
  units: number;
  fetchedAt: string;
  origin: "api" | "manual" | "agent";
};

export type CostSourceDef = {
  id: CostSourceId;
  group: CostGroupId;
  label: string;
  subtitle: string;
  freshness: CostFreshness;
  dataMode: CostDataMode;
  unitLabel: string;
  unitLabelOne: string;
  liveApi: "none" | "apify" | "stripe" | "vercel" | "anthropic-admin";
  defaultOpen?: boolean;
  defaultLimitUnits?: number;
  hardDefault?: boolean;
  googleQuota?: boolean;
};

export type CostGroupDef = {
  id: CostGroupId;
  label: string;
  defaultOpen: boolean;
  dot: string;
};

export const COST_GROUPS: readonly CostGroupDef[] = [
  { id: "ai", label: "AI aģenti", defaultOpen: true, dot: "#1d1d1f" },
  { id: "api", label: "API avoti", defaultOpen: true, dot: "#636366" },
  { id: "google", label: "Google", defaultOpen: true, dot: "#8e8e93" },
  { id: "infra", label: "Infrastruktūra", defaultOpen: true, dot: "#aeaeb2" },
  { id: "payments", label: "Maksājumi", defaultOpen: false, dot: "#c7c7cc" },
];

export type AdminCostsWorkspace = "pro" | "iriss";

export const ADMIN_COSTS_HREF: Record<AdminCostsWorkspace, string> = {
  pro: "/admin/izmaksas",
  iriss: "/admin/iriss/izmaksas",
};

export function adminCostsHref(workspace: AdminCostsWorkspace): string {
  return ADMIN_COSTS_HREF[workspace];
}

export function adminCostsChrome(workspace: AdminCostsWorkspace): {
  crumb: string;
  brand: string;
  subtitle: string;
} {
  if (workspace === "iriss") {
    return {
      crumb: "Vairāk · IRISS admin · Pārvaldība",
      brand: "IRISS",
      subtitle: "IRISS · visi projekti",
    };
  }
  return {
    crumb: "Vairāk · PRO admin · Pārvaldība",
    brand: "PRO",
    subtitle: "PRO · visi projekti",
  };
}

/** PRO: neitrāli pelēki. IRISS: zilas grupu krāsas no 00-tema --acc. */
export const COST_GROUP_DOTS: Record<AdminCostsWorkspace, Record<CostGroupId, string>> = {
  pro: { ai: "#1d1d1f", api: "#636366", google: "#8e8e93", infra: "#aeaeb2", payments: "#c7c7cc" },
  iriss: { ai: "#3d5bd9", api: "#5b7ae8", google: "#8b9eef", infra: "#b7c2e3", payments: "#c5c9d4" },
};

export function costGroupDot(id: CostGroupId, workspace: AdminCostsWorkspace): string {
  return COST_GROUP_DOTS[workspace][id];
}

export function costGroupDotVar(id: CostGroupId): string {
  return `var(--costs-dot-${id})`;
}

export const COST_SOURCES: readonly CostSourceDef[] = [
  {
    id: "anthropic",
    group: "ai",
    label: "Anthropic Claude (pasūtījumu AI)",
    subtitle: "tokeni, aprēķins no lietojuma",
    freshness: "live",
    dataMode: "events",
    unitLabel: "tokeni",
    unitLabelOne: "tokeni",
    liveApi: "anthropic-admin",
  },
  {
    id: "gemini",
    group: "ai",
    label: "Google Gemini",
    subtitle: "tokeni",
    freshness: "live",
    dataMode: "events",
    unitLabel: "tokeni",
    unitLabelOne: "tokeni",
    liveApi: "none",
  },
  {
    id: "apify",
    group: "api",
    label: "Apify (mobile.de, AutoScout24)",
    subtitle: "ielādes",
    freshness: "live",
    dataMode: "marketplace",
    unitLabel: "ielādes",
    unitLabelOne: "ielāde",
    liveApi: "apify",
    hardDefault: true,
  },
  {
    id: "carfax",
    group: "api",
    label: "CarFax",
    subtitle: "atskaites",
    freshness: "live",
    dataMode: "events",
    unitLabel: "atskaites",
    unitLabelOne: "atskaite",
    liveApi: "none",
  },
  {
    id: "autodna",
    group: "api",
    label: "AutoDNA",
    subtitle: "atskaites",
    freshness: "live",
    dataMode: "events",
    unitLabel: "atskaites",
    unitLabelOne: "atskaite",
    liveApi: "none",
  },
  {
    id: "carvertical",
    group: "api",
    label: "carVertical",
    subtitle: "atskaites",
    freshness: "live",
    dataMode: "events",
    unitLabel: "atskaites",
    unitLabelOne: "atskaite",
    liveApi: "none",
  },
  {
    id: "statvin",
    group: "api",
    label: "stat.vin",
    subtitle: "pieprasījumi",
    freshness: "live",
    dataMode: "events",
    unitLabel: "pieprasījumi",
    unitLabelOne: "pieprasījums",
    liveApi: "none",
  },
  {
    id: "maps-dynamic",
    group: "google",
    label: "Maps - Dynamic Maps",
    subtitle: "bezmaksas kvota",
    freshness: "hourly",
    dataMode: "snapshot",
    unitLabel: "mēn.",
    unitLabelOne: "mēn.",
    liveApi: "none",
    defaultLimitUnits: 10_000,
    hardDefault: true,
    googleQuota: true,
  },
  {
    id: "maps-geocoding",
    group: "google",
    label: "Maps - Geocoding",
    subtitle: "bezmaksas kvota",
    freshness: "hourly",
    dataMode: "snapshot",
    unitLabel: "mēn.",
    unitLabelOne: "mēn.",
    liveApi: "none",
    defaultLimitUnits: 10_000,
    hardDefault: true,
    googleQuota: true,
  },
  {
    id: "vercel",
    group: "infra",
    label: "Vercel",
    subtitle: "Pro plāns",
    freshness: "daily",
    dataMode: "snapshot",
    unitLabel: "mēn.",
    unitLabelOne: "mēn.",
    liveApi: "vercel",
  },
  {
    id: "fixie",
    group: "infra",
    label: "Fixie (proxy)",
    subtitle: "plāns",
    freshness: "daily",
    dataMode: "snapshot",
    unitLabel: "mēn.",
    unitLabelOne: "mēn.",
    liveApi: "none",
  },
  {
    id: "stripe",
    group: "payments",
    label: "Stripe komisijas",
    subtitle: "Balance Transactions",
    freshness: "daily",
    dataMode: "snapshot",
    unitLabel: "mēn.",
    unitLabelOne: "mēn.",
    liveApi: "stripe",
  },
];

const SOURCE_BY_ID = new Map(COST_SOURCES.map((s) => [s.id, s]));

export function costSourceDef(id: string): CostSourceDef | null {
  return SOURCE_BY_ID.get(id as CostSourceId) ?? null;
}

export function isCostSourceId(v: string): v is CostSourceId {
  return SOURCE_BY_ID.has(v as CostSourceId);
}

export type CostSourceView = {
  id: CostSourceId;
  group: CostGroupId;
  label: string;
  subtitle: string;
  usd: number;
  units: number;
  percent: number;
  limitUsd: number | null;
  limitUnits: number | null;
  remainingUsd: number | null;
  remainingUnits: number | null;
  hard: boolean;
  sourceOfLimit: CostLimitSource | null;
  freshness: CostFreshness;
  badge: "live" | "updated";
  updatedAt: string | null;
  googleQuota: boolean;
  perRunUsd: number | null;
  editable: boolean;
  liveApi: CostSourceDef["liveApi"];
};

export type CostGroupView = {
  id: CostGroupId;
  label: string;
  dot: string;
  defaultOpen: boolean;
  usd: number;
  percent: number;
  sourceCount: number;
  sources: CostSourceView[];
};

export type CostAlert = {
  source: CostSourceId;
  label: string;
  level: CostAlertLevel;
  percent: number;
  usd: number;
  limitUsd: number | null;
  units: number;
  limitUnits: number | null;
  hard: boolean;
};

export type CostDashboard = {
  month: string;
  prevMonth: string;
  nextMonth: string | null;
  monthTitle: string;
  prevMonthTitle: string;
  rangeLabel: string;
  totalUsd: number;
  groups: CostGroupView[];
  alerts: CostAlert[];
  footnote: string;
};

const LV_MONTH_LOCATIVE = [
  "janvārī",
  "februārī",
  "martā",
  "aprīlī",
  "maijā",
  "jūnijā",
  "jūlijā",
  "augustā",
  "septembrī",
  "oktobrī",
  "novembrī",
  "decembrī",
] as const;

export function formatAdminCostUsd(usd: number): string {
  const n = Number.isFinite(usd) ? usd : 0;
  return `${n.toFixed(2).replace(".", ",")} $`;
}

export function formatAdminCostPercent(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return "0 %";
  return `${Math.round(pct)} %`;
}

export function formatAdminCostInt(n: number): string {
  const v = Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatCostUpdatedBadge(iso: string | null | undefined, nowMs = Date.now()): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return "";
  void nowMs;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `atjaunināts ${get("day")}.${get("month")}. ${get("hour")}:${get("minute")}`;
}

export function roundCostUsd(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export function costUsagePercent(used: number, limit: number | null | undefined): number | null {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return null;
  if (!Number.isFinite(used) || used < 0) return 0;
  return (used / limit) * 100;
}

export function costAlertLevel(percent: number | null): CostAlertLevel | null {
  if (percent == null) return null;
  if (percent >= 100 - 1e-9) return 100;
  if (percent >= 80 - 1e-9) return 80;
  return null;
}

export function costMonthKeys(nowMs = Date.now()): { current: string; previous: string } {
  const key = rigaYearMonthKey(nowMs);
  const parsed = parseYearMonthKey(key) ?? { year: 1970, month: 1 };
  const prev = shiftYearMonth(parsed.year, parsed.month, -1);
  return { current: key, previous: formatYearMonthKey(prev.year, prev.month) };
}

export function resolveCostMonth(raw: string | null | undefined, nowMs = Date.now()): string {
  const allowed = costMonthKeys(nowMs);
  if (raw === allowed.previous || raw === allowed.current) return raw;
  const parsed = parseYearMonthKey(raw);
  if (!parsed) return allowed.current;
  const key = formatYearMonthKey(parsed.year, parsed.month);
  if (key > allowed.current) return allowed.current;
  return key;
}

export function costMonthRangeLabel(month: string, nowMs = Date.now()): string {
  const parsed = parseYearMonthKey(month);
  if (!parsed) return "";
  const loc = LV_MONTH_LOCATIVE[parsed.month - 1] ?? month;
  const last = rigaDaysInMonth(parsed.year, parsed.month);
  const currentKey = rigaYearMonthKey(nowMs);
  const endDay = month === currentKey ? Math.min(last, rigaMonthDayNumber(nowMs)) : last;
  const mm = String(parsed.month).padStart(2, "0");
  return `Kopā ${loc} (1.-${endDay}.${mm})`;
}

function unitsPhrase(def: CostSourceDef, units: number): string {
  if (def.googleQuota) return "";
  if (!Number.isFinite(units) || units <= 0) return "";
  const n = Math.round(units);
  const word = n === 1 ? def.unitLabelOne : def.unitLabel;
  if (def.id === "anthropic" || def.id === "gemini") return "";
  return `${formatAdminCostInt(n)} ${word}`;
}

function pickLimit(limits: readonly CostLimit[], source: CostSourceId, sku = ""): CostLimit | null {
  const exact = limits.find((l) => l.source === source && l.sku === sku && l.period === "month");
  if (exact) return exact;
  return limits.find((l) => l.source === source && !l.sku && l.period === "month") ?? null;
}

function pickSnapshot(snaps: readonly CostSnapshot[], source: CostSourceId, period: string, sku = ""): CostSnapshot | null {
  return snaps.find((s) => s.source === source && s.period === period && (s.sku || "") === sku) ?? null;
}

function sumEvents(events: readonly CostEvent[], source: CostSourceId): { usd: number; units: number } {
  let usd = 0;
  let units = 0;
  for (const e of events) {
    if (e.source !== source) continue;
    usd += Number.isFinite(e.usd) ? e.usd : 0;
    units += Number.isFinite(e.units) ? e.units : 0;
  }
  return { usd: roundCostUsd(usd), units };
}

export type CostMarketplaceMonth = {
  usd: number;
  units: number;
  capUsd: number;
  perRunUsd: number;
};

export type BuildCostDashboardInput = {
  month: string;
  nowMs: number;
  events: readonly CostEvent[];
  snapshots: readonly CostSnapshot[];
  limits: readonly CostLimit[];
  marketplace: CostMarketplaceMonth | null;
};

function sourceAmounts(
  def: CostSourceDef,
  input: BuildCostDashboardInput,
): { usd: number; units: number; updatedAt: string | null; badge: "live" | "updated"; perRunUsd: number | null } {
  const snap = pickSnapshot(input.snapshots, def.id, input.month);
  const fromEvents = sumEvents(input.events, def.id);
  if (def.dataMode === "marketplace") {
    const usd = input.marketplace?.usd ?? fromEvents.usd;
    const units = input.marketplace?.units ?? fromEvents.units;
    return {
      usd: roundCostUsd(usd),
      units,
      updatedAt: snap?.fetchedAt ?? null,
      badge: "live",
      perRunUsd: input.marketplace?.perRunUsd ?? null,
    };
  }
  if (snap) {
    return {
      usd: roundCostUsd(snap.usd),
      units: snap.units,
      updatedAt: snap.fetchedAt,
      badge: "updated",
      perRunUsd: null,
    };
  }
  if (def.dataMode === "events") {
    return {
      usd: fromEvents.usd,
      units: fromEvents.units,
      updatedAt: null,
      badge: "live",
      perRunUsd: null,
    };
  }
  return { usd: 0, units: 0, updatedAt: null, badge: "updated", perRunUsd: null };
}

export function buildCostDashboard(input: BuildCostDashboardInput): CostDashboard {
  const parsed = parseYearMonthKey(input.month) ?? { year: 1970, month: 1 };
  const prev = shiftYearMonth(parsed.year, parsed.month, -1);
  const next = shiftYearMonth(parsed.year, parsed.month, 1);
  const currentKey = rigaYearMonthKey(input.nowMs);
  const nextKey = formatYearMonthKey(next.year, next.month);
  const rows: CostSourceView[] = COST_SOURCES.map((def) => {
    const amounts = sourceAmounts(def, input);
    const limitRow = pickLimit(input.limits, def.id);
    let limitUsd = limitRow?.limitUsd ?? null;
    const limitUnits = limitRow?.limitUnits ?? (def.defaultLimitUnits ?? null);
    let hard = limitRow?.hard ?? Boolean(def.hardDefault);
    let sourceOfLimit = limitRow?.sourceOfLimit ?? (def.defaultLimitUnits ? "account" : null);
    if (def.id === "apify" && input.marketplace) {
      if (limitUsd == null) {
        limitUsd = input.marketplace.capUsd;
        sourceOfLimit = sourceOfLimit ?? "budget";
        hard = true;
      }
    }
    const remainingUsd = limitUsd != null ? roundCostUsd(Math.max(0, limitUsd - amounts.usd)) : null;
    const remainingUnits = limitUnits != null ? Math.max(0, Math.round(limitUnits - amounts.units)) : null;
    const extra: string[] = [];
    const unitLine = unitsPhrase(def, amounts.units);
    if (unitLine) extra.push(unitLine);
    if (def.id === "apify" && amounts.perRunUsd != null) {
      extra.push(`max ${formatAdminCostUsd(amounts.perRunUsd)} / ielādei`);
    }
    const subtitle = extra.length ? extra.join(" · ") : def.subtitle;
    return {
      id: def.id,
      group: def.group,
      label: def.label,
      subtitle,
      usd: amounts.usd,
      units: amounts.units,
      percent: 0,
      limitUsd,
      limitUnits,
      remainingUsd,
      remainingUnits,
      hard,
      sourceOfLimit,
      freshness: def.freshness,
      badge: amounts.badge,
      updatedAt: amounts.updatedAt ?? limitRow?.readAt ?? null,
      googleQuota: Boolean(def.googleQuota),
      perRunUsd: amounts.perRunUsd,
      editable: def.dataMode !== "marketplace",
      liveApi: def.liveApi,
    };
  });

  const totalUsd = roundCostUsd(rows.reduce((sum, r) => sum + r.usd, 0));
  for (const row of rows) {
    row.percent = totalUsd > 0 ? (row.usd / totalUsd) * 100 : 0;
  }

  const groups: CostGroupView[] = COST_GROUPS.map((g) => {
    const sources = rows.filter((r) => r.group === g.id);
    const usd = roundCostUsd(sources.reduce((sum, r) => sum + r.usd, 0));
    return {
      id: g.id,
      label: g.label,
      dot: g.dot,
      defaultOpen: g.defaultOpen,
      usd,
      percent: totalUsd > 0 ? (usd / totalUsd) * 100 : 0,
      sourceCount: sources.length,
      sources,
    };
  });

  const alerts = collectCostAlerts(rows);
  return {
    month: input.month,
    prevMonth: formatYearMonthKey(prev.year, prev.month),
    nextMonth: nextKey > currentKey ? null : nextKey,
    monthTitle: formatLvMonthTitle(parsed.month),
    prevMonthTitle: formatLvMonthTitle(prev.month),
    rangeLabel: costMonthRangeLabel(input.month, input.nowMs),
    totalUsd,
    groups,
    alerts,
    footnote: "live avoti - reāllaikā, pārējie reizi dienā",
  };
}

export function collectCostAlerts(rows: readonly CostSourceView[]): CostAlert[] {
  const out: CostAlert[] = [];
  for (const row of rows) {
    const usdPct = costUsagePercent(row.usd, row.limitUsd);
    const unitPct = costUsagePercent(row.units, row.limitUnits);
    const pct = Math.max(usdPct ?? 0, unitPct ?? 0);
    const level = costAlertLevel(usdPct != null || unitPct != null ? pct : null);
    if (!level) continue;
    out.push({
      source: row.id,
      label: row.label,
      level,
      percent: pct,
      usd: row.usd,
      limitUsd: row.limitUsd,
      units: row.units,
      limitUnits: row.limitUnits,
      hard: row.hard,
    });
  }
  out.sort((a, b) => b.percent - a.percent || a.source.localeCompare(b.source));
  return out;
}

export function costAlertBannerText(alerts: readonly CostAlert[]): string {
  if (alerts.length === 0) return "";
  const worst = alerts[0]!;
  const pct = `${Math.round(worst.percent)} %`;
  const money =
    worst.limitUsd != null ? `${formatAdminCostUsd(worst.usd)} / ${formatAdminCostUsd(worst.limitUsd)}` : null;
  const units =
    worst.limitUnits != null ? `${formatAdminCostInt(worst.units)} / ${formatAdminCostInt(worst.limitUnits)}` : null;
  const used = money ?? units ?? formatAdminCostUsd(worst.usd);
  const stop = worst.hard ? "pie 100 % ielāde apstājas" : "pie 100 % paliek brīdinājums";
  return `${shortCostLabel(worst.source)} ${pct} no mēneša limita (${used}). Brīdinājums pie 80 %, ${stop}. Brīdinājumi 80 % / 100 % iekļauti rīta kopsavilkumā.`;
}

export function shortCostLabel(id: CostSourceId): string {
  if (id === "apify") return "Apify";
  if (id === "anthropic") return "Anthropic";
  if (id === "gemini") return "Gemini";
  if (id === "maps-dynamic") return "Maps Dynamic Maps";
  if (id === "maps-geocoding") return "Maps Geocoding";
  if (id === "statvin") return "stat.vin";
  return costSourceDef(id)?.label ?? id;
}

export function costLimitCaption(row: CostSourceView): string {
  if (row.googleQuota && row.limitUnits != null) {
    const kvota = row.sourceOfLimit === "account" ? " · kvota no konta" : "";
    return `${formatAdminCostInt(row.units)} / ${formatAdminCostInt(row.limitUnits)} mēn.${kvota}`;
  }
  if (row.limitUsd == null && row.limitUnits == null) return "bez limita";
  if (row.limitUsd != null) {
    const from = row.sourceOfLimit === "account" ? " · no konta" : row.sourceOfLimit === "budget" ? " · no budžeta" : "";
    return `limits ${formatAdminCostUsd(row.limitUsd)}${from}`;
  }
  return `limits ${formatAdminCostInt(row.limitUnits ?? 0)}`;
}

export function costRemainingCaption(row: CostSourceView): string {
  if (row.googleQuota && row.remainingUnits != null) {
    const hard = row.hard ? " · stingra kvota" : "";
    return `atlikums ${formatAdminCostInt(row.remainingUnits)}${hard}`;
  }
  if (row.limitUsd == null && row.limitUnits == null) return "";
  if (row.remainingUsd != null) return `atlikums ${formatAdminCostUsd(row.remainingUsd)}`;
  if (row.remainingUnits != null) return `atlikums ${formatAdminCostInt(row.remainingUnits)}`;
  return "";
}

export function costBarRatio(row: CostSourceView): number {
  const usd = costUsagePercent(row.usd, row.limitUsd);
  const units = costUsagePercent(row.units, row.limitUnits);
  const pct = Math.max(usd ?? 0, units ?? 0);
  if (pct <= 0) return 0;
  return Math.min(1, pct / 100);
}

export function liveCostSourceIds(): CostSourceId[] {
  return COST_SOURCES.filter((s) => s.freshness === "live").map((s) => s.id);
}

export function manualCostSourceIds(): CostSourceId[] {
  return COST_SOURCES.filter((s) => s.freshness !== "live").map((s) => s.id);
}
