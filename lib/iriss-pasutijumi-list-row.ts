import { IRISS_DEAL_DETAIL_OPTIONS, type IrissPasutijumsListRow, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const DEAL_LIST_LABEL: Record<(typeof IRISS_DEAL_DETAIL_OPTIONS)[number]["key"], string> = {
  dealLeasingOrCredit: "Līzings",
  dealClientFinancing100: "Fin. 100%",
  dealClientFinancing20: "Fin. 20%",
  dealVat21Required: "PVN 21%",
  dealServiceStartDeposit: "Depozīts",
  dealEkki: "EKKI",
};

export function irissPasutijumsToListRow(rec: IrissPasutijumsRecord): IrissPasutijumsListRow {
  return {
    id: rec.id,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    pinnedAt: rec.pinnedAt,
    listStatus: rec.listStatus ?? "active",
    clientFirstName: rec.clientFirstName.trim(),
    clientLastName: rec.clientLastName.trim(),
    orderDate: rec.orderDate.trim(),
    brandModel: rec.brandModel.trim() || "—",
    totalBudget: rec.totalBudget.trim() || "—",
    phone: rec.phone.trim() || "—",
    productionYears: rec.productionYears.trim(),
    engineType: rec.engineType.trim(),
    transmission: rec.transmission.trim(),
    bodyType: rec.bodyType.trim(),
    driveType: rec.driveType.trim(),
    seatCount: rec.seatCount.trim(),
    maxMileage: rec.maxMileage.trim(),
    preferredColors: rec.preferredColors.trim(),
    nonPreferredColors: rec.nonPreferredColors.trim(),
    interiorFinish: rec.interiorFinish.trim(),
    dealLeasingOrCredit: Boolean(rec.dealLeasingOrCredit),
    dealClientFinancing100: Boolean(rec.dealClientFinancing100),
    dealClientFinancing20: Boolean(rec.dealClientFinancing20),
    dealVat21Required: Boolean(rec.dealVat21Required),
    dealServiceStartDeposit: Boolean(rec.dealServiceStartDeposit),
    dealEkki: Boolean(rec.dealEkki),
    equipmentRequired: rec.equipmentRequired.trim(),
    listingLinkMobile: rec.listingLinkMobile,
    listingLinkAutobid: rec.listingLinkAutobid,
    listingLinkOpenline: rec.listingLinkOpenline,
    listingLinkAuto1: rec.listingLinkAuto1,
    listingLinksOther: rec.listingLinksOther,
  };
}

/** Aizpildītie specifikācijas lauki sarakstam (bez markas — tā ir virsraksts). */
export function formatIrissListSpecSummary(row: IrissPasutijumsListRow): string {
  const parts: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t) parts.push(t);
  };
  push(row.productionYears);
  push(row.engineType);
  push(row.transmission);
  push(row.bodyType);
  push(row.driveType);
  push(row.seatCount);
  push(row.maxMileage);
  push(row.preferredColors);
  if (row.nonPreferredColors.trim()) parts.push(`ne ${row.nonPreferredColors.trim()}`);
  push(row.interiorFinish);
  for (const opt of IRISS_DEAL_DETAIL_OPTIONS) {
    if (row[opt.key as keyof IrissPasutijumsListRow]) parts.push(DEAL_LIST_LABEL[opt.key]);
  }
  return parts.join(" · ");
}

export function formatIrissClientName(row: Pick<IrissPasutijumsListRow, "clientFirstName" | "clientLastName">): string {
  const name = [row.clientFirstName, row.clientLastName].map((s) => s.trim()).filter(Boolean).join(" ");
  return name || "—";
}

/** Īss datums sarakstam, piem. 22.04 */
export function formatIrissListDate(row: Pick<IrissPasutijumsListRow, "orderDate" | "createdAt">): string {
  const raw = (row.orderDate || row.createdAt || "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}`;
  }
  return raw.slice(0, 10) || "—";
}

export function irissPhoneTelHref(phone: string): string | null {
  const t = phone.trim();
  if (!t || t === "—") return null;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("371")) return `tel:+${digits}`;
  if (digits.length === 8) return `tel:+371${digits}`;
  return `tel:+${digits}`;
}

export function irissListRowMatchesQuery(row: IrissPasutijumsListRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = formatIrissClientName(row);
  const hay = [
    name,
    row.brandModel,
    row.phone,
    row.clientFirstName,
    row.clientLastName,
    formatIrissListSpecSummary(row),
    row.equipmentRequired ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function countIrissListStatuses(rows: readonly IrissPasutijumsListRow[]): {
  active: number;
  completed: number;
  inactive: number;
} {
  let active = 0;
  let completed = 0;
  let inactive = 0;
  for (const row of rows) {
    const st = row.listStatus ?? "active";
    if (st === "completed") completed += 1;
    else if (st === "inactive") inactive += 1;
    else active += 1;
  }
  return { active, completed, inactive };
}
