import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import { hashStaffPassword, isUsableStaffPassword, verifyStaffPassword } from "@/lib/staff-password";
import {
  ENV_ADMIN_USER_ID,
  normalizeStaffEmail,
  normalizeStaffSections,
  type IrissSection,
  type StaffRole,
} from "@/lib/staff-roles";
import { STAFF_SESSION_IDLE_MS, STAFF_SESSION_MAX_AGE_MS } from "@/lib/staff-session-token";
import {
  isStaffUserId,
  parseStaffAuditEntry,
  parseStaffInvite,
  parseStaffSession,
  parseStaffUser,
  toPublicStaffUser,
  type StaffAuditAction,
  type StaffAuditEntry,
  type StaffInvite,
  type StaffSession,
  type StaffUser,
  type StaffUserPublic,
} from "@/lib/staff-types";

const DOC_KEY = "access";
const AUDIT_CAP = 3000;
export const STAFF_INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const STAFF_LOGIN_MAX_ATTEMPTS = 5;
export const STAFF_LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type StaffAccessDoc = {
  version: 1;
  updatedAt: string;
  users: StaffUser[];
  sessions: StaffSession[];
  invites: StaffInvite[];
  audit: StaffAuditEntry[];
};

export function emptyStaffAccessDoc(): StaffAccessDoc {
  return { version: 1, updatedAt: new Date().toISOString(), users: [], sessions: [], invites: [], audit: [] };
}

export function parseStaffAccessDoc(raw: unknown): StaffAccessDoc {
  if (!raw || typeof raw !== "object") throw new Error("invalid_staff_doc");
  const p = raw as Partial<StaffAccessDoc>;
  const users = Array.isArray(p.users) ? p.users.map(parseStaffUser).filter((x): x is StaffUser => Boolean(x)) : [];
  const sessions = Array.isArray(p.sessions)
    ? p.sessions.map(parseStaffSession).filter((x): x is StaffSession => Boolean(x))
    : [];
  const invites = Array.isArray(p.invites)
    ? p.invites.map(parseStaffInvite).filter((x): x is StaffInvite => Boolean(x))
    : [];
  const audit = Array.isArray(p.audit)
    ? p.audit.map(parseStaffAuditEntry).filter((x): x is StaffAuditEntry => Boolean(x))
    : [];
  return {
    version: 1,
    updatedAt:
      typeof p.updatedAt === "string" && p.updatedAt.trim() ? p.updatedAt.trim() : new Date().toISOString(),
    users,
    sessions,
    invites,
    audit,
  };
}

const store = createJsonDocStore<StaffAccessDoc>({
  blobPrefix: "iriss-staff/",
  dirName: "iriss-staff",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseStaffAccessDoc,
  empty: emptyStaffAccessDoc,
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
  mutate: (doc: StaffAccessDoc) => { value: R; next?: StaffAccessDoc } | Promise<{ value: R; next?: StaffAccessDoc }>,
): Promise<R> {
  return withLock(() =>
    store.update(DOC_KEY, async (doc) => {
      const decision = await mutate(doc);
      if (decision.next === undefined) return { value: decision.value };
      return {
        value: decision.value,
        next: { ...decision.next, updatedAt: new Date().toISOString() },
      };
    }),
  );
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newInviteToken(): string {
  return randomBytes(32).toString("hex");
}

function appendAudit(doc: StaffAccessDoc, entry: Omit<StaffAuditEntry, "id" | "createdAt"> & { createdAt?: string }): StaffAccessDoc {
  const row: StaffAuditEntry = {
    id: newId("aud"),
    createdAt: entry.createdAt ?? new Date().toISOString(),
    userId: entry.userId,
    action: entry.action,
    target: entry.target,
    meta: entry.meta,
    ip: entry.ip,
    userAgent: entry.userAgent,
  };
  const audit = [row, ...doc.audit].slice(0, AUDIT_CAP);
  return { ...doc, audit };
}

function liveSessionsFor(doc: StaffAccessDoc, userId: string, nowMs: number): StaffSession[] {
  return doc.sessions.filter((s) => {
    if (s.userId !== userId || s.revokedAt) return false;
    if (Date.parse(s.expiresAt) <= nowMs) return false;
    if (nowMs - Date.parse(s.lastSeenAt) > STAFF_SESSION_IDLE_MS) return false;
    return true;
  });
}

export async function readStaffAccessDoc(): Promise<StaffAccessDoc> {
  return store.read(DOC_KEY);
}

export async function listStaffUsersPublic(): Promise<StaffUserPublic[]> {
  const doc = await readStaffAccessDoc();
  const now = Date.now();
  return doc.users.map((u) => toPublicStaffUser(u, liveSessionsFor(doc, u.id, now).length));
}

export async function listStaffAudit(limit = 80): Promise<StaffAuditEntry[]> {
  const doc = await readStaffAccessDoc();
  return doc.audit.slice(0, Math.max(1, Math.min(limit, 300)));
}

export async function listStaffSessionsPublic(userId: string): Promise<StaffSession[]> {
  const doc = await readStaffAccessDoc();
  const now = Date.now();
  return liveSessionsFor(doc, userId, now);
}

export async function appendStaffAudit(entry: {
  userId: string;
  action: StaffAuditAction;
  target?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  await mutateDoc((doc) => ({
    value: undefined,
    next: appendAudit(doc, {
      userId: entry.userId,
      action: entry.action,
      target: entry.target ?? "",
      meta: entry.meta ?? {},
      ip: entry.ip ?? "unknown",
      userAgent: entry.userAgent ?? "",
    }),
  }));
}

export type InviteStaffResult =
  | { ok: true; user: StaffUserPublic; token: string }
  | { ok: false; error: "invalid_email" | "invalid_name" | "invalid_role" | "duplicate_email" };

export async function inviteStaffUser(input: {
  name: string;
  email: string;
  role?: StaffRole;
  sections?: readonly IrissSection[];
  createdBy: string;
  ip?: string;
  userAgent?: string;
}): Promise<InviteStaffResult> {
  const name = input.name.trim().slice(0, 120);
  const email = normalizeStaffEmail(input.email);
  const sections = normalizeStaffSections(input.sections, input.role);
  if (!name) return { ok: false, error: "invalid_name" };
  if (!isValidOrderEmail(email)) return { ok: false, error: "invalid_email" };
  if (sections.length === 0) return { ok: false, error: "invalid_role" };
  const role: StaffRole = sections.includes("logistika") ? "logistics" : "logistics";

  return mutateDoc<InviteStaffResult>((doc) => {
    if (doc.users.some((u) => u.email === email && u.status !== "revoked")) {
      return { value: { ok: false, error: "duplicate_email" } };
    }
    const now = new Date().toISOString();
    const user: StaffUser = {
      id: newId("usr"),
      name,
      email,
      role,
      sections,
      status: "invited",
      passwordHash: null,
      totpEnabled: false,
      totpSecret: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdBy: input.createdBy,
      createdAt: now,
      revokedAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
    };
    const token = newInviteToken();
    const invite: StaffInvite = {
      tokenHash: hashInviteToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + STAFF_INVITE_TTL_MS).toISOString(),
      usedAt: null,
    };
    const next = appendAudit(
      { ...doc, users: [user, ...doc.users], invites: [invite, ...doc.invites] },
      {
        userId: input.createdBy,
        action: "invite_created",
        target: user.id,
        meta: { email, role, sections, name },
        ip: input.ip ?? "unknown",
        userAgent: input.userAgent ?? "",
      },
    );
    return { value: { ok: true, user: toPublicStaffUser(user, 0), token }, next };
  });
}

export type AcceptInviteResult =
  | { ok: true; user: StaffUserPublic }
  | { ok: false; error: "invalid_token" | "expired" | "used" | "weak_password" | "revoked" };

export async function acceptStaffInvite(input: { token: string; password: string }): Promise<AcceptInviteResult> {
  if (!isUsableStaffPassword(input.password)) return { ok: false, error: "weak_password" };
  const tokenHash = hashInviteToken(input.token.trim());
  const passwordHash = hashStaffPassword(input.password);
  return mutateDoc<AcceptInviteResult>((doc) => {
    const invite = doc.invites.find((i) => i.tokenHash === tokenHash);
    if (!invite) return { value: { ok: false, error: "invalid_token" } };
    if (invite.usedAt) return { value: { ok: false, error: "used" } };
    if (Date.parse(invite.expiresAt) <= Date.now()) return { value: { ok: false, error: "expired" } };
    const user = doc.users.find((u) => u.id === invite.userId);
    if (!user) return { value: { ok: false, error: "invalid_token" } };
    if (user.status === "revoked") return { value: { ok: false, error: "revoked" } };
    const now = new Date().toISOString();
    const nextUser: StaffUser = { ...user, status: "active", passwordHash, failedLoginCount: 0, lockedUntil: null };
    const next = appendAudit(
      {
        ...doc,
        users: doc.users.map((u) => (u.id === user.id ? nextUser : u)),
        invites: doc.invites.map((i) => (i.tokenHash === tokenHash ? { ...i, usedAt: now } : i)),
      },
      {
        userId: user.id,
        action: "invite_accepted",
        target: user.id,
        meta: { email: user.email },
        ip: "unknown",
        userAgent: "",
      },
    );
    return { value: { ok: true, user: toPublicStaffUser(nextUser, 0) }, next };
  });
}

export async function peekStaffInvite(
  token: string,
): Promise<{ name: string; email: string; role: StaffRole; sections: IrissSection[] } | null> {
  const tokenHash = hashInviteToken(token.trim());
  const doc = await readStaffAccessDoc();
  const invite = doc.invites.find((i) => i.tokenHash === tokenHash);
  if (!invite || invite.usedAt || Date.parse(invite.expiresAt) <= Date.now()) return null;
  const user = doc.users.find((u) => u.id === invite.userId);
  if (!user || user.status === "revoked") return null;
  return { name: user.name, email: user.email, role: user.role, sections: user.sections };
}

export async function setStaffSections(input: {
  userId: string;
  sections: readonly IrissSection[];
  actorId: string;
  ip?: string;
  userAgent?: string;
}): Promise<StaffUserPublic | null> {
  const sections = normalizeStaffSections(input.sections);
  if (sections.length === 0) return null;
  return mutateDoc((doc) => {
    const user = doc.users.find((u) => u.id === input.userId);
    if (!user) return { value: null };
    const prev = user.sections;
    const nextUser: StaffUser = {
      ...user,
      sections,
      role: sections.includes("logistika") ? "logistics" : user.role,
    };
    // Sadaļu atņemšana stājas spēkā uzreiz: middleware lasa sadaļas no sīkdatnes, tāpēc vecās sesijas beidzam
    // (jāpieslēdzas no jauna). Sadaļas piešķiršana sesiju nepārtrauc.
    const narrowed = prev.some((id) => !sections.includes(id));
    const nowIso = new Date().toISOString();
    const sessions = narrowed
      ? doc.sessions.map((s) => (s.userId === user.id && !s.revokedAt ? { ...s, revokedAt: nowIso } : s))
      : doc.sessions;
    const next = appendAudit(
      { ...doc, sessions, users: doc.users.map((u) => (u.id === user.id ? nextUser : u)) },
      {
        userId: input.actorId,
        action: "sections_updated",
        target: user.id,
        meta: { email: user.email, from: prev, to: sections, sessionsRevoked: narrowed },
        ip: input.ip ?? "unknown",
        userAgent: input.userAgent ?? "",
      },
    );
    return {
      value: toPublicStaffUser(nextUser, liveSessionsFor(next, user.id, Date.now()).length),
      next,
    };
  });
}

export type StaffAuthResult =
  | { ok: true; user: StaffUser }
  | { ok: false; error: "invalid" | "revoked" | "invited" | "locked" | "totp" };

export async function authenticateStaffPassword(email: string, password: string): Promise<StaffAuthResult> {
  const doc = await readStaffAccessDoc();
  const normalized = normalizeStaffEmail(email);
  // Pēc atsaukšanas un atkārtota uzaicinājuma ar to pašu e-pastu ir divi ieraksti - priekšroka neatsauktajam.
  const matches = doc.users.filter((u) => u.email === normalized);
  const user =
    matches.find((u) => u.status === "active") ?? matches.find((u) => u.status !== "revoked") ?? matches[0];
  if (!user) return { ok: false, error: "invalid" };
  if (user.status === "revoked") return { ok: false, error: "revoked" };
  if (user.status === "invited" || !user.passwordHash) return { ok: false, error: "invited" };
  if (user.lockedUntil && Date.parse(user.lockedUntil) > Date.now()) return { ok: false, error: "locked" };
  if (!verifyStaffPassword(password, user.passwordHash)) {
    await recordStaffLoginFailure(user.id);
    return { ok: false, error: "invalid" };
  }
  return { ok: true, user };
}

export async function recordStaffLoginFailure(userId: string, ctx?: { ip?: string; userAgent?: string }): Promise<boolean> {
  return mutateDoc((doc) => {
    const user = doc.users.find((u) => u.id === userId);
    if (!user) return { value: false };
    const failedLoginCount = user.failedLoginCount + 1;
    const locked = failedLoginCount >= STAFF_LOGIN_MAX_ATTEMPTS;
    const lockedUntil = locked ? new Date(Date.now() + STAFF_LOGIN_WINDOW_MS).toISOString() : user.lockedUntil;
    let next: StaffAccessDoc = {
      ...doc,
      users: doc.users.map((u) => (u.id === userId ? { ...u, failedLoginCount, lockedUntil } : u)),
    };
    next = appendAudit(next, {
      userId,
      action: locked ? "login_lock" : "login_failure",
      target: userId,
      meta: { failedLoginCount },
      ip: ctx?.ip ?? "unknown",
      userAgent: ctx?.userAgent ?? "",
    });
    return { value: locked, next };
  });
}

export async function createStaffSession(input: {
  user: StaffUser;
  ip: string;
  userAgent: string;
}): Promise<{ session: StaffSession; user: StaffUser }> {
  const now = Date.now();
  const session: StaffSession = {
    id: newId("ses"),
    userId: input.user.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + STAFF_SESSION_MAX_AGE_MS).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    ip: input.ip,
    userAgent: input.userAgent.slice(0, 300),
    revokedAt: null,
  };
  const updatedUser: StaffUser = {
    ...input.user,
    lastLoginAt: session.createdAt,
    lastLoginIp: input.ip,
    failedLoginCount: 0,
    lockedUntil: null,
  };
  await mutateDoc((doc) => {
    const next = appendAudit(
      {
        ...doc,
        users: doc.users.map((u) => (u.id === input.user.id ? updatedUser : u)),
        sessions: [session, ...doc.sessions],
      },
      {
        userId: input.user.id,
        action: "login_success",
        target: input.user.id,
        meta: { sessionId: session.id },
        ip: input.ip,
        userAgent: input.userAgent,
      },
    );
    return { value: undefined, next };
  });
  return { session, user: updatedUser };
}

export function isStaffSessionLive(session: StaffSession, nowMs: number = Date.now()): boolean {
  if (session.revokedAt) return false;
  if (Date.parse(session.expiresAt) <= nowMs) return false;
  if (nowMs - Date.parse(session.lastSeenAt) > STAFF_SESSION_IDLE_MS) return false;
  return true;
}

export async function resolveLiveStaffSession(
  sessionId: string,
  userId: string,
): Promise<{ session: StaffSession; user: StaffUser } | null> {
  if (!isStaffUserId(sessionId) || !isStaffUserId(userId)) return null;
  const doc = await readStaffAccessDoc();
  const session = doc.sessions.find((s) => s.id === sessionId && s.userId === userId);
  const user = doc.users.find((u) => u.id === userId);
  if (!session || !user) return null;
  if (user.status !== "active") return null;
  if (!isStaffSessionLive(session)) return null;
  return { session, user };
}

export async function touchStaffSession(sessionId: string): Promise<void> {
  const now = Date.now();
  await mutateDoc((doc) => {
    const session = doc.sessions.find((s) => s.id === sessionId);
    if (!session || !isStaffSessionLive(session, now)) return { value: undefined };
    if (now - Date.parse(session.lastSeenAt) < 60_000) return { value: undefined };
    return {
      value: undefined,
      next: {
        ...doc,
        sessions: doc.sessions.map((s) =>
          s.id === sessionId ? { ...s, lastSeenAt: new Date(now).toISOString() } : s,
        ),
      },
    };
  });
}

export async function revokeStaffSession(sessionId: string): Promise<void> {
  await mutateDoc((doc) => ({
    value: undefined,
    next: {
      ...doc,
      sessions: doc.sessions.map((s) =>
        s.id === sessionId && !s.revokedAt ? { ...s, revokedAt: new Date().toISOString() } : s,
      ),
    },
  }));
}

export async function revokeAllStaffSessions(input: {
  userId: string;
  actorId: string;
  ip?: string;
  userAgent?: string;
}): Promise<number> {
  const now = new Date().toISOString();
  return mutateDoc((doc) => {
    let count = 0;
    const sessions = doc.sessions.map((s) => {
      if (s.userId === input.userId && !s.revokedAt) {
        count += 1;
        return { ...s, revokedAt: now };
      }
      return s;
    });
    const next = appendAudit(
      { ...doc, sessions },
      {
        userId: input.actorId,
        action: "sessions_revoked",
        target: input.userId,
        meta: { count },
        ip: input.ip ?? "unknown",
        userAgent: input.userAgent ?? "",
      },
    );
    return { value: count, next };
  });
}

export async function revokeStaffAccess(input: {
  userId: string;
  actorId: string;
  ip?: string;
  userAgent?: string;
}): Promise<StaffUserPublic | null> {
  const now = new Date().toISOString();
  return mutateDoc((doc) => {
    const user = doc.users.find((u) => u.id === input.userId);
    if (!user) return { value: null };
    const nextUser: StaffUser = { ...user, status: "revoked", revokedAt: now };
    const sessions = doc.sessions.map((s) =>
      s.userId === user.id && !s.revokedAt ? { ...s, revokedAt: now } : s,
    );
    const next = appendAudit(
      { ...doc, users: doc.users.map((u) => (u.id === user.id ? nextUser : u)), sessions },
      {
        userId: input.actorId,
        action: "access_revoked",
        target: user.id,
        meta: { email: user.email },
        ip: input.ip ?? "unknown",
        userAgent: input.userAgent ?? "",
      },
    );
    return { value: toPublicStaffUser(nextUser, 0), next };
  });
}

export async function restoreStaffAccess(input: {
  userId: string;
  actorId: string;
  ip?: string;
  userAgent?: string;
}): Promise<StaffUserPublic | null> {
  return mutateDoc((doc) => {
    const user = doc.users.find((u) => u.id === input.userId);
    if (!user) return { value: null };
    const nextUser: StaffUser = {
      ...user,
      status: user.passwordHash ? "active" : "invited",
      revokedAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
    };
    const next = appendAudit(
      { ...doc, users: doc.users.map((u) => (u.id === user.id ? nextUser : u)) },
      {
        userId: input.actorId,
        action: "access_restored",
        target: user.id,
        meta: { email: user.email, status: nextUser.status },
        ip: input.ip ?? "unknown",
        userAgent: input.userAgent ?? "",
      },
    );
    return { value: toPublicStaffUser(nextUser, 0), next };
  });
}

export async function setStaffTotpSecret(userId: string, secret: string): Promise<void> {
  await mutateDoc((doc) => ({
    value: undefined,
    next: {
      ...doc,
      users: doc.users.map((u) => (u.id === userId ? { ...u, totpSecret: secret, totpEnabled: false } : u)),
    },
  }));
}

export async function confirmStaffTotp(input: {
  userId: string;
  actorId: string;
  ip?: string;
  userAgent?: string;
}): Promise<boolean> {
  return mutateDoc((doc) => {
    const user = doc.users.find((u) => u.id === input.userId);
    if (!user || !user.totpSecret) return { value: false };
    const next = appendAudit(
      {
        ...doc,
        users: doc.users.map((u) => (u.id === user.id ? { ...u, totpEnabled: true } : u)),
      },
      {
        userId: input.actorId,
        action: "totp_enabled",
        target: user.id,
        meta: {},
        ip: input.ip ?? "unknown",
        userAgent: input.userAgent ?? "",
      },
    );
    return { value: true, next };
  });
}

export async function findStaffUserById(userId: string): Promise<StaffUser | null> {
  const doc = await readStaffAccessDoc();
  return doc.users.find((u) => u.id === userId) ?? null;
}

export function envAdminId(): string {
  return ENV_ADMIN_USER_ID;
}
