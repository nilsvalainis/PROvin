/**
 * IRISS pasūtījumu saraksta pārskats — klients, specifikācija, aprīkojums, piezīmes.
 * Kopīgs ZIP/JSON eksportam un saraksta PDF (bez piedāvājumu attēliem).
 */

import {
  IRISS_DEAL_DETAIL_OPTIONS,
  type IrissPasutijumiListOrder,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";

function val(s: string | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

export type IrissPasutijumsOverview = {
  heading: string;
  subheading: string | null;
  clientLines: string[];
  specLines: string[];
  dealLines: string[];
  equipmentRequired: string | null;
  equipmentDesired: string | null;
  notes: string | null;
};

const LIST_STATUS_LV: Record<IrissPasutijumsListStatus, string> = {
  active: "Aktīvs",
  completed: "Izpildīts",
  inactive: "Neaktīvs",
};

export function irissPasutijumiListPdfFilename(d = new Date()): string {
  return `provin-pasutijumu-saraksts-${d.toISOString().slice(0, 10)}.pdf`;
}

function orderDateIso(record: IrissPasutijumsRecord): string {
  const raw = (record.orderDate || record.createdAt || "").trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? "";
}

/** Viena pasūtījuma PDF fails: marka/modelis + klienta vārds + datums. */
export function irissPasutijumsPdfFilename(record: IrissPasutijumsRecord): string {
  const parts = [val(record.brandModel), val(record.clientFirstName), orderDateIso(record) || null].filter(
    (p): p is string => Boolean(p),
  );
  const base = (parts.join(" ") || "pasutijums")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base}.pdf`;
}

export function irissPasutijumsPdfContentDisposition(record: IrissPasutijumsRecord, inline: boolean): string {
  const name = irissPasutijumsPdfFilename(record);
  const type = inline ? "inline" : "attachment";
  const ascii = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Saraksta PDF — tikai aktīvie; izpildītie un neaktīvie paliek ZIP/JSON kopijā. */
export function isIrissRecordActiveForListPdf(record: IrissPasutijumsRecord): boolean {
  return (record.listStatus ?? "active") === "active";
}

export function orderIrissRecordsForListPdf(
  records: IrissPasutijumsRecord[],
  listOrder: IrissPasutijumiListOrder | null,
): IrissPasutijumsRecord[] {
  return orderIrissRecordsForList(records, listOrder).filter(isIrissRecordActiveForListPdf);
}

export function orderIrissRecordsForList(
  records: IrissPasutijumsRecord[],
  listOrder: IrissPasutijumiListOrder | null,
): IrissPasutijumsRecord[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  const out: IrissPasutijumsRecord[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const rec = byId.get(id);
    if (!rec || seen.has(id)) return;
    seen.add(id);
    out.push(rec);
  };
  for (const id of listOrder?.pinnedOrder ?? []) push(id);
  for (const id of listOrder?.unpinnedOrder ?? []) push(id);
  const rest = records
    .filter((r) => !seen.has(r.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...out, ...rest];
}

export function collectIrissPasutijumsOverview(record: IrissPasutijumsRecord): IrissPasutijumsOverview {
  const clientName = [val(record.clientFirstName), val(record.clientLastName)].filter(Boolean).join(" ");
  const heading = val(record.brandModel) || clientName || "Pasūtījums";

  const subParts: string[] = [];
  const orderDate = val(record.orderDate);
  if (orderDate) subParts.push(orderDate);
  if (clientName && val(record.brandModel)) subParts.push(clientName);
  const status = record.listStatus ? LIST_STATUS_LV[record.listStatus] : null;
  if (status) subParts.push(status);
  const subheading = subParts.length ? subParts.join(" · ") : null;

  const clientLines: string[] = [];
  const vFn = val(record.clientFirstName);
  const vLn = val(record.clientLastName);
  if (vFn) clientLines.push(`Vārds: ${vFn}`);
  if (vLn) clientLines.push(`Uzvārds: ${vLn}`);
  const vPh = val(record.phone);
  if (vPh) clientLines.push(`Tālrunis: ${vPh}`);
  const vEm = val(record.email);
  if (vEm) clientLines.push(`E-pasts: ${vEm}`);
  if (orderDate) clientLines.push(`Pasūtījuma datums: ${orderDate}`);

  const specLines: string[] = [];
  const pushSpec = (label: string, s: string | undefined) => {
    const v = val(s);
    if (v) specLines.push(`${label}: ${v}`);
  };
  pushSpec("Marka / modelis", record.brandModel);
  pushSpec("Gads / periods", record.productionYears);
  pushSpec("Maks. nobraukums", record.maxMileage);
  pushSpec("Transmisija", record.transmission);
  pushSpec("Dzinēja tips", record.engineType);
  pushSpec("Virsbūves tips", record.bodyType);
  pushSpec("Piedziņas tips", record.driveType);
  pushSpec("Sēdvietu skaits", record.seatCount);
  pushSpec("Kopējais budžets", record.totalBudget);
  pushSpec("Vēlamās krāsas", record.preferredColors);
  pushSpec("Nevēlamās krāsas", record.nonPreferredColors);
  pushSpec("Salona apdare", record.interiorFinish);
  const dealLines: string[] = [];
  const selectedDealDetails = IRISS_DEAL_DETAIL_OPTIONS.filter((opt) => Boolean(record[opt.key])).map(
    (opt) => opt.label,
  );
  for (const label of selectedDealDetails) dealLines.push(`${label}: Jā`);

  return {
    heading,
    subheading,
    clientLines,
    specLines,
    dealLines,
    equipmentRequired: val(record.equipmentRequired),
    equipmentDesired: val(record.equipmentDesired),
    notes: val(record.notes),
  };
}

export function irissPasutijumsOverviewHasContent(o: IrissPasutijumsOverview): boolean {
  return (
    o.clientLines.length > 0 ||
    o.specLines.length > 0 ||
    o.dealLines.length > 0 ||
    Boolean(o.equipmentRequired) ||
    Boolean(o.equipmentDesired) ||
    Boolean(o.notes)
  );
}
