export const WAYBILL_REQUEST_STATUSES = ["queued", "in_progress", "issued", "error", "cancelled"] as const;
export type WaybillRequestStatus = (typeof WAYBILL_REQUEST_STATUSES)[number];

export const WAYBILL_REQUEST_EVENT_KINDS = [
  "received",
  "in_progress",
  "issued",
  "error",
  "message",
  "cancelled",
] as const;
export type WaybillRequestEventKind = (typeof WAYBILL_REQUEST_EVENT_KINDS)[number];

export const WAYBILL_REQUEST_STATUS_LABEL: Record<WaybillRequestStatus, string> = {
  queued: "Gaida",
  in_progress: "Izveido",
  issued: "Izdota",
  error: "Kļūda",
  cancelled: "Atcelts",
};

/**
 * Automātikas (Hetzner worker) reālais solis darbā. Tukšs = nav zināms (piem. Aivars ar roku).
 * Worker to ziņo ar `events {kind:"message", stage}`; UI rāda tikai šos soļus, bez izdomātiem procentiem.
 */
export const WAYBILL_WORKER_STAGES = ["claimed", "vpn", "checking", "annulling", "filling", "saving", "pdf"] as const;
export type WaybillWorkerStage = (typeof WAYBILL_WORKER_STAGES)[number];

export const WAYBILL_WORKER_STAGE_TEXT: Record<WaybillWorkerStage, string> = {
  claimed: "Automātika paņēma darbā.",
  vpn: "Gaida CSDD savienojumu (VPN).",
  checking: "Pārbauda numuru CSDD...",
  annulling: "Anulē iepriekšējo pavadzīmi CSDD...",
  filling: "Aizpilda CSDD formu...",
  saving: "Saglabā CSDD...",
  pdf: "Saglabāta CSDD, ielādē PDF...",
};

export function isWaybillWorkerStage(value: unknown): value is WaybillWorkerStage {
  return typeof value === "string" && (WAYBILL_WORKER_STAGES as readonly string[]).includes(value);
}

export const WAYBILL_EXPIRED_PENDING_TEXT = "Termiņš beidzies - atcel un izveido jaunu";
export const WAYBILL_AUTO_TEST_MODE_TEXT = "Automātika testa režīmā - pavadzīmi izraksta Aivars ar roku";
export const WAYBILL_AUTO_QUEUED_TEXT = "Rindā automātikai. Sāks pēc brīža.";
/**
 * j16 (Nils 23.10: nekad kluss "Gaida"): ja automātika 2 min laikā darbu nav paņēmusi, UI to saka skaidri.
 * Tajā pašā brīdī darbs kļūst redzams Aivaram (AUTO_WAYBILL_GRACE_MS lib/iriss-waybill-auto.ts).
 */
export const WAYBILL_AUTO_CLAIM_TIMEOUT_MS = 2 * 60 * 1000;
export const WAYBILL_AUTO_NOT_CLAIMED_TEXT =
  "Automātika 2 min laikā darbu nesāka (CSDD savienojums vai serveris nav pieejams). Nodots Aivaram.";
/** Darbā, bet automātika nav ziņojusi jaunu soli tik ilgi (garākais solis CSDD ir ~3 min). */
export const WAYBILL_AUTO_STUCK_MS = 4 * 60 * 1000;

/** Nestandarta darbs (iemesls no klasifikācijas) - teksts, kāpēc to izraksta Aivars. */
export function waybillNotAutoText(reason: string): string {
  const r = reason.trim();
  return r ? `Automātikai neder (${r}). Izraksta Aivars.` : "";
}

/** Automātika darbā, bet nav ziņojusi ilgāk par WAYBILL_AUTO_STUCK_MS: godīgs teksts (bez datu maiņas). */
export function waybillStuckStageText(stage: WaybillWorkerStage, stageAt: string, nowMs = Date.now()): string {
  const t = Date.parse(stageAt);
  if (!Number.isFinite(t) || nowMs - t <= WAYBILL_AUTO_STUCK_MS) return "";
  const min = Math.floor((nowMs - t) / 60_000);
  const step = WAYBILL_WORKER_STAGE_TEXT[stage].replace(/\.+$/, "");
  const afterSave = stage === "saving" || stage === "pdf";
  return afterSave
    ? `Automātika nav ziņojusi ${min} min (pēdējais solis: ${step}). Iespējams, pavadzīme CSDD jau ir - pārbaudi, pirms atkārto.`
    : `Automātika nav ziņojusi ${min} min (pēdējais solis: ${step}). Pavadzīme vēl nav saglabāta; ja steidzami, raksti Aivaram.`;
}
export const WAYBILL_CANCELLED_TEXT = "Atcelts.";

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
  /** Numurs bija aizņemts, kad pieprasījums ienāca (confirmBusy). Automātikai tikai kā "anulēt un izveidot" (replaceWaybillNo). */
  plateBusyAtCreate: boolean;
  /**
   * Lietotājs apstiprināja "Vai tiešām anulēt iepriekšējo un izveidot jaunu?" - TIKAI šī pavadzīme (P0xxxx) drīkst tikt
   * anulēta. Tukšs = nekas netiek anulēts.
   */
  replaceWaybillNo?: string;
  /** Automātika darbu nodeva Aivaram; to vairs automātiski neņem. */
  autoDisabled: boolean;
  /** Auto ir tirdzniecībā pieņemts: pavadzīme no akta ("Noformēt pavadzīmi"), bez maršruta. */
  tradeAct: boolean;
  /** Komersanta pārstāvis akta pavadzīmei. */
  representative: string;
  /** Automātikas pēdējais solis (tikai kamēr darbā; sk. WAYBILL_WORKER_STAGES). */
  stage: WaybillWorkerStage | "";
  stageAt: string;
  /** Izdotās pavadzīmes PDF Dropbox (`/Pavadzīmes_IRISS/...`), pārbaudīts ar get_metadata. Tukšs = vēl nav. */
  dropboxPath: string;
  /** Pēdējā Dropbox saglabāšanas kļūda (rāda adminam; cron mēģina vēlreiz). */
  dropboxError: string;
  dropboxAt: string;
  /**
   * j47: automātika darbu neizrakstīja un nodeva Aivaram (release vai neveiksmīgs rezultāts). Teksts Aivaram,
   * vai pirms izrakstīšanas jāpārbauda CSDD (kļūda Saglabāt laikā/pēc), un kad nodots. Tukšs = nav nodots.
   */
  handoffReason?: string;
  handoffCheckCsdd?: boolean;
  handoffAt?: string;
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
    replaceWaybillNo: /^P\d{5,6}$/.test(str(o.replaceWaybillNo, 12).toUpperCase()) ? str(o.replaceWaybillNo, 12).toUpperCase() : "",
    autoDisabled: o.autoDisabled === true,
    tradeAct: o.tradeAct === true,
    representative: o.tradeAct === true ? str(o.representative, 60) : "",
    stage: isWaybillWorkerStage(o.stage) ? o.stage : "",
    stageAt: str(o.stageAt, 40),
    dropboxPath: str(o.dropboxPath, 300),
    dropboxError: str(o.dropboxError, 300),
    dropboxAt: str(o.dropboxAt, 40),
    handoffReason: str(o.handoffReason, 300),
    handoffCheckCsdd: o.handoffCheckCsdd === true,
    handoffAt: str(o.handoffAt, 40),
  };
}

/**
 * j47: automātikas neveiksmīgs rezultāts (`result ok:false, by:"auto"`) nedrīkst klusi palikt "Kļūda" - pavadzīme
 * nav izrakstīta un Aivars par to neuzzina. Visu nododam Aivaram, IZŅEMOT "numurs CSDD aizņemts" (tur jāizlemj
 * lietotājam: nosūtīt vēlreiz un apstiprināt anulēšanu). checkCsddFirst: ja nav droši zināms, ka CSDD pavadzīme
 * NAV izveidota (kļūda Saglabāt laikā/pēc), Aivars vispirms pārbauda CSDD, lai neizrakstītu dublikātu.
 */
export function autoFailureHandoff(errorReason: string): { handoff: boolean; checkCsddFirst: boolean } {
  const text = errorReason.trim();
  if (/CSDD aizņem/i.test(text)) return { handoff: false, checkCsddFirst: false };
  return { handoff: true, checkCsddFirst: !/NAV izveidota/.test(text) };
}

export const WAYBILL_HANDOFF_TEXT = "Nodots Aivaram - izraksta ar roku.";

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

/**
 * Čata skats (dators, kolēģa logrīks): jaunākais pieprasījums augšā (Nils 23.10: lapa nedrīkst atvērties ar vecāko).
 * Pieprasījuma notikumi paliek tieši zem tā hronoloģiskā secībā.
 */
export function waybillChatTimelineNewestFirst(items: readonly WaybillChatItem[]): WaybillChatItem[] {
  const groups = new Map<string, { at: number; items: WaybillChatItem[] }>();
  for (const item of items) {
    const id = item.request.id;
    const g = groups.get(id) ?? { at: Date.parse(item.request.createdAt) || 0, items: [] };
    g.items.push(item);
    groups.set(id, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.at - a.at)
    .flatMap((g) => [...g.items.filter((i) => i.type === "request"), ...g.items.filter((i) => i.type !== "request")]);
}

export function inProgressIsStale(req: WaybillRequest, nowMs = Date.now()): boolean {
  if (req.status !== "in_progress" || !req.pickedAt) return false;
  const t = Date.parse(req.pickedAt);
  return Number.isFinite(t) && nowMs - t > WAYBILL_IN_PROGRESS_STALE_MS;
}

/** "Atcelt" drīkst tikai pieprasījumam, ko neviens vēl nav paņēmis (Gaida, bez pickedBy). */
export function waybillRequestCancellable(req: Pick<WaybillRequest, "status" | "pickedBy">): boolean {
  return req.status === "queued" && !req.pickedBy;
}

/** Vēl gaida, bet pieprasītais derīguma beigu laiks jau pagājis: tādu vairs neizraksta (ne automātika, ne Aivars). */
export function waybillPendingExpired(
  req: Pick<WaybillRequest, "status" | "validUntil">,
  nowMs = Date.now(),
): boolean {
  if (req.status !== "queued") return false;
  const until = Date.parse(req.validUntil);
  return Number.isFinite(until) && until <= nowMs;
}

/**
 * Darbi Aivaram / automātikai. Novecojušos (24 h bez virzības) un tos, kam pieprasītais termiņš jau beidzies,
 * vairs nerāda: vecs pieprasījums nedrīkst pēkšņi kļūt par pavadzīmi. Atceltie nekad nav rindā.
 */
export function pendingWaybillRequests(requests: readonly WaybillRequest[], nowMs = Date.now()): WaybillRequest[] {
  return requests.filter(
    (r) =>
      (r.status === "queued" || inProgressIsStale(r, nowMs)) &&
      !isStaleWaybillRequest(r, nowMs) &&
      !waybillPendingExpired(r, nowMs),
  );
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

export type WaybillWrittenOffRequest = Pick<WaybillRequest, "id" | "status" | "vehicle" | "createdAt" | "updatedAt" | "validUntil">;

const samePlate = (a: string, b: string) => a.trim().toUpperCase().replace(/[\s-]/g, "") === b.trim().toUpperCase().replace(/[\s-]/g, "");

/**
 * Kad izdotā pavadzīme kļuva nederīga ("Izrakstīta"): derīguma beigas vai brīdis, kad tam pašam numuram izdota
 * jaunāka (jauna pavadzīme pārtrauc esošo). null = vēl derīga vai nav izdota. Dati netiek mainīti.
 */
export function waybillWrittenOffAtMs(
  request: WaybillWrittenOffRequest,
  requests: ReadonlyArray<WaybillWrittenOffRequest>,
  nowMs = Date.now(),
): number | null {
  if (request.status !== "issued") return null;
  let end = Date.parse(request.validUntil);
  for (const other of requests) {
    if (other.id === request.id || other.status !== "issued" || other.createdAt <= request.createdAt) continue;
    if (!samePlate(other.vehicle.plate, request.vehicle.plate)) continue;
    const at = Date.parse(other.updatedAt || other.createdAt);
    if (Number.isFinite(at) && (!Number.isFinite(end) || at < end)) end = at;
  }
  return Number.isFinite(end) && end <= nowMs ? end : null;
}

/**
 * "Dzēst" pirmās lapas sarakstā (j22): drīkst paslēpt TIKAI vecu ierakstu - izrakstītu (beigusies vai aizstāta),
 * kļūdu, atceltu vai novecojušu. Darbā esošu un derīgu izdotu pavadzīmi nekad. Paslēpšana ierakstu nemaina.
 */
export function waybillRequestDismissable(
  request: WaybillWrittenOffRequest,
  requests: ReadonlyArray<WaybillWrittenOffRequest>,
  nowMs = Date.now(),
): boolean {
  if (request.status === "queued" || request.status === "in_progress") return isStaleWaybillRequest(request, nowMs);
  if (request.status === "issued") return waybillWrittenOffAtMs(request, requests, nowMs) != null;
  return true;
}

/** Cik paslēpto ID glabā vienam lietotājam (vecākie izkrīt; tie jau sen ir tikai Arhīvā). */
export const WAYBILL_DISMISSED_MAX = 300;

/** Paslēpto saraksts pēc "Dzēst": bez dublikātiem, jaunākais beigās, ne vairāk par WAYBILL_DISMISSED_MAX. */
export function addDismissedWaybillId(ids: ReadonlyArray<string>, id: string): string[] {
  return [...ids.filter((row) => row !== id), id].slice(-WAYBILL_DISMISSED_MAX);
}

export function parseDismissedWaybillDoc(raw: unknown): { version: 1; ids: string[] } {
  const list = raw && typeof raw === "object" ? (raw as { ids?: unknown }).ids : null;
  const ids = Array.isArray(list) ? list.filter((v): v is string => typeof v === "string" && /^wbr_[a-z0-9]+$/i.test(v)) : [];
  return { version: 1, ids: ids.slice(-WAYBILL_DISMISSED_MAX) };
}

export function remainingWaybillDays(validUntilIso: string, now = new Date()): number | null {
  const end = Date.parse(validUntilIso);
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * j57 (24.10): P00746 (SIA Dzintarzeme Auto, B192-7) izdota, kad rezultāts CSDD derīguma laikus vēl nesūtīja
 * (tagad sūta - sk. completeWaybillRequest), tāpēc ierakstā paliek portāla pieprasījuma brīdī aprēķinātais
 * laiks, ne CSDD piešķirtais: CSDD 24.10.2026 20:49 - 26.10.2026 20:49 (Rīgas laiks). Tikai šī viena ieraksta
 * laiki, tikai lasīšanas brīdī - uzglabātie dati netiek mainīti.
 */
const WAYBILL_LEGACY_TIME_FIX: Readonly<Record<string, { validFrom: string; validUntil: string }>> = {
  P00746: { validFrom: "2026-10-24T17:49:00.000Z", validUntil: "2026-10-26T18:49:00.000Z" },
};

export function withWaybillLegacyTimeFixes(requests: WaybillRequest[]): WaybillRequest[] {
  let changed = false;
  const next = requests.map((r) => {
    const fix = r.status === "issued" ? WAYBILL_LEGACY_TIME_FIX[r.waybillNo] : undefined;
    if (!fix || (r.validFrom === fix.validFrom && r.validUntil === fix.validUntil)) return r;
    changed = true;
    return { ...r, validFrom: fix.validFrom, validUntil: fix.validUntil };
  });
  return changed ? next : requests;
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
  /** Automātikas solis (tikai Izveido). */
  stage?: WaybillWorkerStage | "";
  /** Gaida, bet termiņš jau beidzies. */
  expired?: boolean;
  /** "live" = automātika ieslēgta un worker strādā īstajā režīmā; "test" = izraksta Aivars ar roku. */
  autoMode?: WaybillAutoMode;
  /** Gaidošo šis darbs ir automātikai (standarta pēc lib/iriss-waybill-auto.ts). */
  autoStandard?: boolean;
  /** Gaidošais nav automātikai: iemesls (piem. "numurs aizņemts"). */
  autoReason?: string;
  /** "Saglabāt PDF" redzams (izdota, ir PDF, skatītājam ir tiesības; sk. lib/iriss-waybill-pdf.ts). */
  canSavePdf?: boolean;
  dropboxPath?: string;
  dropboxError?: string;
};

export type WaybillAutoMode = "live" | "test";

/** Automātikas konteksts atbildēm (serveris: env + worker sirdspuksts + klasifikācija). */
export type WaybillAutoContext = {
  mode: WaybillAutoMode;
  isStandard: (request: WaybillRequest) => boolean;
  /** Kāpēc darbs nav automātikai (tukšs = standarta vai nav zināms). */
  reasonFor?: (request: WaybillRequest) => string;
};

/** Godīgs teksts gaidošam pieprasījumam (bez procentiem). */
export function waybillQueuedText(input: {
  expired: boolean;
  autoMode?: WaybillAutoMode;
  autoStandard?: boolean;
  /** Cik ilgi gaida (kopš izveides / pēdējās izmaiņas). */
  waitedMs?: number;
  /** Nestandarta iemesls (tikai live režīmā). */
  autoReason?: string;
}): string {
  if (input.expired) return WAYBILL_EXPIRED_PENDING_TEXT;
  if (input.autoMode === "test") return WAYBILL_AUTO_TEST_MODE_TEXT;
  if (input.autoMode === "live" && input.autoStandard) {
    return (input.waitedMs ?? 0) > WAYBILL_AUTO_CLAIM_TIMEOUT_MS ? WAYBILL_AUTO_NOT_CLAIMED_TEXT : WAYBILL_AUTO_QUEUED_TEXT;
  }
  if (input.autoMode === "live" && input.autoStandard === false && input.autoReason) return waybillNotAutoText(input.autoReason);
  return "";
}

/**
 * Gaidīšanas ilgums automātikai: no izveides (automātikas ziņas un citi notikumi maina updatedAt, bet taimeri neatliek;
 * atkārtots pieprasījums automātikai vairs nav).
 */
export function waybillQueuedWaitedMs(request: Pick<WaybillRequest, "createdAt">, nowMs = Date.now()): number {
  const t = Date.parse(request.createdAt);
  return Number.isFinite(t) ? Math.max(0, nowMs - t) : 0;
}

const AIVARS_REPLY_KINDS = new Set<WaybillRequestEventKind>(["issued", "error", "message", "in_progress"]);

export function waybillAivarsReply(
  request: WaybillRequest,
  events: WaybillRequestEvent[],
  nowMs = Date.now(),
  auto?: WaybillAutoContext,
): WaybillAivarsReply {
  const mine = events.filter((event) => event.requestId === request.id);
  const last =
    [...mine].reverse().find((event) => AIVARS_REPLY_KINDS.has(event.kind)) ?? mine[mine.length - 1] ?? null;
  const stale = isStaleWaybillRequest(request, nowMs);
  const queuedFallback = request.status === "queued" ? "Gaida Aivaru." : "";
  const expired = waybillPendingExpired(request, nowMs);
  const autoStandard = request.status === "queued" && auto ? auto.isStandard(request) : undefined;
  const autoReason = request.status === "queued" && auto?.reasonFor && autoStandard === false ? auto.reasonFor(request) : "";
  // j47: automātikas nodots darbs - rāda, kāpēc nodots un ka izraksta Aivars (nevis vispārīgu "neder").
  const handedText = request.status === "queued" && request.handoffAt && !expired ? request.lastReplyText : "";
  const queuedHonest = handedText
    ? handedText
    : request.status === "queued"
      ? waybillQueuedText({ expired, autoMode: auto?.mode, autoStandard, autoReason, waitedMs: waybillQueuedWaitedMs(request, nowMs) })
      : "";
  const stageText =
    request.status === "in_progress" && request.stage
      ? waybillStuckStageText(request.stage, request.stageAt, nowMs) || WAYBILL_WORKER_STAGE_TEXT[request.stage]
      : "";
  const text = stale
    ? "Novecojis: vairāk nekā 24 h bez virzības. Ja vajag, izveido no jauna."
    : request.status === "cancelled"
      ? WAYBILL_CANCELLED_TEXT
      : (queuedHonest || stageText || request.lastReplyText || last?.text || request.errorReason || queuedFallback).trim();
  return {
    requestId: request.id,
    status: request.status,
    statusLabel: stale ? WAYBILL_STALE_LABEL : WAYBILL_REQUEST_STATUS_LABEL[request.status],
    text,
    waybillNo: request.waybillNo || last?.waybillNo || "",
    pdfUrl: request.pdfUrl || last?.pdfUrl || "",
    at: last?.createdAt || request.updatedAt,
    stage: request.status === "in_progress" ? request.stage : "",
    expired,
    ...(auto ? { autoMode: auto.mode } : {}),
    ...(autoStandard !== undefined ? { autoStandard } : {}),
    ...(autoReason ? { autoReason } : {}),
  };
}

/** Darbiniekam bez Pasūtījumiem: pieprasījumos nav IRISS pasūtījuma ID. */
export function waybillRequestWithoutOrder(request: WaybillRequest): WaybillRequest {
  return request.vehicle.orderId ? { ...request, vehicle: { ...request.vehicle, orderId: "" } } : request;
}

export function waybillDocWithoutOrders(doc: WaybillRequestsDoc): WaybillRequestsDoc {
  return { ...doc, requests: doc.requests.map(waybillRequestWithoutOrder) };
}

export function waybillChatPayload(doc: WaybillRequestsDoc, nowMs = Date.now(), auto?: WaybillAutoContext): {
  requests: WaybillRequest[];
  events: WaybillRequestEvent[];
  timeline: WaybillChatItem[];
  replies: WaybillAivarsReply[];
} {
  return {
    requests: doc.requests,
    events: doc.events,
    timeline: waybillChatTimeline(doc),
    replies: doc.requests.map((request) => waybillAivarsReply(request, doc.events, nowMs, auto)),
  };
}
