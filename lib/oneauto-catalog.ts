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
  /engine|dzinēj|motor|transmission|kārba|gearbox|power|jauda|kw|displacement|tilpums|fuel|degviel|oem_/i;

const PENDING_STATUS_RE = /pending|queued|processing|accepted|in.?progress|202/;

const SKIP_META_KEYS = new Set([
  "success",
  "error",
  "request_id",
  "requestId",
  "job_id",
  "jobId",
  "status",
  "state",
  "callback_url",
  "message",
]);

const SERVICE_LIST_KEYS = [
  "service_events",
  "serviceEvents",
  "events",
  "services",
  "history",
  "records",
  "workshop_remarks",
  "workshopRemarks",
  "remarks",
];

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function unwrapResult(raw: unknown): unknown {
  const o = asRecord(raw);
  if (!o) return raw;
  if (o.result != null && o.result !== "") return o.result;
  if (o.data != null && o.data !== "") return o.data;
  return raw;
}

function humanizeKey(k: string): string {
  return k.replace(/^oem_/i, "").replace(/[_-]+/g, " ").trim();
}

export function oneautoPayloadIsPending(httpStatus: number | undefined, payload: unknown): boolean {
  if (httpStatus === 202) return true;
  const o = asRecord(payload);
  if (!o) return false;
  if (o.success === false) return false;
  const status = String(o.status ?? o.state ?? o.message ?? "");
  if (PENDING_STATUS_RE.test(status.toLowerCase())) return true;
  const unwrapped = unwrapResult(payload);
  const inner = asRecord(unwrapped);
  if (inner && PENDING_STATUS_RE.test(String(inner.status ?? inner.state ?? "").toLowerCase())) {
    return true;
  }
  const requestId = String(o.request_id ?? o.requestId ?? o.job_id ?? o.jobId ?? "").trim();
  if (!requestId) return false;
  return !oneautoPayloadHasResultBody(payload);
}

export function oneautoPayloadHasResultBody(payload: unknown): boolean {
  const unwrapped = unwrapResult(payload);
  if (Array.isArray(unwrapped)) return unwrapped.length > 0;
  const o = asRecord(unwrapped);
  if (!o) return typeof unwrapped === "string" && unwrapped.trim().length > 8 && !PENDING_STATUS_RE.test(unwrapped);
  for (const key of SERVICE_LIST_KEYS) {
    if (Array.isArray(o[key])) return true;
  }
  const keys = Object.keys(o).filter((k) => !SKIP_META_KEYS.has(k) && k !== "vehicle_identification_number");
  return keys.some((k) => {
    const v = o[k];
    return v != null && v !== "" && (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || Array.isArray(v) || asRecord(v));
  });
}

export function oneautoServiceHistoryIsEmpty(payload: unknown): boolean {
  const unwrapped = unwrapResult(payload);
  const o = asRecord(unwrapped);
  if (!o) return false;
  let sawList = false;
  for (const key of SERVICE_LIST_KEYS) {
    if (!Array.isArray(o[key])) continue;
    sawList = true;
    if (o[key].length > 0) return false;
  }
  return sawList;
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
    o.date_of_service_event ??
      o.dateOfServiceEvent ??
      o.date ??
      o.service_date ??
      o.eventDate ??
      o.performed_at ??
      o.date_of_workshop_remark ??
      o.remark_date,
  );
  const odometer = stringifyVal(
    o.mileage_observed ?? o.mileageObserved ?? o.odometer ?? o.mileage ?? o.mileage_reading ?? o.km,
  );
  const place = stringifyVal(o.service_provider ?? o.serviceProvider ?? o.dealer ?? o.location ?? o.workshop);
  const works = stringifyVal(
    o.service_actions ??
      o.serviceActions ??
      o.works ??
      o.operations ??
      o.service_type ??
      o.serviceType ??
      o.description ??
      o.remark ??
      o.workshop_remark ??
      o.comments,
  );
  if (date || odometer || works) {
    out.push({ date, odometer, place, works });
    return;
  }
  for (const key of SERVICE_LIST_KEYS) {
    if (o[key] != null) walkService(o[key], out, depth + 1);
  }
  for (const [k, v] of Object.entries(o)) {
    if (SERVICE_LIST_KEYS.includes(k) || SKIP_META_KEYS.has(k)) continue;
    if (Array.isArray(v) || asRecord(v)) walkService(v, out, depth + 1);
  }
}

function flattenScalars(node: unknown, out: OneautoKvRow[], seen: Set<string>, depth = 0): void {
  if (depth > 4 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) flattenScalars(item, out, seen, depth + 1);
    return;
  }
  const o = asRecord(node);
  if (!o) return;
  for (const [k, v] of Object.entries(o)) {
    if (SKIP_META_KEYS.has(k) || k === "vehicle_identification_number") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      pushKv(out, humanizeKey(k), v, seen);
    } else if (Array.isArray(v) || asRecord(v)) {
      flattenScalars(v, out, seen, depth + 1);
    }
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
  flattenScalars(decoder, powertrain, ptSeen);
  flattenScalars(build, powertrain, ptSeen);
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
