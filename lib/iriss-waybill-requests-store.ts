import "server-only";

import { randomBytes } from "node:crypto";
import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import { appendStaffAudit } from "@/lib/staff-store";
import { sendAdminPush } from "@/lib/admin-push";
import { waybillPushMessage, waybillPushUserKey } from "@/lib/iriss-waybill-push";
import { sanitizeNoteUntrusted, type CreateWaybillInput } from "@/lib/iriss-waybill-create";
import {
  emptyWaybillRequestsDoc,
  inProgressIsStale,
  isStaleWaybillRequest,
  parseWaybillRequestsDoc,
  pendingWaybillRequests,
  waybillPendingExpired,
  waybillRequestCancellable,
  withWaybillLegacyTimeFixes,
  WAYBILL_HANDOFF_TEXT,
  type WaybillWorkerStage,
  type WaybillRequest,
  type WaybillRequestEvent,
  type WaybillRequestEventKind,
  type WaybillRequestStatus,
  type WaybillRequestsDoc,
} from "@/lib/iriss-waybill-requests";
import { displayDealerPlate } from "@/lib/iriss-waybill-plates";
import { saveCsddPlatesReport } from "@/lib/iriss-waybill-csdd-plates-store";

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
  const doc = await store.read(DOC_KEY);
  const requests = withWaybillLegacyTimeFixes(doc.requests);
  return requests === doc.requests ? doc : { ...doc, requests };
}

export async function createWaybillRequest(input: {
  createdBy: string;
  createdByName: string;
  payload: CreateWaybillInput;
  plateBusyAtCreate?: boolean;
  /** Apstiprinātā anulējamā pavadzīme (tikai, ja plateBusyAtCreate). */
  replaceWaybillNo?: string;
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
    replaceWaybillNo:
      input.plateBusyAtCreate === true && /^P\d{5,6}$/.test(String(input.replaceWaybillNo || "").toUpperCase())
        ? String(input.replaceWaybillNo).toUpperCase()
        : "",
    autoDisabled: false,
    tradeAct: payload.tradeAct === true,
    representative: payload.tradeAct === true ? payload.representative.slice(0, 60) : "",
    stage: "",
    stageAt: "",
    dropboxPath: "",
    dropboxError: "",
    dropboxAt: "",
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
      tradeAct: request.tradeAct,
      // Lietotāja apstiprinātā anulējamā pavadzīme ("Vai tiešām anulēt iepriekšējo..." -> Jā); tukšs = nekas.
      replaceWaybillNo: request.replaceWaybillNo ?? "",
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
    // Novecojis "Izveido" (24 h bez virzības) arī drīkst atkārtot; tad tas atkal ir tagadējs.
    if (current.status !== "error" && current.status !== "queued" && !isStaleWaybillRequest(current)) return { value: null };
    const now = new Date().toISOString();
    const nextReq: WaybillRequest = {
      ...current,
      status: "queued",
      errorReason: "",
      lastReplyText: `Atkārtots (mēģinājums ${current.attempts + 1}).`,
      attempts: current.attempts + 1,
      pickedBy: "",
      pickedAt: "",
      stage: "",
      stageAt: "",
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
  return pendingWaybillRequests(doc.requests, nowMs);
}

export type CancelWaybillResult =
  | { ok: true; request: WaybillRequest }
  | { ok: false; reason: "not_found" | "not_pending" };

/**
 * "Atcelt": tikai, ja pieprasījums joprojām Gaida un neviens to nav paņēmis (pārbaude zem slēdzenes).
 * Izdotas/aktīvas pavadzīmes un darbā esošus nekad neaiztiek. Ieraksts paliek (statuss "cancelled").
 */
export async function cancelWaybillRequest(input: {
  id: string;
  actorId: string;
  actorName: string;
}): Promise<CancelWaybillResult> {
  const now = new Date().toISOString();
  const result = await mutateDoc<CancelWaybillResult>((doc) => {
    const current = doc.requests.find((r) => r.id === input.id);
    if (!current) return { value: { ok: false, reason: "not_found" } };
    if (!waybillRequestCancellable(current)) return { value: { ok: false, reason: "not_pending" } };
    const text = `Atcelts${input.actorName ? ` (${input.actorName.slice(0, 60)})` : ""}.`;
    const nextReq: WaybillRequest = {
      ...current,
      status: "cancelled",
      updatedAt: now,
      lastReplyText: text,
      stage: "",
      stageAt: "",
    };
    let next = { ...doc, requests: doc.requests.map((r) => (r.id === current.id ? nextReq : r)) };
    next = pushEvent(next, {
      requestId: current.id,
      kind: "cancelled",
      text,
      waybillNo: "",
      pdfUrl: "",
      by: input.actorId,
    });
    return { value: { ok: true, request: nextReq }, next };
  });
  if (result.ok) {
    await recordWaybillAudit({
      userId: input.actorId,
      action: "waybill_cancelled",
      target: result.request.id,
      meta: {
        plate: result.request.vehicle.plate,
        brandModel: result.request.vehicle.brandModel,
        createdBy: result.request.createdBy,
      },
    });
  }
  return result;
}

export async function claimWaybillRequest(
  id: string,
  pickedBy = "aivars",
  /** Papildu pārbaude zem slēdzenes (automātikai: tikai standarta darbi). */
  guard?: (current: WaybillRequest, doc: WaybillRequestsDoc) => boolean,
): Promise<WaybillRequest | null> {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const claimed = await mutateDoc((doc) => {
    const current = doc.requests.find((r) => r.id === id);
    if (!current) return { value: null };
    const stale = inProgressIsStale(current, nowMs);
    if (current.status !== "queued" && !stale) return { value: null };
    if (isStaleWaybillRequest(current, nowMs)) return { value: null };
    if (waybillPendingExpired(current, nowMs)) return { value: null };
    if (guard && !guard(current, doc)) return { value: null };
    const nextReq: WaybillRequest = {
      ...current,
      status: "in_progress",
      pickedBy,
      pickedAt: now,
      updatedAt: now,
      errorReason: "",
      lastReplyText: "Paņemts darbā.",
      stage: pickedBy === "auto" ? "claimed" : "",
      stageAt: pickedBy === "auto" ? now : "",
    };
    let next = { ...doc, requests: doc.requests.map((r) => (r.id === id ? nextReq : r)) };
    next = pushEvent(next, {
      requestId: id,
      kind: "in_progress",
      text: "Paņemts darbā.",
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
  const released = await mutateDoc<WaybillRequest | null>((doc) => {
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
      stage: "",
      stageAt: "",
      handoffReason: input.reason.slice(0, 300),
      handoffCheckCsdd: false,
      handoffAt: now,
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
  if (released) {
    await recordWaybillAudit({
      userId: released.createdBy,
      action: "waybill_handoff_aivars",
      target: released.id,
      meta: { reason: released.handoffReason ?? "", checkCsddFirst: false },
    });
  }
  return released;
}

/**
 * j47: automātika atsūtīja neveiksmīgu rezultātu (`result ok:false, by:"auto"`). Iepriekš darbs palika "Kļūda" un
 * Aivars to nekad nesaņēma (nav rindā, netiek pamodināts, cron to neredz). Tagad - atpakaļ rindā Aivaram
 * (vairs neautomātisks), ar iemeslu un CSDD pārbaudes pazīmi. Tikai, ja darbu joprojām tur automātika;
 * citādi null (izsaucējs ieraksta parastu rezultātu).
 */
export async function handAutoFailureToAivars(input: {
  id: string;
  reason: string;
  checkCsddFirst: boolean;
}): Promise<WaybillRequest | null> {
  const now = new Date().toISOString();
  const reason = input.reason.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 300) || "kļūda";
  const text = `Automātika neizrakstīja: ${reason} ${WAYBILL_HANDOFF_TEXT}`.slice(0, 500);
  const handed = await mutateDoc<WaybillRequest | null>((doc) => {
    const current = doc.requests.find((r) => r.id === input.id);
    if (!current || current.status !== "in_progress" || current.pickedBy !== AUTO_PICKED_BY) return { value: null };
    const nextReq: WaybillRequest = {
      ...current,
      status: "queued",
      pickedBy: "",
      pickedAt: "",
      autoDisabled: true,
      errorReason: "",
      updatedAt: now,
      lastReplyText: text,
      stage: "",
      stageAt: "",
      handoffReason: reason,
      handoffCheckCsdd: input.checkCsddFirst,
      handoffAt: now,
    };
    let next = { ...doc, requests: doc.requests.map((r) => (r.id === input.id ? nextReq : r)) };
    next = pushEvent(next, {
      requestId: input.id,
      kind: "message",
      text,
      waybillNo: "",
      pdfUrl: "",
      by: AUTO_PICKED_BY,
    });
    return { value: nextReq, next };
  });
  if (handed) {
    await recordWaybillAudit({
      userId: handed.createdBy,
      action: "waybill_handoff_aivars",
      target: handed.id,
      meta: { reason, checkCsddFirst: input.checkCsddFirst },
    });
  }
  return handed;
}

const AUTO_PICKED_BY = "auto";

/** ISO datums, ja derīgs; citādi tukšs (nederīgu vai tukšu vērtību nekad nerakstām pāri). */
function validIso(v: string | undefined): string {
  if (typeof v !== "string" || !v.trim()) return "";
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

export async function appendWaybillRequestEvent(input: {
  id: string;
  kind: WaybillRequestEventKind;
  text?: string;
  waybillNo?: string;
  pdfUrl?: string;
  errorReason?: string;
  by?: string;
  /** Automātikas solis (tikai kamēr darbā). */
  stage?: WaybillWorkerStage;
  /**
   * j57: CSDD rezultātā piešķirtais derīguma laiks (ja zināms) - uzvar pāri portāla pieprasījuma brīdī
   * aprēķinātajam (sk. createWaybillRequest). Piemēro tikai, kad šis notikums izdod pavadzīmi.
   */
  validFrom?: string;
  validUntil?: string;
}): Promise<WaybillRequest | null> {
  const by = (input.by ?? "aivars").slice(0, 80);
  const now = new Date().toISOString();
  const statusMap: Partial<Record<WaybillRequestEventKind, WaybillRequestStatus>> = {
    received: "queued",
    in_progress: "in_progress",
    issued: "issued",
    error: "error",
  };
  const changed = await mutateDoc<{ before: WaybillRequest; after: WaybillRequest } | null>((doc) => {
    const current = doc.requests.find((r) => r.id === input.id);
    if (!current) return { value: null };
    // Atcelts paliek atcelts. Izņēmums: ja CSDD pavadzīme tomēr izdota, patiesība (numurs, PDF) tiek ierakstīta.
    const mapped = statusMap[input.kind] ?? current.status;
    const status = current.status === "cancelled" && mapped !== "issued" ? "cancelled" : mapped;
    const working = status === "in_progress";
    const replyText = (input.text ?? input.errorReason ?? "").trim().slice(0, 2000);
    const nextReq: WaybillRequest = {
      ...current,
      status,
      updatedAt: now,
      waybillNo: input.waybillNo?.trim() ? input.waybillNo.trim().slice(0, 24) : current.waybillNo,
      pdfUrl: input.pdfUrl?.trim() ? input.pdfUrl.trim().slice(0, 500) : current.pdfUrl,
      errorReason: input.kind === "error" ? (input.errorReason ?? input.text ?? "").slice(0, 500) : current.errorReason,
      lastReplyText: replyText || current.lastReplyText,
      pickedBy: input.kind === "in_progress" && working ? by : current.pickedBy,
      pickedAt: input.kind === "in_progress" && working ? now : current.pickedAt,
      stage: working ? (input.stage ?? current.stage) : "",
      stageAt: working ? (input.stage ? now : current.stageAt) : "",
      // j57: izdodot, CSDD īstie laiki (ja zināmi) pārraksta pieprasījuma brīdī aprēķinātos.
      validFrom: status === "issued" ? validIso(input.validFrom) || current.validFrom : current.validFrom,
      validUntil: status === "issued" ? validIso(input.validUntil) || current.validUntil : current.validUntil,
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
    return { value: { before: current, after: nextReq }, next };
  });
  if (!changed) return null;
  await notifyWaybillRequester(changed.before, changed.after);
  return changed.after;
}

/** Push pieprasītāja telefonam: izrakstīta vai kļūda. Kļūda nekad neaptur Aivara atbildi. */
async function notifyWaybillRequester(before: WaybillRequest, after: WaybillRequest): Promise<void> {
  const msg = waybillPushMessage(before, after);
  if (!msg) return;
  try {
    await sendAdminPush(msg, waybillPushUserKey(after.createdBy));
  } catch (err) {
    console.error("[iriss-waybill] push_failed", err instanceof Error ? err.message : err);
  }
}

export async function completeWaybillRequest(input: {
  id: string;
  ok: boolean;
  waybillNo?: string;
  pdfUrl?: string;
  errorReason?: string;
  by?: string;
  /** CSDD piešķirtais derīguma laiks (ja zināms); uzvar pāri pieprasījuma brīdī aprēķinātajam. */
  validFrom?: string;
  validUntil?: string;
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
    validFrom: input.validFrom,
    validUntil: input.validUntil,
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
    if (input.ok) await refreshCsddPlateSnapshot(result);
  }
  return result;
}

/**
 * j57: numura momentuzņēmumu (CSDD, sk. lib/iriss-waybill-csdd-plates.ts) sync.js atjaunina tikai nākamajā
 * cikla, bet aplim "aizņemts" jārāda uzreiz pēc izdošanas - tāpēc paši ieliekam svaigu ierakstu, nevis gaidām.
 * Kļūda nav fatāla (momentuzņēmums tad vienkārši paliek vecs līdz nākamajam sync.js ciklam).
 */
async function refreshCsddPlateSnapshot(request: WaybillRequest): Promise<void> {
  const plate = displayDealerPlate(request.vehicle.plate);
  if (!plate || !request.waybillNo) return;
  try {
    await saveCsddPlatesReport([
      {
        plate,
        ok: true,
        checkedAt: new Date().toISOString(),
        active: [{ waybillNo: request.waybillNo, validUntil: request.validUntil, brandModel: request.vehicle.brandModel }],
        error: "",
      },
    ]);
  } catch (err) {
    console.error("[iriss-waybill] csdd_snapshot_refresh_failed", err instanceof Error ? err.message : err);
  }
}

async function recordWaybillAudit(entry: Parameters<typeof appendStaffAudit>[0]): Promise<void> {
  try {
    await appendStaffAudit(entry);
  } catch (err) {
    console.error("[iriss-waybill] audit_failed", err instanceof Error ? err.message : err);
  }
}

/**
 * Dropbox saglabāšanas rezultāts izdotajai pavadzīmei. Maina TIKAI dropbox* laukus (statusu, numuru, PDF neaiztiek).
 * Jau saglabātu ceļu ar kļūdu nepārraksta.
 */
export async function setWaybillRequestDropbox(input: {
  id: string;
  dropboxPath?: string;
  error?: string;
}): Promise<WaybillRequest | null> {
  const now = new Date().toISOString();
  return mutateDoc<WaybillRequest | null>((doc) => {
    const current = doc.requests.find((r) => r.id === input.id);
    if (!current) return { value: null };
    const path = (input.dropboxPath ?? "").trim().slice(0, 300);
    if (!path && current.dropboxPath) return { value: current };
    const nextReq: WaybillRequest = {
      ...current,
      dropboxPath: path || current.dropboxPath,
      dropboxError: path ? "" : (input.error ?? "").trim().slice(0, 300),
      dropboxAt: now,
    };
    return { value: nextReq, next: { ...doc, requests: doc.requests.map((r) => (r.id === input.id ? nextReq : r)) } };
  });
}
