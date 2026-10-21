/**
 * Edge-droša Google admin sesijas pārbaude (versija / allowlist / atsaukšana).
 * Bez Node `fs` vai `server-only`, lai `admin-api-gate` to varētu lietot middleware.
 */

import type { AdminGoogleSessionPayload } from "@/lib/admin-session-token";

export const ADMIN_GOOGLE_SESSION_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
export const ADMIN_GOOGLE_STATE_BLOB_PREFIX = "admin-google/";
export const ADMIN_GOOGLE_STATE_DOC_KEY = "state";
export const ADMIN_GOOGLE_STATE_BLOB_PATH = `${ADMIN_GOOGLE_STATE_BLOB_PREFIX}${ADMIN_GOOGLE_STATE_DOC_KEY}.json`;

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
