/**
 * Loģistikas lomai: cenas, klientu dati un šofera personas dokumenti netiek atdoti.
 * VIN pēc noklusējuma: pēdējās 6 zīmes (pilns VIN tikai ja pickup dokumentam tas ir atzīmēts).
 */

const PRICE_KEYS = new Set([
  "price",
  "purchasePrice",
  "pirkumaCena",
  "amount",
  "sum",
  "total",
  "invoice",
  "invoiceTotal",
  "rekins",
  "stavesanasSumma",
  "parkingFee",
  "parkingSum",
  "clientPrice",
  "cena",
]);

const CLIENT_KEYS = new Set([
  "client",
  "clientName",
  "clientEmail",
  "clientPhone",
  "customer",
  "customerName",
  "customerEmail",
  "customerPhone",
  "klients",
  "klientaVards",
  "klientaEpasts",
  "klientaTalrunis",
  "buyer",
  "buyerEmail",
  "buyerPhone",
]);

const DRIVER_PII_KEYS = new Set([
  "driverPassport",
  "driverId",
  "driverPersonalCode",
  "passport",
  "pase",
  "personasKods",
  "driverDocument",
  "soferaPase",
]);

export type LogisticsTripView = {
  id: string;
  vehicleTitle: string;
  pointName: string;
  hours: string;
  deadline: string | null;
  deadlineDays: number | null;
  driverName: string | null;
  vehiclePlate: string | null;
  vinShort: string | null;
};

export type LogisticsPointView = {
  id: string;
  name: string;
  address: string;
  hours: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export function logisticsVinShort(vin: string | null | undefined): string | null {
  const t = (vin ?? "").replace(/\s+/g, "").toUpperCase();
  if (t.length < 6) return t || null;
  return t.slice(-6);
}

export function stripForbiddenLogisticsFields<T extends Record<string, unknown>>(raw: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (PRICE_KEYS.has(key) || CLIENT_KEYS.has(key) || DRIVER_PII_KEYS.has(key)) continue;
    if (key === "vin" && typeof value === "string") {
      out.vinShort = logisticsVinShort(value);
      continue;
    }
    out[key] = value;
  }
  return out as T;
}

export function toLogisticsTripView(raw: Record<string, unknown>): LogisticsTripView {
  const deadline = typeof raw.deadline === "string" ? raw.deadline : null;
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    vehicleTitle: typeof raw.vehicleTitle === "string" ? raw.vehicleTitle : "",
    pointName: typeof raw.pointName === "string" ? raw.pointName : "",
    hours: typeof raw.hours === "string" ? raw.hours : "",
    deadline,
    deadlineDays: typeof raw.deadlineDays === "number" ? raw.deadlineDays : null,
    driverName: typeof raw.driverName === "string" ? raw.driverName : null,
    vehiclePlate: typeof raw.vehiclePlate === "string" ? raw.vehiclePlate : null,
    vinShort: logisticsVinShort(typeof raw.vin === "string" ? raw.vin : typeof raw.vinShort === "string" ? raw.vinShort : null),
  };
}

export function toLogisticsPointView(raw: Record<string, unknown>): LogisticsPointView {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    name: typeof raw.name === "string" ? raw.name : "",
    address: typeof raw.address === "string" ? raw.address : "",
    hours: typeof raw.hours === "string" ? raw.hours : "",
    contactName: typeof raw.contactName === "string" ? raw.contactName : null,
    phone: typeof raw.phone === "string" ? raw.phone : null,
    email: typeof raw.email === "string" ? raw.email : null,
    notes: typeof raw.notes === "string" ? raw.notes : null,
  };
}

export function hasForbiddenLogisticsKey(raw: Record<string, unknown>): boolean {
  return Object.keys(raw).some((key) => PRICE_KEYS.has(key) || CLIENT_KEYS.has(key) || DRIVER_PII_KEYS.has(key));
}
