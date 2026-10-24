import {
  isStaffRole,
  normalizeStaffEmail,
  normalizeStaffSections,
  type IrissSection,
  type StaffRole,
} from "@/lib/staff-roles";

export type StaffStatus = "invited" | "active" | "revoked";

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  /** Piešķirtās IRISS sadaļas secībā; pirmā = sākuma lapa. */
  sections: IrissSection[];
  status: StaffStatus;
  passwordHash: string | null;
  totpEnabled: boolean;
  totpSecret: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
  failedLoginCount: number;
  lockedUntil: string | null;
};

export type StaffUserPublic = Omit<StaffUser, "passwordHash" | "totpSecret"> & {
  sessionCount: number;
};

export type StaffSession = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  ip: string;
  userAgent: string;
  revokedAt: string | null;
};

export type StaffSessionPublic = Omit<StaffSession, never>;

export type StaffInvite = {
  tokenHash: string;
  userId: string;
  expiresAt: string;
  usedAt: string | null;
};

export type StaffAuditAction =
  | "login_success"
  | "login_failure"
  | "login_lock"
  | "invite_created"
  | "invite_accepted"
  | "access_revoked"
  | "access_restored"
  | "sessions_revoked"
  | "totp_enabled"
  | "totp_disabled"
  | "sections_updated"
  | "waybill_requested"
  | "waybill_retry"
  | "waybill_claimed"
  | "waybill_cancelled"
  | "waybill_result"
  | "waybill_handoff_aivars"
  | "point_viewed"
  | "point_edited"
  | "print"
  | "route_export";

export type StaffAuditEntry = {
  id: string;
  userId: string;
  action: StaffAuditAction;
  target: string;
  meta: Record<string, unknown>;
  ip: string;
  userAgent: string;
  createdAt: string;
};

export type EnvAdminPublic = {
  id: string;
  name: string;
  email: string;
  role: "admin";
  status: "active";
  totpEnabled: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdBy: string;
  createdAt: string;
  revokedAt: null;
  sessionCount: number;
  envAdmin: true;
};

const ID_RE = /^[a-z0-9_-]{8,64}$/i;

export function isStaffUserId(value: string): boolean {
  return ID_RE.test(value);
}

export function isStaffStatus(value: unknown): value is StaffStatus {
  return value === "invited" || value === "active" || value === "revoked";
}

export function isStaffAuditAction(value: unknown): value is StaffAuditAction {
  return (
    value === "login_success" ||
    value === "login_failure" ||
    value === "login_lock" ||
    value === "invite_created" ||
    value === "invite_accepted" ||
    value === "access_revoked" ||
    value === "access_restored" ||
    value === "sessions_revoked" ||
    value === "totp_enabled" ||
    value === "totp_disabled" ||
    value === "sections_updated" ||
    value === "waybill_requested" ||
    value === "waybill_retry" ||
    value === "waybill_claimed" ||
    value === "waybill_cancelled" ||
    value === "waybill_result" ||
    value === "waybill_handoff_aivars" ||
    value === "point_viewed" ||
    value === "point_edited" ||
    value === "print" ||
    value === "route_export"
  );
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function parseStaffUser(raw: unknown): StaffUser | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id) ?? "";
  const name = str(o.name) ?? "";
  const email = typeof o.email === "string" ? normalizeStaffEmail(o.email) : "";
  const sections = normalizeStaffSections(o.sections, o.role);
  const roleOk = isStaffRole(o.role) || sections.length > 0;
  if (!isStaffUserId(id) || !name || !email || !roleOk || !isStaffStatus(o.status)) return null;
  if (sections.length === 0) return null;
  const createdAt = str(o.createdAt);
  if (!createdAt) return null;
  const passwordHash = typeof o.passwordHash === "string" && o.passwordHash.startsWith("scrypt$") ? o.passwordHash : null;
  return {
    id,
    name: name.slice(0, 120),
    email,
    role: isStaffRole(o.role) ? o.role : "logistics",
    sections,
    status: o.status,
    passwordHash,
    totpEnabled: o.totpEnabled === true,
    totpSecret: typeof o.totpSecret === "string" && o.totpSecret.trim() ? o.totpSecret.trim() : null,
    lastLoginAt: str(o.lastLoginAt),
    lastLoginIp: str(o.lastLoginIp),
    createdBy: str(o.createdBy) ?? "env-admin",
    createdAt,
    revokedAt: str(o.revokedAt),
    failedLoginCount: typeof o.failedLoginCount === "number" && o.failedLoginCount >= 0 ? o.failedLoginCount : 0,
    lockedUntil: str(o.lockedUntil),
  };
}

export function parseStaffSession(raw: unknown): StaffSession | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id) ?? "";
  const userId = str(o.userId) ?? "";
  const createdAt = str(o.createdAt);
  const expiresAt = str(o.expiresAt);
  const lastSeenAt = str(o.lastSeenAt) ?? createdAt;
  if (!isStaffUserId(id) || !isStaffUserId(userId) || !createdAt || !expiresAt || !lastSeenAt) return null;
  return {
    id,
    userId,
    createdAt,
    expiresAt,
    lastSeenAt,
    ip: str(o.ip) ?? "unknown",
    userAgent: str(o.userAgent) ?? "",
    revokedAt: str(o.revokedAt),
  };
}

export function parseStaffInvite(raw: unknown): StaffInvite | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tokenHash = str(o.tokenHash) ?? "";
  const userId = str(o.userId) ?? "";
  const expiresAt = str(o.expiresAt);
  if (!/^[a-f0-9]{64}$/i.test(tokenHash) || !isStaffUserId(userId) || !expiresAt) return null;
  return {
    tokenHash: tokenHash.toLowerCase(),
    userId,
    expiresAt,
    usedAt: str(o.usedAt),
  };
}

export function parseStaffAuditEntry(raw: unknown): StaffAuditEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id) ?? "";
  const userId = str(o.userId) ?? "";
  const createdAt = str(o.createdAt);
  if (!isStaffUserId(id) || !userId || !isStaffAuditAction(o.action) || !createdAt) return null;
  const meta = o.meta && typeof o.meta === "object" && !Array.isArray(o.meta) ? (o.meta as Record<string, unknown>) : {};
  return {
    id,
    userId,
    action: o.action,
    target: str(o.target) ?? "",
    meta,
    ip: str(o.ip) ?? "unknown",
    userAgent: str(o.userAgent) ?? "",
    createdAt,
  };
}

export function toPublicStaffUser(user: StaffUser, sessionCount = 0): StaffUserPublic {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sections: user.sections,
    status: user.status,
    totpEnabled: user.totpEnabled,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
    revokedAt: user.revokedAt,
    failedLoginCount: user.failedLoginCount,
    lockedUntil: user.lockedUntil,
    sessionCount,
  };
}

export function deviceLabelFromUserAgent(ua: string): string {
  const t = ua.trim();
  if (!t) return "Nezināma ierīce";
  const browser = /Edg\//.test(t)
    ? "Edge"
    : /Chrome\//.test(t)
      ? "Chrome"
      : /Firefox\//.test(t)
        ? "Firefox"
        : /Safari\//.test(t)
          ? "Safari"
          : "Pārlūks";
  const os = /Windows/i.test(t)
    ? "Windows"
    : /Mac OS X|Macintosh/i.test(t)
      ? "macOS"
      : /Android/i.test(t)
        ? "Android"
        : /iPhone|iPad|iOS/i.test(t)
          ? "iOS"
          : /Linux/i.test(t)
            ? "Linux"
            : "ierīce";
  return `${browser}, ${os}`;
}
