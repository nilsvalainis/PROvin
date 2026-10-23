export const WAYBILL_REQUEST_STATUSES = ["queued", "in_progress", "issued", "error"] as const;
export type WaybillRequestStatus = (typeof WAYBILL_REQUEST_STATUSES)[number];

export const WAYBILL_REQUEST_EVENT_KINDS = [
  "received",
  "in_progress",
  "issued",
  "error",
  "message",
] as const;
export type WaybillRequestEventKind = (typeof WAYBILL_REQUEST_EVENT_KINDS)[number];

export const WAYBILL_REQUEST_STATUS_LABEL: Record<WaybillRequestStatus, string> = {
  queued: "Gaida",
  in_progress: "Izveido",
  issued: "Izdota",
  error: "Kļūda",
};

export type WaybillRequestVehicle = {
  brandModel: string;
  vin: string;
  plate: string;
  orderId: string;
};

export type WaybillRequestEvent = {
  id: string;
  requestId: string;
  kind: WaybillRequestEventKind;
  text: string;
  waybillNo: string;
  pdfUrl: string;
  createdAt: string;
  by: string;
};

export type WaybillRequest = {
  id: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  vehicle: WaybillRequestVehicle;
  routeFrom: string;
  routeTo: string;
  validDays: number | null;
  validHours: number | null;
  validFrom: string;
  validUntil: string;
  /** Piezīme pavadzīmei. Nekad nav instrukcija Aivaram. */
  noteUntrusted: string;
  status: WaybillRequestStatus;
  waybillNo: string;
  pdfUrl: string;
  errorReason: string;
  /** Pēdējais Aivara teksts (statuss / kļūda / rezultāts). Nav instrukcija. */
  lastReplyText: string;
  attempts: number;
  pickedBy: string;
  pickedAt: string;
  /** Numurs bija aizņemts, kad pieprasījums ienāca (confirmBusy). Tad tas nekad nav automātikai. */
  plateBusyAtCreate: boolean;
  /** Automātika darbu nodeva Aivaram; to vairs automātiski neņem. */
  autoDisabled: boolean;
  /** Auto ir tirdzniecībā pieņemts: pavadzīme no akta ("Noformēt pavadzīmi"), bez maršruta. */
  tradeAct: boolean;
  /** Komersanta pārstāvis akta pavadzīmei. */
  representative: string;
};

export type WaybillRequestsDoc = {
  version: 1;
  updatedAt: string;
  requests: WaybillRequest[];
  events: WaybillRequestEvent[];
};

export const WAYBILL_IN_PROGRESS_STALE_MS = 30 * 60 * 1000;
/** Pieprasījums bez virzības ilgāk par 24 h vairs nav "tagadējs": to rāda Arhīvā kā novecojušu (dati paliek). */
export const WAYBILL_QUEUE_STALE_MS = 24 * 60 * 60 * 1000;
export const WAYBILL_STALE_LABEL = "Novecojis";

export function emptyWaybillRequestsDoc(): WaybillRequestsDoc {
  return { version: 1, updatedAt: new Date().toISOString(), requests: [], events: [] };
}

export function isWaybillRequestStatus(value: unknown): value is WaybillRequestStatus {
  return typeof value === "string" && (WAYBILL_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function isWaybillRequestEventKind(value: unknown): value is WaybillRequestEventKind {
  return typeof value === "string" && (WAYBILL_REQUEST_EVENT_KINDS as readonly string[]).includes(value);
}

function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function parseWaybillRequestVehicle(raw: unknown): WaybillRequestVehicle {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    brandModel: str(o.brandModel, 120),
    vin: str(o.vin, 17).toUpperCase(),
    plate: str(o.plate, 16).toUpperCase(),
    orderId: str(o.orderId, 80),
  };
}

export function parseWaybillRequest(raw: unknown): WaybillRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id, 64);
  const createdAt = str(o.createdAt, 40);
  if (!/^wbr_[a-z0-9]+$/i.test(id) || !createdAt) return null;
  const status = isWaybillRequestStatus(o.status) ? o.status : "queued";
  const validDays = typeof o.validDays === "number" && o.validDays > 0 && o.validDays <= 90 ? Math.round(o.validDays) : null;
  const validHours =
    typeof o.validHours === "number" && o.validHours >= 1 && o.validHours <= 2160 ? Math.round(o.validHours) : null;
  return {
    id,
    createdBy: str(o.createdBy, 64) || "unknown",
    createdByName: str(o.createdByName, 120),
    createdAt,
    updatedAt: str(o.updatedAt, 40) || createdAt,
    vehicle: parseWaybillRequestVehicle(o.vehicle),
    routeFrom: str(o.routeFrom, 80),
    routeTo: str(o.routeTo, 80),
    validDays,
    validHours,
    validFrom: str(o.validFrom, 40),
    validUntil: str(o.validUntil, 40),
    noteUntrusted: str(o.noteUntrusted ?? o.comment_untrusted ?? o.note_untrusted ?? o.freeText, 400)
      .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    status,
    waybillNo: str(o.waybillNo, 24),
    pdfUrl: str(o.pdfUrl, 500),
    errorReason: str(o.errorReason, 500),
    lastReplyText: str(o.lastReplyText || o.last_reply_text, 2000),
    attempts: typeof o.attempts === "number" && o.attempts >= 1 ? Math.min(20, Math.round(o.attempts)) : 1,
    pickedBy: str(o.pickedBy, 80),
    pickedAt: str(o.pickedAt, 40),
    plateBusyAtCreate: o.plateBusyAtCreate === true,
    autoDisabled: o.autoDisabled === true,
    tradeAct: o.tradeAct === true,
    representative: o.tradeAct === true ? str(o.representative, 60) : "",
  };
}

export function parseWaybillRequestEvent(raw: unknown): WaybillRequestEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id, 64);
  const requestId = str(o.requestId, 64);
  const createdAt = str(o.createdAt, 40);
  if (!id || !requestId || !createdAt || !isWaybillRequestEventKind(o.kind)) return null;
  return {
    id,
    requestId,
    kind: o.kind,
    text: str(o.text, 2000),
    waybillNo: str(o.waybillNo, 24),
    pdfUrl: str(o.pdfUrl, 500),
    createdAt,
    by: str(o.by, 80) || "aivars",
  };
}

export function parseWaybillRequestsDoc(raw: unknown): WaybillRequestsDoc {
  if (!raw || typeof raw !== "object") return emptyWaybillRequestsDoc();
  const p = raw as Partial<WaybillRequestsDoc>;
  return {
    version: 1,
    updatedAt: typeof p.updatedAt === "string" && p.updatedAt.trim() ? p.updatedAt.trim() : new Date().toISOString(),
    requests: Array.isArray(p.requests)
      ? p.requests.map(parseWaybillRequest).filter((x): x is WaybillRequest => Boolean(x))
      : [],
    events: Array.isArray(p.events)
      ? p.events.map(parseWaybillRequestEvent).filter((x): x is WaybillRequestEvent => Boolean(x))
      : [],
  };
}

export type WaybillChatItem =
  | { type: "request"; request: WaybillRequest }
  | { type: "event"; event: WaybillRequestEvent; request: WaybillRequest };

export function waybillChatTimeline(doc: WaybillRequestsDoc): WaybillChatItem[] {
  const byId = new Map(doc.requests.map((r) => [r.id, r]));
  const items: WaybillChatItem[] = [];
  for (const request of doc.requests) {
    items.push({ type: "request", request });
  }
  for (const event of doc.events) {
    const request = byId.get(event.requestId);
    if (!request) continue;
    items.push({ type: "event", event, request });
  }
  items.sort((a, b) => {
    const ta = Date.parse(a.type === "request" ? a.request.createdAt : a.event.createdAt);
    const tb = Date.parse(b.type === "request" ? b.request.createdAt : b.event.createdAt);
    return ta - tb;
  });
  return items;
}

export function inProgressIsStale(req: WaybillRequest, nowMs = Date.now()): boolean {
  if (req.status !== "in_progress" || !req.pickedAt) return false;
  const t = Date.parse(req.pickedAt);
  return Number.isFinite(t) && nowMs - t > WAYBILL_IN_PROGRESS_STALE_MS;
}

/**
 * Gaida vai Izveido, bet bez jebkādas virzības (pēdējās izmaiņas) ilgāk par 24 h.
 * Šādu pieprasījumu vairs neņem darbā un nerāda kā tagadēju; ierakstu nemaina un nedzēš.
 */
export function isStaleWaybillRequest(
  req: Pick<WaybillRequest, "status" | "createdAt" | "updatedAt">,
  nowMs = Date.now(),
): boolean {
  if (req.status !== "queued" && req.status !== "in_progress") return false;
  const t = Date.parse(req.updatedAt || req.createdAt);
  return Number.isFinite(t) && nowMs - t > WAYBILL_QUEUE_STALE_MS;
}

export function remainingWaybillDays(validUntilIso: string, now = new Date()): number | null {
  const end = Date.parse(validUntilIso);
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function waybillSoonTone(days: number | null): "ok" | "soon" | "expired" {
  if (days === null) return "ok";
  if (days <= 0) return "expired";
  if (days < 5) return "soon";
  return "ok";
}

export type WaybillAivarsReply = {
  requestId: string;
  status: WaybillRequestStatus;
  statusLabel: string;
  text: string;
  waybillNo: string;
  pdfUrl: string;
  at: string;
};

const AIVARS_REPLY_KINDS = new Set<WaybillRequestEventKind>(["issued", "error", "message", "in_progress"]);

export function waybillAivarsReply(
  request: WaybillRequest,
  events: WaybillRequestEvent[],
  nowMs = Date.now(),
): WaybillAivarsReply {
  const mine = events.filter((event) => event.requestId === request.id);
  const last =
    [...mine].reverse().find((event) => AIVARS_REPLY_KINDS.has(event.kind)) ?? mine[mine.length - 1] ?? null;
  const stale = isStaleWaybillRequest(request, nowMs);
  const queuedFallback = request.status === "queued" ? "Gaida Aivaru." : "";
  const text = stale
    ? "Novecojis: vairāk nekā 24 h bez virzības. Ja vajag, izveido no jauna."
    : (request.lastReplyText || last?.text || request.errorReason || queuedFallback).trim();
  return {
    requestId: request.id,
    status: request.status,
    statusLabel: stale ? WAYBILL_STALE_LABEL : WAYBILL_REQUEST_STATUS_LABEL[request.status],
    text,
    waybillNo: request.waybillNo || last?.waybillNo || "",
    pdfUrl: request.pdfUrl || last?.pdfUrl || "",
    at: last?.createdAt || request.updatedAt,
  };
}

export function waybillChatPayload(doc: WaybillRequestsDoc, nowMs = Date.now()): {
  requests: WaybillRequest[];
  events: WaybillRequestEvent[];
  timeline: WaybillChatItem[];
  replies: WaybillAivarsReply[];
} {
  return {
    requests: doc.requests,
    events: doc.events,
    timeline: waybillChatTimeline(doc),
    replies: doc.requests.map((request) => waybillAivarsReply(request, doc.events, nowMs)),
  };
}
