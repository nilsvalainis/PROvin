import "server-only";

import { randomBytes } from "node:crypto";
import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import { appendStaffAudit } from "@/lib/staff-store";
import { sanitizeNoteUntrusted, type CreateWaybillInput } from "@/lib/iriss-waybill-create";
import {
  emptyWaybillRequestsDoc,
  inProgressIsStale,
  parseWaybillRequestsDoc,
  type WaybillRequest,
  type WaybillRequestEvent,
  type WaybillRequestEventKind,
  type WaybillRequestStatus,
  type WaybillRequestsDoc,
} from "@/lib/iriss-waybill-requests";

const DOC_KEY = "queue";

const store = createJsonDocStore<WaybillRequestsDoc>({
  blobPrefix: "iriss-waybill-requests/",
  dirName: "iriss-waybill-requests",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseWaybillRequestsDoc,
  empty: emptyWaybillRequestsDoc,
});

let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function mutateDoc<R>(
  mutate: (doc: WaybillRequestsDoc) => { value: R; next?: WaybillRequestsDoc } | Promise<{ value: R; next?: WaybillRequestsDoc }>,
): Promise<R> {
  return withLock(() =>
    store.update(DOC_KEY, async (doc) => {
      const decision = await mutate(doc);
      if (decision.next === undefined) return { value: decision.value };
      return { value: decision.value, next: { ...decision.next, updatedAt: new Date().toISOString() } };
    }),
  );
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function pushEvent(
  doc: WaybillRequestsDoc,
  input: Omit<WaybillRequestEvent, "id" | "createdAt"> & { createdAt?: string },
): WaybillRequestsDoc {
  const event: WaybillRequestEvent = {
    id: newId("wbe"),
    createdAt: input.createdAt ?? new Date().toISOString(),
    requestId: input.requestId,
    kind: input.kind,
    text: input.text,
    waybillNo: input.waybillNo,
    pdfUrl: input.pdfUrl,
    by: input.by,
  };
  return { ...doc, events: [...doc.events, event].slice(-4000) };
}

export async function readWaybillRequestsDoc(): Promise<WaybillRequestsDoc> {
  return store.read(DOC_KEY);
}

export async function createWaybillRequest(input: {
  createdBy: string;
  createdByName: string;
  payload: CreateWaybillInput;
  plateBusyAtCreate?: boolean;
}): Promise<WaybillRequest> {
  const now = new Date().toISOString();
  const payload = input.payload;
  const request: WaybillRequest = {
    id: newId("wbr"),
    createdBy: input.createdBy,
    createdByName: input.createdByName.slice(0, 120),
    createdAt: now,
    updatedAt: now,
    vehicle: {
      brandModel: payload.brandModel.slice(0, 120),
      vin: payload.vin,
      plate: payload.plate,
      orderId: payload.orderId.slice(0, 80),
    },
    routeFrom: payload.routeFrom,
    routeTo: payload.routeTo,
    validDays: payload.validDays,
    validHours: payload.validHours,
    validFrom: payload.validFrom,
    validUntil: payload.validUntil,
    noteUntrusted: sanitizeNoteUntrusted(payload.noteUntrusted),
    status: "queued",
    waybillNo: "",
    pdfUrl: "",
    errorReason: "",
    lastReplyText: "Saņemts. Gaida Aivaru.",
    attempts: 1,
    pickedBy: "",
    pickedAt: "",
    plateBusyAtCreate: input.plateBusyAtCreate === true,
    autoDisabled: false,
  };
  await mutateDoc((doc) => {
    let next: WaybillRequestsDoc = { ...doc, requests: [request, ...doc.requests].slice(0, 2000) };
    next = pushEvent(next, {
      requestId: request.id,
      kind: "received",
      text: "Saņemts. Gaida Aivaru.",
      waybillNo: "",
      pdfUrl: "",
      by: input.createdBy,
    });
    return { value: request, next };
  });
  await recordWaybillAudit({
    userId: input.createdBy,
    action: "waybill_requested",
    target: request.id,
    meta: {
      vin: request.vehicle.vin,
      plate: request.vehicle.plate,
      brandModel: request.vehicle.brandModel,
      routeFrom: request.routeFrom,
      routeTo: request.routeTo,
      noteUntrusted: request.noteUntrusted.slice(0, 200),
    },
  });
  return request;
}

export async function retryWaybillRequest(input: {
  id: string;
  actorId: string;
  actorName: string;
}): Promise<WaybillRequest | null> {
  const updated = await mutateDoc((doc) => {
    const current = doc.requests.find((r) => r.id === input.id);
    if (!current) return { value: null };
    if (current.status !== "error" && current.status !== "queued") return { value: null };
    const now = new Date().toISOString();
    const nextReq: WaybillRequest = {
      ...current,
      status: "queued",
      errorReason: "",
      lastReplyText: `Atkārtots (mēģinājums ${current.attempts + 1}).`,
      attempts: current.attempts + 1,
      pickedBy: "",
      pickedAt: "",
      updatedAt: now,
    };
    let next = {
      ...doc,
      requests: doc.requests.map((r) => (r.id === current.id ? nextReq : r)),
    };
    next = pushEvent(next, {
      requestId: current.id,
      kind: "received",
      text: `Atkārtots (mēģinājums ${nextReq.attempts}).`,
      waybillNo: "",
      pdfUrl: "",
      by: input.actorId,
    });
    return { value: nextReq, next };
  });
  if (updated) {
    await recordWaybillAudit({
      userId: input.actorId,
      action: "waybill_retry",
      target: updated.id,
      meta: { attempts: updated.attempts },
    });
  }
  return updated;
}

export async function listPendingWaybillRequests(nowMs = Date.now()): Promise<WaybillRequest[]> {
  const doc = await readWaybillRequestsDoc();
  return doc.requests.filter((r) => r.status === "queued" || inProgressIsStale(r, nowMs));
}

export async function claimWaybillRequest(
  id: string,
  pickedBy = "aivars",
  /** Papildu pārbaude zem slēdzenes (automātikai: tikai standarta darbi). */
  guard?: (current: WaybillRequest) => boolean,
): Promise<WaybillRequest | null> {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const claimed = await mutateDoc((doc) => {
    const current = doc.requests.find((r) => r.id === id);
    if (!current) return { value: null };
    const stale = inProgressIsStale(current, nowMs);
    if (current.status !== "queued" && !stale) return { value: null };
    if (guard && !guard(current)) return { value: null };
    const nextReq: WaybillRequest = {
      ...current,
      status: "in_progress",
      pickedBy,
      pickedAt: now,
      updatedAt: now,
      errorReason: "",
      lastReplyText: "Paņēmu darbā.",
    };
    let next = { ...doc, requests: doc.requests.map((r) => (r.id === id ? nextReq : r)) };
    next = pushEvent(next, {
      requestId: id,
      kind: "in_progress",
      text: "Paņēmu darbā.",
      waybillNo: "",
      pdfUrl: "",
      by: pickedBy,
    });
    return { value: nextReq, next };
  });
  if (claimed) {
    await recordWaybillAudit({
      userId: claimed.createdBy,
      action: "waybill_claimed",
      target: claimed.id,
      meta: { pickedBy },
    });
  }
  return claimed;
}

/**
 * Automātika nodod darbu Aivaram (pirms Saglabāt): atpakaļ rindā, vairs neautomātisks.
 * Tikai, ja darbu tur automātika.
 */
export async function releaseWaybillRequestToAivars(input: {
  id: string;
  by: string;
  reason: string;
}): Promise<WaybillRequest | null> {
  const now = new Date().toISOString();
  const text = `Automātika nodod Aivaram: ${input.reason}`.trim().slice(0, 500);
  return mutateDoc((doc) => {
    const current = doc.requests.find((r) => r.id === input.id);
    if (!current || current.status !== "in_progress" || current.pickedBy !== input.by) return { value: null };
    const nextReq: WaybillRequest = {
      ...current,
      status: "queued",
      pickedBy: "",
      pickedAt: "",
      autoDisabled: true,
      updatedAt: now,
      lastReplyText: text,
    };
    let next = { ...doc, requests: doc.requests.map((r) => (r.id === input.id ? nextReq : r)) };
    next = pushEvent(next, {
      requestId: input.id,
      kind: "message",
      text,
      waybillNo: "",
      pdfUrl: "",
      by: input.by,
    });
    return { value: nextReq, next };
  });
}

export async function appendWaybillRequestEvent(input: {
  id: string;
  kind: WaybillRequestEventKind;
  text?: string;
  waybillNo?: string;
  pdfUrl?: string;
  errorReason?: string;
  by?: string;
}): Promise<WaybillRequest | null> {
  const by = (input.by ?? "aivars").slice(0, 80);
  const now = new Date().toISOString();
  const statusMap: Partial<Record<WaybillRequestEventKind, WaybillRequestStatus>> = {
    received: "queued",
    in_progress: "in_progress",
    issued: "issued",
    error: "error",
  };
  return mutateDoc((doc) => {
    const current = doc.requests.find((r) => r.id === input.id);
    if (!current) return { value: null };
    const status = statusMap[input.kind] ?? current.status;
    const replyText = (input.text ?? input.errorReason ?? "").trim().slice(0, 2000);
    const nextReq: WaybillRequest = {
      ...current,
      status,
      updatedAt: now,
      waybillNo: input.waybillNo?.trim() ? input.waybillNo.trim().slice(0, 24) : current.waybillNo,
      pdfUrl: input.pdfUrl?.trim() ? input.pdfUrl.trim().slice(0, 500) : current.pdfUrl,
      errorReason: input.kind === "error" ? (input.errorReason ?? input.text ?? "").slice(0, 500) : current.errorReason,
      lastReplyText: replyText || current.lastReplyText,
      pickedBy: input.kind === "in_progress" ? by : current.pickedBy,
      pickedAt: input.kind === "in_progress" ? now : current.pickedAt,
    };
    let next = { ...doc, requests: doc.requests.map((r) => (r.id === input.id ? nextReq : r)) };
    next = pushEvent(next, {
      requestId: input.id,
      kind: input.kind,
      text: (input.text ?? input.errorReason ?? "").slice(0, 2000),
      waybillNo: nextReq.waybillNo,
      pdfUrl: nextReq.pdfUrl,
      by,
    });
    return { value: nextReq, next };
  });
}

export async function completeWaybillRequest(input: {
  id: string;
  ok: boolean;
  waybillNo?: string;
  pdfUrl?: string;
  errorReason?: string;
  by?: string;
}): Promise<WaybillRequest | null> {
  const result = await appendWaybillRequestEvent({
    id: input.id,
    kind: input.ok ? "issued" : "error",
    text: input.ok
      ? `Izdota ${input.waybillNo ?? ""}`.trim()
      : input.errorReason || "Kļūda",
    waybillNo: input.waybillNo,
    pdfUrl: input.pdfUrl,
    errorReason: input.errorReason,
    by: input.by,
  });
  if (result) {
    await recordWaybillAudit({
      userId: result.createdBy,
      action: "waybill_result",
      target: result.id,
      meta: {
        ok: input.ok,
        waybillNo: result.waybillNo,
        errorReason: result.errorReason.slice(0, 200),
      },
    });
  }
  return result;
}

async function recordWaybillAudit(entry: Parameters<typeof appendStaffAudit>[0]): Promise<void> {
  try {
    await appendStaffAudit(entry);
  } catch (err) {
    console.error("[iriss-waybill] audit_failed", err instanceof Error ? err.message : err);
  }
}
