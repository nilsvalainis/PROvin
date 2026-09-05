export const ONEAUTO_SOURCE_TAG = "oneautoapi" as const;

export const ONEAUTO_PRODUCT_IDS = [
  "vin_decoder",
  "oe_build_sheet",
  "oe_service_history",
  "oe_service_schedule",
] as const;

export type OneautoProductId = (typeof ONEAUTO_PRODUCT_IDS)[number];

export type OneautoProduct = {
  id: OneautoProductId;
  label: string;
  hint: string;
  /** Cena eiro centos (0.18 € = 18). */
  priceCents: number;
  /** Relatīvs ceļš pret `ONEAUTO_API_BASE_URL`. */
  path: string;
};

export const ONEAUTO_PRODUCTS: readonly OneautoProduct[] = [
  {
    id: "vin_decoder",
    label: "VIN Decoder",
    hint: "",
    priceCents: 18,
    path: "/ezyvin/vinlookup/",
  },
  {
    id: "oe_build_sheet",
    label: "OE Build Sheet (Europe)",
    hint: "Factory Options, PR Codes, Colors",
    priceCents: 195,
    path: "/ezyvin/buildsheet/",
  },
  {
    id: "oe_service_history",
    label: "OE Service History (Europe)",
    hint: "Dealer Service Records",
    priceCents: 300,
    path: "/ezyvin/servicehistory/",
  },
  {
    id: "oe_service_schedule",
    label: "OE Service Schedule",
    hint: "SMR Maintenance Intervals",
    priceCents: 210,
    path: "/ezyvin/serviceschedule/",
  },
] as const;

export function isOneautoProductId(v: string): v is OneautoProductId {
  return (ONEAUTO_PRODUCT_IDS as readonly string[]).includes(v);
}

export function parseOneautoProductIds(raw: unknown): OneautoProductId[] {
  if (!Array.isArray(raw)) return [];
  const out: OneautoProductId[] = [];
  const seen = new Set<OneautoProductId>();
  for (const item of raw) {
    if (typeof item !== "string" || !isOneautoProductId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function oneautoProductsCostCents(ids: readonly OneautoProductId[]): number {
  let sum = 0;
  for (const id of ids) {
    const p = ONEAUTO_PRODUCTS.find((x) => x.id === id);
    if (p) sum += p.priceCents;
  }
  return sum;
}

export function formatOneautoCostEur(cents: number): string {
  const n = Math.max(0, cents) / 100;
  return `€${n.toFixed(2)}`;
}

export type OneautoKvRow = { label: string; value: string };
export type OneautoServiceEvent = { date: string; odometer: string; place: string; works: string };

export type OneautoDisplaySections = {
  equipment: OneautoKvRow[];
  serviceTimeline: OneautoServiceEvent[];
  powertrain: OneautoKvRow[];
};

const POWERTRAIN_LABEL_RE =
  /engine|dzinēj|motor|transmission|kārba|gearbox|power|jauda|kw|displacement|tilpums|fuel|degviel/i;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function unwrapResult(raw: unknown): unknown {
  const o = asRecord(raw);
  if (!o) return raw;
  if (o.result != null) return o.result;
  if (o.data != null) return o.data;
  return raw;
}

function stringifyVal(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => stringifyVal(x)).filter(Boolean).join("; ");
  const o = asRecord(v);
  if (!o) return "";
  const named = o.name ?? o.label ?? o.description ?? o.value ?? o.code;
  if (named != null && (typeof named === "string" || typeof named === "number")) return String(named).trim();
  return "";
}

function pushKv(out: OneautoKvRow[], label: string, value: unknown, seen: Set<string>) {
  const v = stringifyVal(value);
  const l = label.trim();
  if (!l || !v) return;
  const key = `${l.toLowerCase()}|${v.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ label: l, value: v });
}

function walkEquipment(node: unknown, out: OneautoKvRow[], seen: Set<string>, depth = 0): void {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkEquipment(item, out, seen, depth + 1);
    return;
  }
  const o = asRecord(node);
  if (!o) return;
  const label = stringifyVal(o.name ?? o.label ?? o.description ?? o.option ?? o.pr_code ?? o.code);
  const value = stringifyVal(o.value ?? o.text ?? o.detail ?? o.status);
  if (label && value) pushKv(out, label, value, seen);
  else if (label && !value) pushKv(out, "Pozīcija", label, seen);
  for (const [k, v] of Object.entries(o)) {
    if (["name", "label", "description", "option", "pr_code", "code", "value", "text", "detail", "status"].includes(k)) {
      continue;
    }
    if (Array.isArray(v) || asRecord(v)) walkEquipment(v, out, seen, depth + 1);
  }
}

function walkService(node: unknown, out: OneautoServiceEvent[], depth = 0): void {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkService(item, out, depth + 1);
    return;
  }
  const o = asRecord(node);
  if (!o) return;
  const date = stringifyVal(
    o.date_of_service_event ?? o.date ?? o.service_date ?? o.eventDate ?? o.performed_at,
  );
  const odometer = stringifyVal(o.mileage_observed ?? o.odometer ?? o.mileage ?? o.km);
  const place = stringifyVal(o.service_provider ?? o.dealer ?? o.location ?? o.workshop);
  const works = stringifyVal(o.service_actions ?? o.works ?? o.operations ?? o.service_type ?? o.description);
  if (date || odometer || works) {
    out.push({ date, odometer, place, works });
    return;
  }
  for (const v of Object.values(o)) {
    if (Array.isArray(v) || asRecord(v)) walkService(v, out, depth + 1);
  }
}

function walkPowertrain(node: unknown, out: OneautoKvRow[], seen: Set<string>, depth = 0): void {
  if (depth > 5 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkPowertrain(item, out, seen, depth + 1);
    return;
  }
  const o = asRecord(node);
  if (!o) return;
  for (const [k, v] of Object.entries(o)) {
    if (POWERTRAIN_LABEL_RE.test(k) && (typeof v === "string" || typeof v === "number")) {
      pushKv(out, k.replace(/[_-]+/g, " "), v, seen);
    } else if (Array.isArray(v) || asRecord(v)) {
      walkPowertrain(v, out, seen, depth + 1);
    }
  }
}

export function buildOneautoDisplay(results: Partial<Record<OneautoProductId, unknown>>): OneautoDisplaySections {
  const equipment: OneautoKvRow[] = [];
  const serviceTimeline: OneautoServiceEvent[] = [];
  const powertrain: OneautoKvRow[] = [];
  const eqSeen = new Set<string>();
  const ptSeen = new Set<string>();

  const decoder = unwrapResult(results.vin_decoder);
  const build = unwrapResult(results.oe_build_sheet);
  const history = unwrapResult(results.oe_service_history);
  const schedule = unwrapResult(results.oe_service_schedule);

  walkEquipment(build, equipment, eqSeen);
  walkPowertrain(decoder, powertrain, ptSeen);
  walkPowertrain(build, powertrain, ptSeen);
  walkService(history, serviceTimeline);
  walkService(schedule, serviceTimeline);

  return {
    equipment: equipment.slice(0, 80),
    serviceTimeline: serviceTimeline.slice(0, 80),
    powertrain: powertrain.slice(0, 40),
  };
}

export function oneautoDisplayHasRows(d: OneautoDisplaySections | null | undefined): boolean {
  if (!d) return false;
  return d.equipment.length > 0 || d.serviceTimeline.length > 0 || d.powertrain.length > 0;
}
