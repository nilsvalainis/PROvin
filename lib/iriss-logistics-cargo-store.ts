import "server-only";

import { randomUUID } from "node:crypto";
import {
  DEFAULT_ROUTE_TEMPLATES,
  emptyCargoPlan,
  ensureCargoCars,
  isRouteTemplateType,
  normalizeCargoPlan,
  normalizeRouteTemplate,
  type CargoPlanState,
  type CargoRouteTemplate,
  type RouteTemplateType,
} from "@/lib/iriss-logistics-cargo-plan";
import { listLogisticsOrders, readLogisticsJsonFile, writeLogisticsJsonFile } from "@/lib/iriss-logistics-store";
import { isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";

const CARGO_PLAN_FILE = "cargo-plan.json";
const ROUTE_TEMPLATES_FILE = "route-templates.json";

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function readCargoPlan(): Promise<CargoPlanState> {
  const raw = await readLogisticsJsonFile(CARGO_PLAN_FILE);
  return normalizeCargoPlan(raw);
}

export async function writeCargoPlan(plan: CargoPlanState): Promise<CargoPlanState> {
  const next = normalizeCargoPlan({ ...plan, updatedAt: new Date().toISOString() });
  await writeLogisticsJsonFile(CARGO_PLAN_FILE, next);
  return next;
}

export async function loadCargoPlanForActiveOrders(): Promise<CargoPlanState> {
  const orders = await listLogisticsOrders();
  const activeIds = orders.filter(isLogisticsOrderActive).map((o) => o.id);
  const plan = ensureCargoCars(await readCargoPlan(), activeIds);
  return plan;
}

export async function saveCargoPlanForActiveOrders(plan: CargoPlanState): Promise<CargoPlanState> {
  const orders = await listLogisticsOrders();
  const activeIds = orders.filter(isLogisticsOrderActive).map((o) => o.id);
  return writeCargoPlan(ensureCargoCars(plan, activeIds));
}

function seedTemplates(at: string): CargoRouteTemplate[] {
  return DEFAULT_ROUTE_TEMPLATES.map((row) => ({ ...row, createdAt: at, updatedAt: at }));
}

export async function listRouteTemplates(): Promise<CargoRouteTemplate[]> {
  const raw = await readLogisticsJsonFile(ROUTE_TEMPLATES_FILE);
  const items = isObj(raw) && Array.isArray(raw.items) ? raw.items : Array.isArray(raw) ? raw : [];
  const parsed = items.map(normalizeRouteTemplate).filter((x): x is CargoRouteTemplate => Boolean(x));
  if (parsed.length > 0) return parsed;
  const seeded = seedTemplates(new Date().toISOString());
  await writeLogisticsJsonFile(ROUTE_TEMPLATES_FILE, { items: seeded });
  return seeded;
}

export async function writeRouteTemplates(items: CargoRouteTemplate[]): Promise<CargoRouteTemplate[]> {
  await writeLogisticsJsonFile(ROUTE_TEMPLATES_FILE, { items });
  return items;
}

export async function upsertRouteTemplate(patch: {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type?: RouteTemplateType;
}): Promise<CargoRouteTemplate> {
  const items = await listRouteTemplates();
  const at = new Date().toISOString();
  const id = patch.id?.trim() || `tpl-${randomUUID()}`;
  const prev = items.find((x) => x.id === id);
  const next: CargoRouteTemplate = {
    id,
    name: patch.name.trim().slice(0, 120),
    address: patch.address.trim().slice(0, 240),
    lat: patch.lat,
    lng: patch.lng,
    type: isRouteTemplateType(patch.type) ? patch.type : (prev?.type ?? "other"),
    createdAt: prev?.createdAt || at,
    updatedAt: at,
  };
  const out = prev ? items.map((x) => (x.id === id ? next : x)) : [...items, next];
  await writeRouteTemplates(out);
  return next;
}

export async function deleteRouteTemplate(id: string): Promise<boolean> {
  const items = await listRouteTemplates();
  const next = items.filter((x) => x.id !== id);
  if (next.length === items.length) return false;
  await writeRouteTemplates(next);
  return true;
}
