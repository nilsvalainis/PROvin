/**
 * IRISS CSDD (TTR) servera VPN vadība: admin poga "Man vajag VPN" -> stop pieprasījums,
 * Hetzner `iriss-vpn-ctl` to nolasa (polling ar Aivara Bearer) un ziņo VPN stāvokli.
 * Serveris nav publiski sasniedzams, tāpēc virziens vienmēr ir serveris -> Vercel.
 */

export type TtrVpnState = "up" | "down" | "unknown";

export type TtrServerReport = {
  vpn: TtrVpnState;
  /** Līdz kuram brīdim VPN turēts (lease); pēc tam idle autostop. */
  leaseUntil: string;
  /** Pēdējais apstrādātais stop pieprasījums (stopRequestedAt vērtība). */
  handledStopAt: string;
  lastStopReason: string;
  reportedAt: string;
};

/** Pavadzīmju worker (Hetzner) sirdspuksts: vai tas strādā īstajā režīmā (IRISS_WAYBILL_WORKER_LIVE=1) vai dry-run. */
export type TtrWorkerHeartbeat = {
  live: boolean;
  seenAt: string;
};

export type TtrControlDoc = {
  version: 1;
  updatedAt: string;
  stopRequestedAt: string;
  stopRequestedBy: string;
  server: TtrServerReport;
  worker: TtrWorkerHeartbeat;
};

/** Serveris ziņo vismaz reizi 5 min; pēc 10 min stāvoklis ir "nav zināms". */
export const TTR_REPORT_STALE_MS = 10 * 60 * 1000;

const STOP_REASONS = new Set(["", "manual", "idle", "external"]);

export function emptyTtrServerReport(): TtrServerReport {
  return { vpn: "unknown", leaseUntil: "", handledStopAt: "", lastStopReason: "", reportedAt: "" };
}

export function emptyTtrControlDoc(): TtrControlDoc {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    stopRequestedAt: "",
    stopRequestedBy: "",
    server: emptyTtrServerReport(),
    worker: { live: false, seenAt: "" },
  };
}

function isoOrEmpty(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) return "";
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

export function parseTtrServerReport(raw: unknown): TtrServerReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const vpn: TtrVpnState = o.vpn === "up" || o.vpn === "down" ? o.vpn : "unknown";
  const reason = typeof o.lastStopReason === "string" && STOP_REASONS.has(o.lastStopReason) ? o.lastStopReason : "";
  return {
    vpn,
    leaseUntil: isoOrEmpty(o.leaseUntil),
    handledStopAt: isoOrEmpty(o.handledStopAt),
    lastStopReason: reason,
    reportedAt: isoOrEmpty(o.reportedAt),
  };
}

export function parseTtrControlDoc(raw: unknown): TtrControlDoc {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyTtrControlDoc();
  const o = raw as Record<string, unknown>;
  return {
    version: 1,
    updatedAt: isoOrEmpty(o.updatedAt) || new Date().toISOString(),
    stopRequestedAt: isoOrEmpty(o.stopRequestedAt),
    stopRequestedBy: typeof o.stopRequestedBy === "string" ? o.stopRequestedBy.slice(0, 64) : "",
    server: parseTtrServerReport(o.server) ?? emptyTtrServerReport(),
    worker: parseTtrWorkerHeartbeat(o.worker),
  };
}

function parseTtrWorkerHeartbeat(raw: unknown): TtrWorkerHeartbeat {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return { live: o.live === true, seenAt: isoOrEmpty(o.seenAt) };
}

/** Worker poll ik 10 s; dokumentu raksta tikai, ja režīms mainījās vai pēdējais ieraksts vecāks par 5 min. */
export const TTR_WORKER_HEARTBEAT_WRITE_MS = 5 * 60 * 1000;

export function workerHeartbeatNeedsWrite(doc: TtrControlDoc, live: boolean, nowMs = Date.now()): boolean {
  const seen = Date.parse(doc.worker.seenAt);
  return doc.worker.live !== live || !Number.isFinite(seen) || nowMs - seen >= TTR_WORKER_HEARTBEAT_WRITE_MS;
}

export function applyTtrWorkerHeartbeat(doc: TtrControlDoc, live: boolean, now = new Date()): TtrControlDoc {
  return { ...doc, worker: { live, seenAt: now.toISOString() } };
}

/** Vai worker tiešām izraksta (live) un ir dzīvs (sirdspuksts nesenāks par 10 min). */
export function waybillWorkerLive(doc: Pick<TtrControlDoc, "worker">, nowMs = Date.now()): boolean {
  const seen = Date.parse(doc.worker.seenAt);
  return doc.worker.live && Number.isFinite(seen) && nowMs - seen <= TTR_REPORT_STALE_MS;
}

export type TtrVpnStatus = {
  vpn: TtrVpnState;
  leaseUntil: string;
  reportedAt: string;
  /** Stop pieprasīts, bet serveris to vēl nav apstrādājis. */
  stopPending: boolean;
  stopRequestedAt: string;
  lastStopReason: string;
};

export function ttrVpnStatus(doc: TtrControlDoc, nowMs = Date.now()): TtrVpnStatus {
  const reported = Date.parse(doc.server.reportedAt);
  const fresh = Number.isFinite(reported) && nowMs - reported <= TTR_REPORT_STALE_MS;
  const stopPending =
    Boolean(doc.stopRequestedAt) &&
    (!doc.server.handledStopAt || Date.parse(doc.server.handledStopAt) < Date.parse(doc.stopRequestedAt));
  return {
    vpn: fresh ? doc.server.vpn : "unknown",
    leaseUntil: fresh ? doc.server.leaseUntil : "",
    reportedAt: doc.server.reportedAt,
    stopPending,
    stopRequestedAt: doc.stopRequestedAt,
    lastStopReason: doc.server.lastStopReason,
  };
}

export function requestTtrVpnStop(doc: TtrControlDoc, by: string, now = new Date()): TtrControlDoc {
  return { ...doc, stopRequestedAt: now.toISOString(), stopRequestedBy: by.slice(0, 64) };
}

export function applyTtrServerReport(doc: TtrControlDoc, report: TtrServerReport, now = new Date()): TtrControlDoc {
  return { ...doc, server: { ...report, reportedAt: now.toISOString() } };
}

/** Teksts admin pogai (latviski, īsā defise). */
export function ttrVpnStatusLabel(status: TtrVpnStatus): string {
  if (status.stopPending) return "Serveris atslēdz VPN...";
  if (status.vpn === "up") return "Serveris lieto VPN";
  if (status.vpn === "down") return "VPN brīvs";
  return "Servera stāvoklis nav zināms";
}
