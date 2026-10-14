import {
  currentRigaYearMonth,
  formatLvYearMonth,
  formatYearMonthKey,
  isoInRigaYearMonth,
  parseYearMonthKey,
} from "@/lib/admin-riga-calendar";
import { formatIrissClientName } from "@/lib/iriss-pasutijumi-list-row";
import { parseIrissPasutijumsListStatus, type IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

/**
 * TODO(multi-tenant): kad IRISS B2B dīleru tenanti būs, filtrēt pēc tenantId.
 * Šobrīd single-tenant: visi IRISS pasūtījumi (ĪRISS pašu ops). Nav Stripe.
 */
export const IRISS_MONTHLY_REPORT_TENANT_MODE = "single-tenant" as const;

export type IrissMonthlyOfferInput = {
  id: string;
  createdAt: string;
  updatedAt?: string;
};

export type IrissMonthlyOrderInput = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  orderDate?: string;
  listStatus?: IrissPasutijumsListStatus | string;
  clientFirstName?: string;
  clientLastName?: string;
  brandModel?: string;
  offers?: readonly IrissMonthlyOfferInput[];
};

export type IrissMonthlyReportRow = {
  id: string;
  clientName: string;
  brandModel: string;
  status: IrissPasutijumsListStatus;
  createdAt: string;
  offerCount: number;
  offersCreatedInMonth: number;
};

export type IrissMonthlyReport = {
  year: number;
  month: number;
  monthKey: string;
  monthLabel: string;
  tenantMode: typeof IRISS_MONTHLY_REPORT_TENANT_MODE;
  ordersCreated: number;
  ordersByStatus: { active: number; completed: number; inactive: number };
  offersCreated: number;
  offersUpdated: number;
  ordersWithOffers: number;
  /** PDF ģenerēšanas žurnāls IRISS datos nav. Skaita tikai saglabātos piedāvājumus. */
  pdfGenerationsTracked: false;
  rows: IrissMonthlyReportRow[];
};

function normalizeStatus(raw: string | undefined): IrissPasutijumsListStatus {
  return parseIrissPasutijumsListStatus(raw);
}

export function resolveIrissReportMonth(
  raw: string | null | undefined,
  nowMs = Date.now(),
): { year: number; month: number } {
  return parseYearMonthKey(raw) ?? currentRigaYearMonth(nowMs);
}

export function buildIrissMonthlyReport(
  records: readonly IrissMonthlyOrderInput[],
  year: number,
  month: number,
): IrissMonthlyReport {
  const monthKey = formatYearMonthKey(year, month);
  const inMonth = records.filter((r) => isoInRigaYearMonth(r.createdAt, year, month));

  let active = 0;
  let completed = 0;
  let inactive = 0;
  let offersCreated = 0;
  let offersUpdated = 0;
  let ordersWithOffers = 0;

  for (const rec of records) {
    const offers = rec.offers ?? [];
    const createdHere = offers.filter((o) => isoInRigaYearMonth(o.createdAt, year, month));
    const updatedHere = offers.filter((o) => o.updatedAt && isoInRigaYearMonth(o.updatedAt, year, month));
    offersCreated += createdHere.length;
    offersUpdated += updatedHere.length;
    if (createdHere.length > 0) ordersWithOffers += 1;
  }

  const rows: IrissMonthlyReportRow[] = inMonth.map((rec) => {
    const status = normalizeStatus(rec.listStatus);
    if (status === "completed") completed += 1;
    else if (status === "inactive") inactive += 1;
    else active += 1;
    const offers = rec.offers ?? [];
    return {
      id: rec.id,
      clientName: formatIrissClientName({
        clientFirstName: rec.clientFirstName ?? "",
        clientLastName: rec.clientLastName ?? "",
      }),
      brandModel: (rec.brandModel ?? "").trim() || "-",
      status,
      createdAt: rec.createdAt,
      offerCount: offers.length,
      offersCreatedInMonth: offers.filter((o) => isoInRigaYearMonth(o.createdAt, year, month)).length,
    };
  });

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));

  return {
    year,
    month,
    monthKey,
    monthLabel: formatLvYearMonth(year, month),
    tenantMode: IRISS_MONTHLY_REPORT_TENANT_MODE,
    ordersCreated: inMonth.length,
    ordersByStatus: { active, completed, inactive },
    offersCreated,
    offersUpdated,
    ordersWithOffers,
    pdfGenerationsTracked: false,
    rows,
  };
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatIrissMonthlyReportCsv(report: IrissMonthlyReport): string {
  const lines = [
    ["Mēnesis", report.monthLabel].map(csvCell).join(","),
    ["Mēneša atslēga", report.monthKey].map(csvCell).join(","),
    ["Tenants", report.tenantMode].map(csvCell).join(","),
    ["Pasūtījumi (izveidoti mēnesī)", report.ordersCreated].map(csvCell).join(","),
    ["Aktīvi", report.ordersByStatus.active].map(csvCell).join(","),
    ["Izpildīti", report.ordersByStatus.completed].map(csvCell).join(","),
    ["Neaktīvi", report.ordersByStatus.inactive].map(csvCell).join(","),
    ["Piedāvājumi (izveidoti mēnesī)", report.offersCreated].map(csvCell).join(","),
    ["Piedāvājumi (laboti mēnesī)", report.offersUpdated].map(csvCell).join(","),
    ["Pasūtījumi ar jaunu piedāvājumu", report.ordersWithOffers].map(csvCell).join(","),
    ["PDF ģenerēšana", "nav uzskaitīta datos"].map(csvCell).join(","),
    "",
    ["id", "klients", "marka", "statuss", "izveidots", "piedavajumi", "jauni_piedavajumi"].join(","),
    ...report.rows.map((r) =>
      [r.id, r.clientName, r.brandModel, r.status, r.createdAt, r.offerCount, r.offersCreatedInMonth]
        .map(csvCell)
        .join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}
