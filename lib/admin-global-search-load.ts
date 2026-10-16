import "server-only";

import { filterAdminOrdersForDashboard } from "@/lib/admin-order-amount-filter";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { listManualOrders, type ManualOrderRecord } from "@/lib/admin-manual-orders";
import { readStripePaidIndex } from "@/lib/admin-stripe-paid-index";
import {
  ADMIN_SEARCH_OPERATOR_TENANT,
  adminSearchSectionRecords,
  groupAdminSearchHits,
  searchAdminGlobal,
  type AdminSearchGroup,
  type AdminSearchProRow,
  type AdminSearchRecord,
} from "@/lib/admin-global-search";
import { parsePartnerCompanyFromNotes } from "@/lib/b2b-partner-orders";
import { getDemoOrderRows } from "@/lib/demo-orders";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";

const CATALOG_TTL_MS = 20_000;

type ProSource = {
  id: string;
  created: number;
  amountTotal: number | null;
  isDemo?: boolean;
  isManual?: boolean;
  fulfillment?: string | null;
  checkoutLine?: string | null;
  vin?: string | null;
  customerEmail?: string | null;
  companyName?: string | null;
};

let catalogCache: { at: number; records: AdminSearchRecord[] } | null = null;

function demoOrdersEnabled(): boolean {
  const v = (process.env.ADMIN_DEMO_ORDERS ?? "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

function clip(value: string, max: number): string {
  const t = value.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function joinBits(parts: Array<string | null | undefined>, skip: string): string {
  const out: string[] = [];
  for (const part of parts) {
    const t = (part ?? "").trim();
    if (!t || t === skip || out.includes(t)) continue;
    out.push(t);
    if (out.length >= 3) break;
  }
  return out.join(" · ");
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function operatorRecord(row: Omit<AdminSearchRecord, "tenantId">): AdminSearchRecord {
  return { ...row, tenantId: ADMIN_SEARCH_OPERATOR_TENANT };
}

async function loadIrissOrders(): Promise<AdminSearchRecord[]> {
  const rows = await listIrissPasutijumi();
  return rows.map((row) => {
    const name = [row.clientFirstName, row.clientLastName].map((s) => s.trim()).filter(Boolean).join(" ");
    const title = clip(name || row.brandModel || row.id, 160);
    return operatorRecord({
      kind: "iriss-order",
      id: row.id,
      title,
      subtitle: clip(joinBits([row.brandModel, row.phone, row.email], title), 180),
      href: `/admin/iriss/pasutijumi/${encodeURIComponent(row.id)}`,
      text: [name, row.phone, row.email, row.brandModel, row.id].join(" "),
      vin: row.vin ?? "",
    });
  });
}

async function loadListings(): Promise<AdminSearchRecord[]> {
  const view = await readIrissListingsLatestView();
  const vehicles = view?.vehicles ?? [];
  return vehicles.map((vehicle) => {
    const source = IRISS_LISTING_PLATFORM_LABEL[vehicle.platform] ?? vehicle.platform;
    const title = clip([vehicle.manufacturer, vehicle.title].map((s) => (s ?? "").trim()).filter(Boolean).join(" ") || vehicle.externalId || vehicle.id, 160);
    const vin = (vehicle.vin ?? "").trim();
    return operatorRecord({
      kind: "iriss-listing",
      id: vehicle.id,
      title,
      subtitle: clip(joinBits([source, vehicle.externalId, vin], title), 180),
      href: `/admin/iriss/sludinajumi?listing=${encodeURIComponent(vehicle.id)}`,
      text: [title, source, vehicle.platform, vehicle.externalId, vehicle.stockNumber ?? "", vehicle.year, vehicle.id].join(" "),
      vin,
    });
  });
}

async function loadWaybills(): Promise<AdminSearchRecord[]> {
  const rows = await readIrissPavadzimesCached();
  return rows.map((row) => {
    const plate = row.plate.trim();
    const title = clip(row.number || plate || row.brandModel || row.id, 160);
    return operatorRecord({
      kind: "iriss-waybill",
      id: row.id,
      title,
      subtitle: clip(joinBits([plate, row.brandModel, row.vin], title), 180),
      href: `/admin/iriss/pavadzimes?wb=${encodeURIComponent(row.id)}`,
      text: [row.number, plate, plate.replace(/[\s-]/g, ""), row.brandModel, row.id].join(" "),
      vin: row.vin ?? "",
    });
  });
}

function manualSource(rec: ManualOrderRecord): ProSource {
  return {
    id: rec.id,
    created: rec.created,
    amountTotal: rec.amountTotal,
    isManual: true,
    checkoutLine: rec.checkoutLine ?? "audit",
    companyName: rec.companyName ?? null,
    customerEmail: null,
    vin: null,
  };
}

function proHref(row: ProSource): string {
  const id = encodeURIComponent(row.id);
  if (row.checkoutLine === "provin_select") return `/admin/konsultacijas/${id}`;
  return `/admin/orders/${id}`;
}

async function loadProOrders(): Promise<AdminSearchRecord[]> {
  const [index, manual] = await Promise.all([
    readStripePaidIndex().catch(() => null),
    listManualOrders().catch(() => [] as ManualOrderRecord[]),
  ]);
  const stripeRows = (index?.rows ?? []).filter((row) => row.fulfillment !== "order_upsell");
  const demo = demoOrdersEnabled() ? getDemoOrderRows() : [];
  const merged: ProSource[] = [...demo, ...manual.map(manualSource), ...stripeRows];
  const visible = filterAdminOrdersForDashboard(merged, false);
  const drafts = await readOrderDraftSummaries(visible.map((row) => row.id)).catch(() => new Map());
  return visible.map((row) => {
    const draft = drafts.get(row.id);
    const pro: AdminSearchProRow = {
      id: row.id,
      created: row.created,
      vin: draft?.vin || row.vin || null,
      makeModel: draft?.makeModel || null,
      customerEmail: draft?.customerEmail || row.customerEmail || null,
      customerName: draft?.customerName || row.companyName || null,
      customerPhone: draft?.customerPhone || null,
      partnerCompanyName: row.companyName || parsePartnerCompanyFromNotes(draft?.notes) || null,
    };
    const title = clip(pro.customerName || pro.makeModel || pro.customerEmail || row.id, 160);
    return operatorRecord({
      kind: "pro-order",
      id: row.id,
      title,
      subtitle: clip(joinBits([pro.makeModel, pro.customerEmail, pro.vin], title), 180),
      href: proHref(row),
      text: "",
      vin: "",
      pro,
    });
  });
}

async function loadCatalog(): Promise<AdminSearchRecord[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.records;
  const [orders, listings, waybills, pro] = await Promise.all([
    safe(loadIrissOrders, []),
    safe(loadListings, []),
    safe(loadWaybills, []),
    safe(loadProOrders, []),
  ]);
  const records = [...orders, ...listings, ...waybills, ...pro, ...adminSearchSectionRecords()];
  catalogCache = { at: Date.now(), records };
  return records;
}

/** Tikai lasīšana. Nekādā gadījumā neizsauc Stripe atsvaidzināšanu, Dropbox, izsoļu sync vai maksas VIN avotus. */
export async function loadAdminGlobalSearch(query: string): Promise<AdminSearchGroup[]> {
  const records = await loadCatalog();
  return groupAdminSearchHits(searchAdminGlobal(records, query, { kind: "operator" }));
}
