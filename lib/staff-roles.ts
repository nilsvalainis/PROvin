/**
 * IRISS lomu pieejas: noklusēti aizliegts. Edge-drošs (middleware + testi).
 * Administrators (Nils, env HMAC) redz visu. Loģistika: tikai /admin/iriss/logistika un tās API.
 */

export const STAFF_ROLE_LOGISTICS = "logistics" as const;
export type StaffRole = typeof STAFF_ROLE_LOGISTICS;

export const STAFF_ROLES: readonly StaffRole[] = [STAFF_ROLE_LOGISTICS];

export const ENV_ADMIN_USER_ID = "env-admin";

export type AccessActor =
  | { kind: "admin" }
  | { kind: "staff"; role: StaffRole }
  | { kind: "none" };

export type PageAccessDecision = "allow" | "login" | "forbidden";
export type ApiAccessDecision = "allow" | "unauthorized" | "forbidden";

export const LOGISTICS_PAGE_PREFIX = "/admin/iriss/logistika";
export const LOGISTICS_API_PREFIX = "/api/admin/iriss/logistika";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  logistics: "Loģistika",
};

export const STAFF_ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  logistics:
    "Tikai Loģistikas karte, punkti, reisi. Bez cenām, klientu datiem un šofera personas datiem.",
};

export const FUTURE_ROLE_DESCRIPTIONS: { title: string; body: string }[] = [
  {
    title: "Citas lomas",
    body: "Vēlāk (piemēram Dokumenti, Grāmatvedība) tā pati shēma: katrai lomai savs atļauju saraksts.",
  },
];

export function isStaffRole(value: unknown): value is StaffRole {
  return value === STAFF_ROLE_LOGISTICS;
}

export function isLogisticsPagePath(pathname: string): boolean {
  return pathname === LOGISTICS_PAGE_PREFIX || pathname.startsWith(`${LOGISTICS_PAGE_PREFIX}/`);
}

export function isLogisticsApiPath(pathname: string): boolean {
  return pathname === LOGISTICS_API_PREFIX || pathname.startsWith(`${LOGISTICS_API_PREFIX}/`);
}

export function isStaffInvitePagePath(pathname: string): boolean {
  return pathname === "/admin/uzaicinajums" || pathname.startsWith("/admin/uzaicinajums/");
}

export function isStaffPublicPagePath(pathname: string): boolean {
  return (
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/") ||
    isStaffInvitePagePath(pathname)
  );
}

export function isStaffPublicApiPath(pathname: string): boolean {
  return (
    pathname === "/api/admin/staff/accept-invite" ||
    pathname.startsWith("/api/admin/staff/accept-invite/") ||
    pathname === "/api/admin/login/totp" ||
    pathname.startsWith("/api/admin/login/totp/")
  );
}

/** Loģistikas lietotājs drīkst iziet; pārējie admin API paliek aizliegti. */
export function isStaffAllowedSessionApiPath(pathname: string): boolean {
  return (
    pathname === "/api/admin/logout" ||
    pathname.startsWith("/api/admin/logout/") ||
    isLogisticsApiPath(pathname)
  );
}

export function decideAdminPageAccess(pathname: string, actor: AccessActor): PageAccessDecision {
  if (isStaffPublicPagePath(pathname)) return "allow";
  if (actor.kind === "none") return "login";
  if (actor.kind === "admin") return "allow";
  if (actor.kind === "staff" && actor.role === STAFF_ROLE_LOGISTICS && isLogisticsPagePath(pathname)) {
    return "allow";
  }
  return "forbidden";
}

export function decideAdminApiAccess(pathname: string, actor: AccessActor): ApiAccessDecision {
  if (isStaffPublicApiPath(pathname)) return "allow";
  if (actor.kind === "none") return "unauthorized";
  if (actor.kind === "admin") return "allow";
  if (actor.kind === "staff" && actor.role === STAFF_ROLE_LOGISTICS && isStaffAllowedSessionApiPath(pathname)) {
    return "allow";
  }
  return "forbidden";
}

export function logisticsHomePath(): string {
  return LOGISTICS_PAGE_PREFIX;
}

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}
