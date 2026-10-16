import { randomBytes } from "node:crypto";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { assertSameTenant } from "@/lib/b2b-demo-isolation";
import { isSafeB2bDemoOfferId, isSafeB2bDemoOrderId, isSafeB2bDemoTenantId } from "@/lib/b2b-demo-ids";
import {
  isB2bDemoOrderStatus,
  type B2bDemoOffer,
  type B2bDemoOrder,
  type B2bDemoOrderStatus,
} from "@/lib/b2b-demo-types";

function clip(value: unknown, max: number): string {
  return (typeof value === "string" ? value : "").trim().slice(0, max);
}

function flag(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function newB2bDemoOrderId(): string {
  return `ord_${randomBytes(8).toString("hex")}`;
}

export function newB2bDemoOfferId(): string {
  return `off_${randomBytes(8).toString("hex")}`;
}

export function b2bDemoClientDisplayName(order: Pick<B2bDemoOrder, "clientName" | "clientFirstName" | "clientLastName">): string {
  const fromParts = `${order.clientFirstName} ${order.clientLastName}`.replace(/\s+/g, " ").trim();
  return fromParts || order.clientName.trim();
}

function splitClientName(name: string): { first: string; last: string } {
  const normalized = name.replace(/\s+/g, " ").trim();
  if (!normalized) return { first: "", last: "" };
  const [first, ...rest] = normalized.split(" ");
  return { first: first ?? "", last: rest.join(" ") };
}

export function emptyB2bDemoOffer(offerId: string, now: string, title = "Piedāvājums 1"): B2bDemoOffer {
  return {
    offerId,
    title,
    brandModel: "",
    vin: "",
    firstRegistration: "",
    odometerReading: "",
    transmission: "",
    location: "",
    hasFullServiceHistory: false,
    hasFactoryPaint: false,
    hasNoRustBody: false,
    hasSecondWheelSet: false,
    specialNotes: "",
    visualAssessment: "",
    technicalAssessment: "",
    summary: "",
    carPrice: "",
    deliveryPrice: "",
    commissionFee: "",
    offerValidDays: "",
    validUntil: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function parseB2bDemoOffer(raw: unknown, nowFallback: string): B2bDemoOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const offerId = typeof o.offerId === "string" ? o.offerId.trim() : "";
  if (!isSafeB2bDemoOfferId(offerId)) return null;
  const createdAt = typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt.trim() : nowFallback;
  const vinRaw = typeof o.vin === "string" ? o.vin : "";
  const vin = vinRaw.trim() ? normalizeVin(vinRaw) : "";
  return {
    offerId,
    title: clip(o.title, 120) || "Piedāvājums",
    brandModel: clip(o.brandModel, 160),
    vin,
    firstRegistration: clip(o.firstRegistration, 40),
    odometerReading: clip(o.odometerReading, 40),
    transmission: clip(o.transmission, 80),
    location: clip(o.location, 160),
    hasFullServiceHistory: flag(o.hasFullServiceHistory),
    hasFactoryPaint: flag(o.hasFactoryPaint),
    hasNoRustBody: flag(o.hasNoRustBody),
    hasSecondWheelSet: flag(o.hasSecondWheelSet),
    specialNotes: clip(o.specialNotes, 4000),
    visualAssessment: clip(o.visualAssessment, 4000),
    technicalAssessment: clip(o.technicalAssessment, 4000),
    summary: clip(o.summary, 4000),
    carPrice: clip(o.carPrice, 40),
    deliveryPrice: clip(o.deliveryPrice, 40),
    commissionFee: clip(o.commissionFee, 40),
    offerValidDays: clip(o.offerValidDays, 20),
    validUntil: clip(o.validUntil, 16),
    createdAt,
    updatedAt: typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : createdAt,
  };
}

function parseOffers(raw: unknown, now: string): B2bDemoOffer[] {
  if (!Array.isArray(raw)) return [];
  const out: B2bDemoOffer[] = [];
  for (const row of raw.slice(0, 40)) {
    const offer = parseB2bDemoOffer(row, now);
    if (offer) out.push(offer);
  }
  return out;
}

export type B2bDemoOrderInput = {
  clientName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  phone?: string;
  email?: string;
  orderDate?: string;
  brandModel?: string;
  vin?: string;
  productionYears?: string;
  totalBudget?: string;
  engineType?: string;
  transmission?: string;
  bodyType?: string;
  driveType?: string;
  seatCount?: string;
  maxMileage?: string;
  preferredColors?: string;
  nonPreferredColors?: string;
  interiorFinish?: string;
  dealLeasingOrCredit?: boolean;
  dealClientFinancing100?: boolean;
  dealClientFinancing20?: boolean;
  dealVat21Required?: boolean;
  dealServiceStartDeposit?: boolean;
  dealEkki?: boolean;
  equipmentRequired?: string;
  equipmentDesired?: string;
  note?: string;
  status?: B2bDemoOrderStatus;
  offers?: B2bDemoOffer[];
};

function normalizeVinField(raw: string): string {
  const vin = raw.trim() ? normalizeVin(raw) : "";
  if (vin && !isValidVin(vin)) throw new Error("Nederīgs VIN.");
  return vin;
}

function resolveNames(input: B2bDemoOrderInput, fallbackName = ""): { clientName: string; clientFirstName: string; clientLastName: string } {
  const first = clip(input.clientFirstName, 80);
  const last = clip(input.clientLastName, 80);
  if (first || last) {
    return { clientName: `${first} ${last}`.replace(/\s+/g, " ").trim(), clientFirstName: first, clientLastName: last };
  }
  const clientName = clip(input.clientName ?? fallbackName, 160);
  const split = splitClientName(clientName);
  return { clientName, clientFirstName: split.first, clientLastName: split.last };
}

export function emptyB2bDemoOrder(tenantId: string, orderId: string, now = new Date().toISOString()): B2bDemoOrder {
  if (!isSafeB2bDemoTenantId(tenantId)) throw new Error("Nederīgs tenant_id.");
  if (!isSafeB2bDemoOrderId(orderId)) throw new Error("Nederīgs order_id.");
  return {
    tenantId,
    orderId,
    clientName: "",
    clientFirstName: "",
    clientLastName: "",
    phone: "",
    email: "",
    orderDate: now.slice(0, 10),
    brandModel: "",
    vin: "",
    productionYears: "",
    totalBudget: "",
    engineType: "",
    transmission: "",
    bodyType: "",
    driveType: "",
    seatCount: "",
    maxMileage: "",
    preferredColors: "",
    nonPreferredColors: "",
    interiorFinish: "",
    dealLeasingOrCredit: false,
    dealClientFinancing100: false,
    dealClientFinancing20: false,
    dealVat21Required: false,
    dealServiceStartDeposit: false,
    dealEkki: false,
    equipmentRequired: "",
    equipmentDesired: "",
    note: "",
    status: "active",
    offers: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function parseB2bDemoOrder(raw: unknown, tenantId: string): B2bDemoOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const orderId = typeof o.orderId === "string" ? o.orderId.trim() : "";
  const recordTenant = typeof o.tenantId === "string" ? o.tenantId.trim() : "";
  if (!isSafeB2bDemoOrderId(orderId) || !isSafeB2bDemoTenantId(recordTenant)) return null;
  const createdAt = typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt.trim() : "";
  if (!createdAt) return null;
  const status: B2bDemoOrderStatus = isB2bDemoOrderStatus(o.status) ? o.status : "active";
  const vinRaw = typeof o.vin === "string" ? o.vin : "";
  const vin = vinRaw.trim() ? normalizeVin(vinRaw) : "";
  const names = resolveNames(
    {
      clientName: typeof o.clientName === "string" ? o.clientName : "",
      clientFirstName: typeof o.clientFirstName === "string" ? o.clientFirstName : "",
      clientLastName: typeof o.clientLastName === "string" ? o.clientLastName : "",
    },
  );
  const order: B2bDemoOrder = {
    tenantId: recordTenant,
    orderId,
    clientName: names.clientName,
    clientFirstName: names.clientFirstName,
    clientLastName: names.clientLastName,
    phone: clip(o.phone, 40),
    email: clip(o.email, 120),
    orderDate: clip(o.orderDate, 16) || createdAt.slice(0, 10),
    brandModel: clip(o.brandModel, 160),
    vin,
    productionYears: clip(o.productionYears, 40),
    totalBudget: clip(o.totalBudget, 40),
    engineType: clip(o.engineType, 80),
    transmission: clip(o.transmission, 80),
    bodyType: clip(o.bodyType, 80),
    driveType: clip(o.driveType, 80),
    seatCount: clip(o.seatCount, 20),
    maxMileage: clip(o.maxMileage, 40),
    preferredColors: clip(o.preferredColors, 160),
    nonPreferredColors: clip(o.nonPreferredColors, 160),
    interiorFinish: clip(o.interiorFinish, 160),
    dealLeasingOrCredit: flag(o.dealLeasingOrCredit),
    dealClientFinancing100: flag(o.dealClientFinancing100),
    dealClientFinancing20: flag(o.dealClientFinancing20),
    dealVat21Required: flag(o.dealVat21Required),
    dealServiceStartDeposit: flag(o.dealServiceStartDeposit),
    dealEkki: flag(o.dealEkki),
    equipmentRequired: clip(o.equipmentRequired, 4000),
    equipmentDesired: clip(o.equipmentDesired, 4000),
    note: clip(o.note, 4000),
    status,
    offers: parseOffers(o.offers, createdAt),
    createdAt,
    updatedAt: typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : createdAt,
  };
  try {
    return assertSameTenant(order, tenantId);
  } catch {
    return null;
  }
}

export function createB2bDemoOrder(tenantId: string, input: B2bDemoOrderInput, now = new Date().toISOString()): B2bDemoOrder {
  if (!isSafeB2bDemoTenantId(tenantId)) throw new Error("Nederīgs tenant_id.");
  const base = emptyB2bDemoOrder(tenantId, newB2bDemoOrderId(), now);
  return applyB2bDemoOrderPatch(base, tenantId, input, now);
}

export function applyB2bDemoOrderPatch(
  current: B2bDemoOrder,
  tenantId: string,
  patch: Partial<B2bDemoOrderInput>,
  now = new Date().toISOString(),
): B2bDemoOrder {
  assertSameTenant(current, tenantId);
  const names = resolveNames(
    {
      clientName: patch.clientName !== undefined ? patch.clientName : current.clientName,
      clientFirstName: patch.clientFirstName !== undefined ? patch.clientFirstName : current.clientFirstName,
      clientLastName: patch.clientLastName !== undefined ? patch.clientLastName : current.clientLastName,
    },
    current.clientName,
  );
  const vinRaw = patch.vin !== undefined ? patch.vin : current.vin;
  const offers =
    patch.offers !== undefined
      ? patch.offers
          .map((row) => parseB2bDemoOffer(row, now))
          .filter((row): row is B2bDemoOffer => Boolean(row))
          .map((row, idx) => ({ ...row, title: row.title.trim() || `Piedāvājums ${idx + 1}` }))
      : current.offers;
  return {
    ...current,
    ...names,
    phone: patch.phone !== undefined ? clip(patch.phone, 40) : current.phone,
    email: patch.email !== undefined ? clip(patch.email, 120) : current.email,
    orderDate: patch.orderDate !== undefined ? clip(patch.orderDate, 16) : current.orderDate,
    brandModel: patch.brandModel !== undefined ? clip(patch.brandModel, 160) : current.brandModel,
    vin: normalizeVinField(vinRaw),
    productionYears: patch.productionYears !== undefined ? clip(patch.productionYears, 40) : current.productionYears,
    totalBudget: patch.totalBudget !== undefined ? clip(patch.totalBudget, 40) : current.totalBudget,
    engineType: patch.engineType !== undefined ? clip(patch.engineType, 80) : current.engineType,
    transmission: patch.transmission !== undefined ? clip(patch.transmission, 80) : current.transmission,
    bodyType: patch.bodyType !== undefined ? clip(patch.bodyType, 80) : current.bodyType,
    driveType: patch.driveType !== undefined ? clip(patch.driveType, 80) : current.driveType,
    seatCount: patch.seatCount !== undefined ? clip(patch.seatCount, 20) : current.seatCount,
    maxMileage: patch.maxMileage !== undefined ? clip(patch.maxMileage, 40) : current.maxMileage,
    preferredColors: patch.preferredColors !== undefined ? clip(patch.preferredColors, 160) : current.preferredColors,
    nonPreferredColors: patch.nonPreferredColors !== undefined ? clip(patch.nonPreferredColors, 160) : current.nonPreferredColors,
    interiorFinish: patch.interiorFinish !== undefined ? clip(patch.interiorFinish, 160) : current.interiorFinish,
    dealLeasingOrCredit: patch.dealLeasingOrCredit !== undefined ? flag(patch.dealLeasingOrCredit) : current.dealLeasingOrCredit,
    dealClientFinancing100: patch.dealClientFinancing100 !== undefined ? flag(patch.dealClientFinancing100) : current.dealClientFinancing100,
    dealClientFinancing20: patch.dealClientFinancing20 !== undefined ? flag(patch.dealClientFinancing20) : current.dealClientFinancing20,
    dealVat21Required: patch.dealVat21Required !== undefined ? flag(patch.dealVat21Required) : current.dealVat21Required,
    dealServiceStartDeposit: patch.dealServiceStartDeposit !== undefined ? flag(patch.dealServiceStartDeposit) : current.dealServiceStartDeposit,
    dealEkki: patch.dealEkki !== undefined ? flag(patch.dealEkki) : current.dealEkki,
    equipmentRequired: patch.equipmentRequired !== undefined ? clip(patch.equipmentRequired, 4000) : current.equipmentRequired,
    equipmentDesired: patch.equipmentDesired !== undefined ? clip(patch.equipmentDesired, 4000) : current.equipmentDesired,
    note: patch.note !== undefined ? clip(patch.note, 4000) : current.note,
    status: isB2bDemoOrderStatus(patch.status) ? patch.status : current.status,
    offers,
    updatedAt: now,
  };
}

export function findB2bDemoOffer(order: B2bDemoOrder, offerId: string): B2bDemoOffer | null {
  if (!isSafeB2bDemoOfferId(offerId)) return null;
  return order.offers.find((row) => row.offerId === offerId) ?? null;
}

function str(body: Record<string, unknown>, key: string): string | undefined {
  return typeof body[key] === "string" ? body[key] : undefined;
}

function bool(body: Record<string, unknown>, key: string): boolean | undefined {
  return typeof body[key] === "boolean" ? body[key] : undefined;
}

export function b2bDemoOrderInputFromBody(body: Record<string, unknown>): Partial<B2bDemoOrderInput> {
  const offersRaw = body.offers;
  const offers = Array.isArray(offersRaw)
    ? offersRaw
        .map((row) => parseB2bDemoOffer(row, new Date().toISOString()))
        .filter((row): row is B2bDemoOffer => Boolean(row))
    : undefined;
  return {
    clientName: str(body, "clientName"),
    clientFirstName: str(body, "clientFirstName"),
    clientLastName: str(body, "clientLastName"),
    phone: str(body, "phone"),
    email: str(body, "email"),
    orderDate: str(body, "orderDate"),
    brandModel: str(body, "brandModel"),
    vin: str(body, "vin"),
    productionYears: str(body, "productionYears"),
    totalBudget: str(body, "totalBudget"),
    engineType: str(body, "engineType"),
    transmission: str(body, "transmission"),
    bodyType: str(body, "bodyType"),
    driveType: str(body, "driveType"),
    seatCount: str(body, "seatCount"),
    maxMileage: str(body, "maxMileage"),
    preferredColors: str(body, "preferredColors"),
    nonPreferredColors: str(body, "nonPreferredColors"),
    interiorFinish: str(body, "interiorFinish"),
    dealLeasingOrCredit: bool(body, "dealLeasingOrCredit"),
    dealClientFinancing100: bool(body, "dealClientFinancing100"),
    dealClientFinancing20: bool(body, "dealClientFinancing20"),
    dealVat21Required: bool(body, "dealVat21Required"),
    dealServiceStartDeposit: bool(body, "dealServiceStartDeposit"),
    dealEkki: bool(body, "dealEkki"),
    equipmentRequired: str(body, "equipmentRequired"),
    equipmentDesired: str(body, "equipmentDesired"),
    note: str(body, "note"),
    status: isB2bDemoOrderStatus(body.status) ? body.status : undefined,
    offers,
  };
}
