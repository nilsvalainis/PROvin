/**
 * IRISS pieeja: noklusēti aizliegts. Edge-drošs (middleware + testi).
 * Administrators (Nils, env HMAC) redz visu. Darbinieks - tikai piešķirtās sadaļas.
 * Vienam lietotājam var būt vairākas sadaļas (piem. Loģistika + Pavadzīmes).
 * Loģistika: `/admin/iriss/logistika` un API `/api/admin/iriss/logistika*` plus `/api/admin/iriss-logistics*`.
 * Autoparks (`/admin/iriss/autoparks`) ir tām pašām lomām (Loģistika, Grāmatvede, Serviss), API zem `/api/admin/iriss-logistics/autoparks`.
 */

/** Legacy lauks saglabātajos JSON (pirms vairākām sadaļām). */
export const STAFF_ROLE_LOGISTICS = "logistics" as const;
export type StaffRole = typeof STAFF_ROLE_LOGISTICS;
export const STAFF_ROLES: readonly StaffRole[] = [STAFF_ROLE_LOGISTICS];

export const ENV_ADMIN_USER_ID = "env-admin";

export const IRISS_SECTIONS = [
  "pasutijumi",
  "sludinajumi",
  "radars",
  "logistika",
  "gramatvede",
  "serviss",
  "pavadzimes",
  "vin",
  "atskaite",
] as const;

export type IrissSection = (typeof IRISS_SECTIONS)[number];

export type IrissSectionMeta = {
  id: IrissSection;
  label: string;
  pagePrefixes: readonly string[];
  apiPrefixes: readonly string[];
};

export const IRISS_SECTION_CATALOG: readonly IrissSectionMeta[] = [
  {
    id: "pasutijumi",
    label: "Pasūtījumi",
    pagePrefixes: ["/admin/iriss/pasutijumi"],
    apiPrefixes: ["/api/admin/iriss-pasutijumi"],
  },
  {
    id: "sludinajumi",
    label: "Sludinājumi",
    pagePrefixes: ["/admin/iriss/sludinajumi"],
    apiPrefixes: ["/api/admin/iriss-listings"],
  },
  {
    id: "radars",
    label: "Radars",
    pagePrefixes: ["/admin/iriss/scan"],
    apiPrefixes: ["/api/admin/iriss-scan", "/api/admin/iriss-marketplace"],
  },
  {
    id: "logistika",
    label: "Loģistika",
    pagePrefixes: ["/admin/iriss/logistika", "/admin/iriss/autoparks"],
    apiPrefixes: ["/api/admin/iriss/logistika", "/api/admin/iriss-logistics"],
  },
  {
    id: "gramatvede",
    label: "Grāmatvede",
    pagePrefixes: ["/admin/iriss/logistika", "/admin/iriss/autoparks"],
    apiPrefixes: ["/api/admin/iriss/logistika", "/api/admin/iriss-logistics"],
  },
  {
    id: "serviss",
    label: "Serviss",
    pagePrefixes: ["/admin/iriss/logistika", "/admin/iriss/autoparks"],
    apiPrefixes: ["/api/admin/iriss/logistika", "/api/admin/iriss-logistics"],
  },
  {
    id: "pavadzimes",
    label: "Pavadzīmes",
    pagePrefixes: ["/admin/iriss/pavadzimes"],
    apiPrefixes: ["/api/admin/iriss-pavadzimes", "/api/admin/iriss/waybill-requests"],
  },
  {
    id: "vin",
    label: "VIN pārbaude",
    pagePrefixes: ["/admin/vin-scan"],
    apiPrefixes: [
      "/api/admin/vin-scan",
      "/api/admin/vin-sources",
      "/api/admin/vin-history",
      "/api/admin/outvin",
      "/api/admin/csdd-tech-data",
    ],
  },
  {
    id: "atskaite",
    label: "Mēneša atskaite",
    pagePrefixes: ["/admin/iriss/atskaite"],
    apiPrefixes: [],
  },
] as const;

export const IRISS_SECTION_LABELS: Record<IrissSection, string> = {
  pasutijumi: "Pasūtījumi",
  sludinajumi: "Sludinājumi",
  radars: "Radars",
  logistika: "Loģistika",
  gramatvede: "Grāmatvede",
  serviss: "Serviss",
  pavadzimes: "Pavadzīmes",
  vin: "VIN pārbaude",
  atskaite: "Mēneša atskaite",
};

export type AccessActor =
  | { kind: "admin" }
  | { kind: "staff"; sections: IrissSection[] }
  | { kind: "none" };

export type PageAccessDecision = "allow" | "login" | "forbidden";
export type ApiAccessDecision = "allow" | "unauthorized" | "forbidden";

export const LOGISTICS_PAGE_PREFIX = "/admin/iriss/logistika";
export const LOGISTICS_API_PREFIX = "/api/admin/iriss/logistika";
/** Reālās Loģistikas kartes / avotu API (atšķiras no lomas sākuma `/api/admin/iriss/logistika`). */
export const LOGISTICS_STORE_API_PREFIX = "/api/admin/iriss-logistics";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  logistics: "Loģistika",
};

export const STAFF_ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  logistics: "Tikai Loģistikas karte, punkti, reisi. Bez cenām, klientu datiem un šofera personas datiem.",
};

export const FUTURE_ROLE_DESCRIPTIONS: { title: string; body: string }[] = [];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isIrissSection(value: unknown): value is IrissSection {
  return typeof value === "string" && (IRISS_SECTIONS as readonly string[]).includes(value);
}

export function isStaffRole(value: unknown): value is StaffRole {
  return value === STAFF_ROLE_LOGISTICS;
}

export function normalizeStaffSections(raw: unknown, fallbackRole?: unknown): IrissSection[] {
  const out: IrissSection[] = [];
  const seen = new Set<IrissSection>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isIrissSection(item) || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  if (out.length === 0 && fallbackRole === STAFF_ROLE_LOGISTICS) return ["logistika"];
  return out;
}

export function staffHasSection(
  actor: { sections?: readonly IrissSection[] } | null | undefined,
  section: IrissSection,
): boolean {
  return Boolean(actor?.sections?.includes(section));
}

export function irissSectionMeta(id: IrissSection): IrissSectionMeta {
  return IRISS_SECTION_CATALOG.find((row) => row.id === id)!;
}

export function staffHomePath(sections: readonly IrissSection[]): string {
  if (sections.length > 0) return "/admin/iriss";
  return LOGISTICS_PAGE_PREFIX;
}

export function sectionForAdminPagePath(pathname: string): IrissSection | null {
  for (const row of IRISS_SECTION_CATALOG) {
    if (row.pagePrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix))) return row.id;
  }
  return null;
}

export function sectionForAdminApiPath(pathname: string): IrissSection | null {
  for (const row of IRISS_SECTION_CATALOG) {
    if (row.apiPrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix))) return row.id;
  }
  return null;
}

export function isLogisticsPagePath(pathname: string): boolean {
  return pathMatchesPrefix(pathname, LOGISTICS_PAGE_PREFIX);
}

export function isLogisticsApiPath(pathname: string): boolean {
  return pathMatchesPrefix(pathname, LOGISTICS_API_PREFIX) || pathMatchesPrefix(pathname, LOGISTICS_STORE_API_PREFIX);
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

/** Sesijas API, ko drīkst jebkurš aktīvs darbinieks (neatkarīgi no sadaļām). */
export function isStaffSessionApiPath(pathname: string): boolean {
  return (
    pathname === "/api/admin/logout" ||
    pathname.startsWith("/api/admin/logout/") ||
    pathname === "/api/admin/iriss/logistika/totp" ||
    pathname.startsWith("/api/admin/iriss/logistika/totp/")
  );
}

/** @deprecated izmanto isStaffSessionApiPath + sadaļu karti. */
export function isStaffAllowedSessionApiPath(pathname: string): boolean {
  return isStaffSessionApiPath(pathname) || isLogisticsApiPath(pathname);
}

function isStaffIrissHomePath(pathname: string): boolean {
  return pathname === "/admin/iriss" || pathname === "/admin/iriss/";
}

/** Kopīga vēsture: pavadzīmes / pasūtījumi / sludinājumi. */
export function isSharedStaffHistoryApiPath(pathname: string): boolean {
  return pathname === "/api/admin/change-history" || pathname.startsWith("/api/admin/change-history/");
}

export function decideAdminPageAccess(pathname: string, actor: AccessActor): PageAccessDecision {
  if (isStaffPublicPagePath(pathname)) return "allow";
  if (actor.kind === "none") return "login";
  if (actor.kind === "admin") return "allow";
  if (actor.kind !== "staff") return "forbidden";
  if (isStaffIrissHomePath(pathname)) return actor.sections.length > 0 ? "allow" : "forbidden";
  if (actor.sections.some((id) => irissSectionMeta(id).pagePrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix)))) {
    return "allow";
  }
  return "forbidden";
}

export function decideAdminApiAccess(pathname: string, actor: AccessActor): ApiAccessDecision {
  if (isStaffPublicApiPath(pathname)) return "allow";
  if (actor.kind === "none") return "unauthorized";
  if (actor.kind === "admin") return "allow";
  if (actor.kind !== "staff") return "forbidden";
  if (isStaffSessionApiPath(pathname)) return "allow";
  if (isSharedStaffHistoryApiPath(pathname)) {
    return actor.sections.some((s) => s === "pavadzimes" || s === "pasutijumi" || s === "sludinajumi")
      ? "allow"
      : "forbidden";
  }
  if (actor.sections.some((id) => irissSectionMeta(id).apiPrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix)))) {
    return "allow";
  }
  return "forbidden";
}

export function logisticsHomePath(): string {
  return LOGISTICS_PAGE_PREFIX;
}

export function actorHomePath(actor: AccessActor): string {
  if (actor.kind === "staff") return staffHomePath(actor.sections);
  if (actor.kind === "admin") return "/admin/iriss";
  return "/admin/login";
}

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sectionsFromLegacyRole(role: unknown): IrissSection[] {
  return role === STAFF_ROLE_LOGISTICS ? ["logistika"] : [];
}
