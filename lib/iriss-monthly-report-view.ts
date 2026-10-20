import { LV_MONTH_NAMES, formatLvMonthTitle } from "@/lib/admin-riga-calendar";

export const IRISS_REPORT_PDF_VALUE = "Nav datu";
export const IRISS_REPORT_PDF_HINT = "vēl netiek skaitīts";
export const IRISS_REPORT_EMPTY_CLIENT = "Bez vārda";
export const IRISS_REPORT_ABOUT_TITLE = "Par atskaiti";
export const IRISS_REPORT_ABOUT =
  "Single-tenant IRISS ops (ĪRISS). Nav Stripe un nav PROVIN VIN/auditu metriku. Multi-tenant dīleru panelis vēl nav.";

const LV_MONTH_LOCATIVE: readonly string[] = [
  "janvāri",
  "februāri",
  "martu",
  "aprīli",
  "maiju",
  "jūniju",
  "jūliju",
  "augustu",
  "septembri",
  "oktobri",
  "novembri",
  "decembri",
];

export function formatIrissReportNavLabel(year: number, month: number): string {
  const title = formatLvMonthTitle(month);
  return title ? `${title} ${year}` : `${year}-${String(month).padStart(2, "0")}`;
}

export function formatIrissReportMonthLocative(month: number): string {
  return LV_MONTH_LOCATIVE[month - 1] ?? LV_MONTH_NAMES[month - 1] ?? "";
}

export function formatIrissReportClientName(name: string | null | undefined): string {
  const t = (name ?? "").trim();
  if (!t || t === "-" || t === "\u2014" || t === "\u2013") return IRISS_REPORT_EMPTY_CLIENT;
  return t;
}

export function formatIrissMonthlyDelta(delta: number, withMonth?: string): string {
  if (delta === 0) return "bez izmaiņām";
  const signed = delta > 0 ? `+${delta}` : `${delta}`;
  const loc = (withMonth ?? "").trim();
  return loc ? `${signed} pret ${loc}` : signed;
}

export type IrissMonthlyMetricSnapshot = {
  ordersCreated: number;
  active: number;
  completed: number;
  inactive: number;
  offersCreated: number;
  ordersWithOffers: number;
  offersUpdated: number;
};

export function irissMonthlyMetricSnapshot(input: {
  ordersCreated: number;
  ordersByStatus: { active: number; completed: number; inactive: number };
  offersCreated: number;
  ordersWithOffers: number;
  offersUpdated: number;
}): IrissMonthlyMetricSnapshot {
  return {
    ordersCreated: input.ordersCreated,
    active: input.ordersByStatus.active,
    completed: input.ordersByStatus.completed,
    inactive: input.ordersByStatus.inactive,
    offersCreated: input.offersCreated,
    ordersWithOffers: input.ordersWithOffers,
    offersUpdated: input.offersUpdated,
  };
}

export function irissMonthlyMetricDeltas(
  current: IrissMonthlyMetricSnapshot,
  previous: IrissMonthlyMetricSnapshot,
): IrissMonthlyMetricSnapshot {
  return {
    ordersCreated: current.ordersCreated - previous.ordersCreated,
    active: current.active - previous.active,
    completed: current.completed - previous.completed,
    inactive: current.inactive - previous.inactive,
    offersCreated: current.offersCreated - previous.offersCreated,
    ordersWithOffers: current.ordersWithOffers - previous.ordersWithOffers,
    offersUpdated: current.offersUpdated - previous.offersUpdated,
  };
}
