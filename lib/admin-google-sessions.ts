import "server-only";

import { randomBytes } from "node:crypto";
import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  ADMIN_GOOGLE_STATE_BLOB_PREFIX,
  ADMIN_GOOGLE_STATE_DOC_KEY,
  emptyAdminGoogleState,
  parseAdminGoogleState,
  type AdminGoogleAuditEntry,
  type AdminGoogleSession,
  type AdminGoogleState,
} from "@/lib/admin-google-session-live";

export {
  ADMIN_GOOGLE_SESSION_IDLE_MS,
  ADMIN_GOOGLE_STATE_BLOB_PATH,
  ADMIN_GOOGLE_STATE_BLOB_PREFIX,
  ADMIN_GOOGLE_STATE_DOC_KEY,
  emptyAdminGoogleState,
  isAdminGoogleSessionLive,
  parseAdminGoogleState,
} from "@/lib/admin-google-session-live";
export type {
  AdminGoogleAuditAction,
  AdminGoogleAuditEntry,
  AdminGoogleSession,
  AdminGoogleState,
} from "@/lib/admin-google-session-live";

/**
 * Admin Google pieteikšanās stāvoklis (viens JSON dokuments Blob / lokāli `.data/admin-google`):
 * piespraustais Google `sub`, sesijas versija ("izrakstīties visur"), sesiju saraksts un žurnāls.
 */

/** Cik bieži atjaunot `lastSeenAt` (Blob rakstīšana). */
export const ADMIN_GOOGLE_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const SESSIONS_CAP = 50;
const AUDIT_CAP = 300;
const DOC_KEY = ADMIN_GOOGLE_STATE_DOC_KEY;

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
  blobPrefix: ADMIN_GOOGLE_STATE_BLOB_PREFIX,
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
