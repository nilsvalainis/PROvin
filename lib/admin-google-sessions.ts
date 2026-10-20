import "server-only";

import { randomBytes } from "node:crypto";
import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import type { AdminGoogleSessionPayload } from "@/lib/admin-session-token";

/**
 * Admin Google pieteikšanās stāvoklis (viens JSON dokuments Blob / lokāli `.data/admin-google`):
 * piespraustais Google `sub`, sesijas versija ("izrakstīties visur"), sesiju saraksts un žurnāls.
 */

export const ADMIN_GOOGLE_SESSION_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
/** Cik bieži atjaunot `lastSeenAt` (Blob rakstīšana). */
export const ADMIN_GOOGLE_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const SESSIONS_CAP = 50;
const AUDIT_CAP = 300;
const DOC_KEY = "state";

export type AdminGoogleSession = {
  id: string;
  sub: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string;
  userAgent: string;
  revokedAt: string | null;
};

export type AdminGoogleAuditAction =
  | "login_success"
  | "login_failure"
  | "sub_pinned"
  | "logout"
  | "logout_all";

export type AdminGoogleAuditEntry = {
  at: string;
  action: AdminGoogleAuditAction;
  ip: string;
  userAgent: string;
  reason?: string;
  email?: string;
  sid?: string;
};

export type AdminGoogleState = {
  version: 1;
  pinnedSub: string | null;
  pinnedAt: string | null;
  sessionVersion: number;
  sessions: AdminGoogleSession[];
  audit: AdminGoogleAuditEntry[];
};

export function emptyAdminGoogleState(): AdminGoogleState {
  return { version: 1, pinnedSub: null, pinnedAt: null, sessionVersion: 1, sessions: [], audit: [] };
}

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function parseAdminGoogleState(raw: unknown): AdminGoogleState {
  const base = emptyAdminGoogleState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const sessions = Array.isArray(o.sessions)
    ? o.sessions
        .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
        .map((s) => ({
          id: str(s.id, 80),
          sub: str(s.sub, 255),
          createdAt: str(s.createdAt, 40),
          lastSeenAt: str(s.lastSeenAt, 40),
          ip: str(s.ip, 80),
          userAgent: str(s.userAgent),
          revokedAt: typeof s.revokedAt === "string" ? s.revokedAt : null,
        }))
        .filter((s) => s.id && s.sub)
    : [];
  const audit = Array.isArray(o.audit)
    ? o.audit.filter((a): a is AdminGoogleAuditEntry => Boolean(a) && typeof a === "object")
    : [];
  const ver = Number(o.sessionVersion);
  return {
    version: 1,
    pinnedSub: typeof o.pinnedSub === "string" && o.pinnedSub ? o.pinnedSub : null,
    pinnedAt: typeof o.pinnedAt === "string" ? o.pinnedAt : null,
    sessionVersion: Number.isInteger(ver) && ver > 0 ? ver : 1,
    sessions,
    audit,
  };
}

/** Tīra pārbaude: vai sīkdatnes Google sesija joprojām dzīva pēc servera stāvokļa. */
export function isAdminGoogleSessionLive(
  state: AdminGoogleState,
  payload: AdminGoogleSessionPayload,
  nowMs: number = Date.now(),
): boolean {
  if (!state.pinnedSub || payload.sub !== state.pinnedSub) return false;
  if (payload.ver !== state.sessionVersion) return false;
  const session = state.sessions.find((s) => s.id === payload.sid);
  if (!session || session.revokedAt || session.sub !== payload.sub) return false;
  const lastSeen = Date.parse(session.lastSeenAt);
  if (!Number.isFinite(lastSeen) || nowMs - lastSeen > ADMIN_GOOGLE_SESSION_IDLE_MS) return false;
  return true;
}

export type SubPinDecision = { ok: true; pin: boolean } | { ok: false; reason: "sub_mismatch" };

/** Pirmā veiksmīgā pieteikšanās piesprauž `sub`; pēc tam tam jāsakrīt vienmēr. `envSub` (ja iestatīts) ir priekšpiesprausts. */
export function decideSubPin(state: AdminGoogleState, sub: string, envSub: string): SubPinDecision {
  if (envSub && envSub !== sub) return { ok: false, reason: "sub_mismatch" };
  if (!state.pinnedSub) return { ok: true, pin: true };
  return state.pinnedSub === sub ? { ok: true, pin: false } : { ok: false, reason: "sub_mismatch" };
}

function withAudit(state: AdminGoogleState, entry: Omit<AdminGoogleAuditEntry, "at">): AdminGoogleState {
  const row: AdminGoogleAuditEntry = { at: new Date().toISOString(), ...entry };
  return { ...state, audit: [row, ...state.audit].slice(0, AUDIT_CAP) };
}

const store = createJsonDocStore<AdminGoogleState>({
  blobPrefix: "admin-google/",
  dirName: "admin-google",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseAdminGoogleState,
  empty: emptyAdminGoogleState,
});

let writeChain: Promise<unknown> = Promise.resolve();

function mutate<R>(fn: (state: AdminGoogleState) => { value: R; next?: AdminGoogleState }): Promise<R> {
  const run = writeChain.then(
    () => store.update(DOC_KEY, async (current) => fn(current)),
    () => store.update(DOC_KEY, async (current) => fn(current)),
  );
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readAdminGoogleState(): Promise<AdminGoogleState> {
  return store.read(DOC_KEY);
}

export async function appendAdminGoogleAudit(entry: Omit<AdminGoogleAuditEntry, "at">): Promise<void> {
  await mutate((state) => ({ value: undefined, next: withAudit(state, entry) }));
}

export type CreateAdminGoogleSessionResult =
  | { ok: true; sid: string; ver: number }
  | { ok: false; reason: "sub_mismatch" };

/** Atomiski: `sub` piespraušana / pārbaude + jaunas sesijas izveide + žurnāls. */
export async function createAdminGoogleSession(input: {
  sub: string;
  email: string;
  envSub: string;
  ip: string;
  userAgent: string;
}): Promise<CreateAdminGoogleSessionResult> {
  return mutate<CreateAdminGoogleSessionResult>((state) => {
    const decision = decideSubPin(state, input.sub, input.envSub);
    const ctx = { ip: input.ip, userAgent: input.userAgent, email: input.email };
    if (!decision.ok) {
      return { value: decision, next: withAudit(state, { action: "login_failure", reason: decision.reason, ...ctx }) };
    }
    const nowIso = new Date().toISOString();
    let next = state;
    if (decision.pin) {
      next = withAudit({ ...next, pinnedSub: input.sub, pinnedAt: nowIso }, { action: "sub_pinned", ...ctx });
    }
    const sid = `ags_${randomBytes(16).toString("hex")}`;
    const session: AdminGoogleSession = {
      id: sid,
      sub: input.sub,
      createdAt: nowIso,
      lastSeenAt: nowIso,
      ip: input.ip,
      userAgent: input.userAgent.slice(0, 400),
      revokedAt: null,
    };
    next = { ...next, sessions: [session, ...next.sessions].slice(0, SESSIONS_CAP) };
    next = withAudit(next, { action: "login_success", sid, ...ctx });
    return { value: { ok: true, sid, ver: next.sessionVersion }, next };
  });
}

export async function touchAdminGoogleSession(sid: string, nowMs: number = Date.now()): Promise<void> {
  await mutate((state) => {
    const session = state.sessions.find((s) => s.id === sid);
    if (!session || session.revokedAt) return { value: undefined };
    if (nowMs - Date.parse(session.lastSeenAt) < ADMIN_GOOGLE_TOUCH_INTERVAL_MS) return { value: undefined };
    const lastSeenAt = new Date(nowMs).toISOString();
    return {
      value: undefined,
      next: { ...state, sessions: state.sessions.map((s) => (s.id === sid ? { ...s, lastSeenAt } : s)) },
    };
  });
}

export async function revokeAdminGoogleSession(sid: string, ctx: { ip: string; userAgent: string }): Promise<void> {
  await mutate((state) => {
    const session = state.sessions.find((s) => s.id === sid);
    if (!session || session.revokedAt) return { value: undefined };
    const revokedAt = new Date().toISOString();
    const next = { ...state, sessions: state.sessions.map((s) => (s.id === sid ? { ...s, revokedAt } : s)) };
    return { value: undefined, next: withAudit(next, { action: "logout", sid, ...ctx }) };
  });
}

/** "Izrakstīties visur": palielina sesijas versiju un atsauc visas Google sesijas. */
export async function revokeAllAdminGoogleSessions(ctx: { ip: string; userAgent: string }): Promise<number> {
  return mutate((state) => {
    const revokedAt = new Date().toISOString();
    const sessionVersion = state.sessionVersion + 1;
    const next: AdminGoogleState = {
      ...state,
      sessionVersion,
      sessions: state.sessions.map((s) => (s.revokedAt ? s : { ...s, revokedAt })),
    };
    return { value: sessionVersion, next: withAudit(next, { action: "logout_all", ...ctx }) };
  });
}
