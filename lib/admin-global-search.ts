/**
 * Globālā admin meklēšana. Šo moduli drīkst importēt pārlūkā.
 * PRO pasūtījumu salīdzināšana ir `adminOrderMatchesQuery` (tā pati `?q=` loģika).
 * B2B ieraksti iet caur `filterTenantRecords` (#186).
 */
import { adminOrderMatchesQuery, foldSearchText } from "@/lib/admin-orders-page-query";
import { filterTenantRecords } from "@/lib/b2b-demo-isolation";

export const ADMIN_SEARCH_OPERATOR_TENANT = "operator";
export const ADMIN_SEARCH_QUERY_MIN = 2;
export const ADMIN_SEARCH_QUERY_MAX = 80;
export const ADMIN_SEARCH_LIMIT = 8;
export const ADMIN_SEARCH_VIN_MIN = 6;
export const ADMIN_SEARCH_RECENT_KEY = "provin-admin-search-recent";
export const ADMIN_SEARCH_RECENT_LIMIT = 8;
export const ADMIN_GLOBAL_SEARCH_OPEN = "provin-admin-search-open";

export const ADMIN_SEARCH_KINDS = [
  "iriss-order",
  "iriss-listing",
  "iriss-waybill",
  "pro-order",
  "section",
] as const;

export type AdminSearchKind = (typeof ADMIN_SEARCH_KINDS)[number];

export const ADMIN_SEARCH_GROUP_LABEL: Record<AdminSearchKind, string> = {
  "iriss-order": "IRISS pasūtījumi",
  "iriss-listing": "IRISS LIST",
  "iriss-waybill": "IRISS pavadzīmes",
  "pro-order": "PRO pasūtījumi",
  section: "Sadaļas",
};

export type AdminSearchScope = { kind: "operator" } | { kind: "tenant"; tenantId: string };

export type AdminSearchProRow = {
  id: string;
  created: number;
  vin?: string | null;
  makeModel?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  partnerCompanyName?: string | null;
};

/** Iekšējais katalogs. `text` ir meklējamais teksts bez VIN. VIN iet tikai caur sufiksa likumu. */
export type AdminSearchRecord = {
  kind: AdminSearchKind;
  id: string;
  tenantId: string;
  title: string;
  subtitle: string;
  href: string;
  text: string;
  vin: string;
  pro?: AdminSearchProRow;
};

export type AdminSearchHit = {
  kind: AdminSearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type AdminSearchGroup = {
  kind: AdminSearchKind;
  label: string;
  hits: AdminSearchHit[];
};

type SectionSeed = { id: string; title: string; subtitle: string; href: string; text: string };

/** Nosaukumi kā admin izvēlnē. `text` pievieno otrā zona lietoto vārdu (piem. Sludinājumi). */
const ADMIN_SEARCH_SECTIONS: readonly SectionSeed[] = [
  { id: "pro-orders", title: "Pasūtījumi", subtitle: "PRO", href: "/admin/dashboard", text: "pasūtījumi" },
  { id: "morning", title: "Rīta kopsavilkums", subtitle: "PRO", href: "/admin/kopsavilkums", text: "rīta kopsavilkums" },
  { id: "vin-scan", title: "VIN pārbaude", subtitle: "PRO", href: "/admin/vin-scan", text: "VIN pārbaude VIN SCAN" },
  { id: "fast", title: "Ātrie vērtējumi", subtitle: "PRO", href: "/admin/atras-vertesanas", text: "ātrie vērtējumi" },
  { id: "iriss-orders", title: "Pasūtījumi", subtitle: "IRISS", href: "/admin/iriss/pasutijumi", text: "IRISS pasūtījumi" },
  { id: "iriss-new", title: "Jauns pasūtījums", subtitle: "IRISS", href: "/admin/iriss/pasutijumi/new", text: "jauns pasūtījums" },
  { id: "iriss-list", title: "Sludinājumi", subtitle: "IRISS", href: "/admin/iriss/sludinajumi", text: "klientu filtri sludinājumi IRISS LIST" },
  { id: "iriss-scan", title: "Radars", subtitle: "IRISS", href: "/admin/iriss/scan", text: "radars" },
  { id: "iriss-logistics", title: "Loģistika", subtitle: "IRISS", href: "/admin/iriss/logistika", text: "loģistika punkti karte pickup" },
  { id: "iriss-autoparks", title: "Autoparks", subtitle: "IRISS", href: "/admin/iriss/autoparks", text: "autoparks auto serviss rēķini pārdošana" },
  { id: "iriss-report", title: "Mēneša atskaite", subtitle: "IRISS", href: "/admin/iriss/atskaite", text: "mēneša atskaite" },
  { id: "iriss-waybills", title: "Pavadzīmes", subtitle: "IRISS", href: "/admin/iriss/pavadzimes", text: "pavadzīmes" },
  { id: "iriss-settings", title: "Iestatījumi", subtitle: "IRISS", href: "/admin/iriss/iestatijumi", text: "iestatījumi" },
  { id: "blogs", title: "Blogs", subtitle: "WEB", href: "/admin/blogs", text: "blogs" },
  { id: "aggregates", title: "Agregāti", subtitle: "WEB", href: "/admin/agregatu-zinasanas", text: "agregāti" },
  { id: "stats", title: "Statistika", subtitle: "WEB", href: "/admin/statistika", text: "statistika" },
  { id: "templates", title: "Tekstu šabloni", subtitle: "WEB", href: "/admin/teksti", text: "tekstu šabloni" },
  { id: "invoices", title: "Rēķini", subtitle: "B2B", href: "/admin/commission-invoice", text: "rēķini" },
  { id: "partners", title: "Partneri", subtitle: "B2B", href: "/admin/partneri", text: "partneri" },
  { id: "costs", title: "Izmaksas", subtitle: "Pārvaldība", href: "/admin/izmaksas", text: "izmaksas AI aģenti Stripe Apify" },
  { id: "iriss-costs", title: "Izmaksas", subtitle: "IRISS · Iestatījumi", href: "/admin/iriss/izmaksas", text: "izmaksas IRISS AI aģenti Stripe Apify" },
];

export function adminSearchSectionRecords(): AdminSearchRecord[] {
  return ADMIN_SEARCH_SECTIONS.map((row) => ({
    kind: "section",
    id: row.id,
    tenantId: ADMIN_SEARCH_OPERATOR_TENANT,
    title: row.title,
    subtitle: row.subtitle,
    href: row.href,
    text: `${row.title} ${row.text}`,
    vin: "",
  }));
}

export function requestAdminGlobalSearch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_GLOBAL_SEARCH_OPEN));
}

export function adminSearchVinToken(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

/** VIN sakrīt tikai kā sufikss no 6 zīmēm (arī pilns VIN). */
export function adminSearchVinSuffixMatches(vin: string, query: string): boolean {
  const v = adminSearchVinToken(vin);
  const q = adminSearchVinToken(query);
  if (q.length < ADMIN_SEARCH_VIN_MIN || v.length < ADMIN_SEARCH_VIN_MIN) return false;
  return v.endsWith(q);
}

export function restrictAdminSearchRecords<T extends { tenantId: string }>(
  records: readonly T[],
  scope: AdminSearchScope,
): T[] {
  if (scope.kind === "tenant") {
    try {
      return filterTenantRecords(records, scope.tenantId);
    } catch {
      return [];
    }
  }
  return records.filter((row) => row.tenantId === ADMIN_SEARCH_OPERATOR_TENANT);
}

function searchHay(record: AdminSearchRecord): string {
  const raw = [record.text, record.id].filter(Boolean).join(" ");
  return `${foldSearchText(raw)} ${raw.replace(/\D/g, "")}`;
}

export function adminSearchRecordMatches(record: AdminSearchRecord, query: string): boolean {
  const needle = query.trim().slice(0, ADMIN_SEARCH_QUERY_MAX);
  if (needle.length < ADMIN_SEARCH_QUERY_MIN) return false;
  if (record.kind === "pro-order") {
    if (!record.pro) return false;
    return adminOrderMatchesQuery(record.pro, needle);
  }
  const folded = foldSearchText(needle);
  if (!folded) return false;
  const hay = searchHay(record);
  return folded.split(/\s+/).every((word) => {
    if (!word) return true;
    if (hay.includes(word)) return true;
    return adminSearchVinSuffixMatches(record.vin, word);
  });
}

function toHit(record: AdminSearchRecord): AdminSearchHit {
  return {
    kind: record.kind,
    id: record.id,
    title: record.title,
    subtitle: record.subtitle,
    href: record.href,
  };
}

export function searchAdminGlobal(
  records: readonly AdminSearchRecord[],
  query: string,
  scope: AdminSearchScope,
): AdminSearchHit[] {
  const needle = query.trim().slice(0, ADMIN_SEARCH_QUERY_MAX);
  if (needle.length < ADMIN_SEARCH_QUERY_MIN) return [];
  const visible = restrictAdminSearchRecords(records, scope);
  const hits: AdminSearchHit[] = [];
  const counts = new Map<AdminSearchKind, number>();
  for (const record of visible) {
    const n = counts.get(record.kind) ?? 0;
    if (n >= ADMIN_SEARCH_LIMIT) continue;
    if (!adminSearchRecordMatches(record, needle)) continue;
    hits.push(toHit(record));
    counts.set(record.kind, n + 1);
  }
  return hits;
}

export function groupAdminSearchHits(hits: readonly AdminSearchHit[]): AdminSearchGroup[] {
  const buckets = new Map<AdminSearchKind, AdminSearchHit[]>();
  for (const hit of hits) {
    const list = buckets.get(hit.kind) ?? [];
    list.push(hit);
    buckets.set(hit.kind, list);
  }
  const groups: AdminSearchGroup[] = [];
  for (const kind of ADMIN_SEARCH_KINDS) {
    const list = buckets.get(kind);
    if (!list?.length) continue;
    groups.push({ kind, label: ADMIN_SEARCH_GROUP_LABEL[kind], hits: list });
  }
  return groups;
}

function isAdminSearchKind(v: unknown): v is AdminSearchKind {
  return typeof v === "string" && (ADMIN_SEARCH_KINDS as readonly string[]).includes(v);
}

function isSafeAdminHref(href: string): boolean {
  return href.startsWith("/admin") && !href.startsWith("//") && !href.includes("://");
}

export function parseAdminSearchRecent(raw: string | null): AdminSearchHit[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: AdminSearchHit[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const href = typeof o.href === "string" ? o.href : "";
      const title = typeof o.title === "string" ? o.title.trim() : "";
      const id = typeof o.id === "string" ? o.id.trim() : "";
      if (!isAdminSearchKind(o.kind) || !id || !title || !isSafeAdminHref(href)) continue;
      out.push({
        kind: o.kind,
        id: id.slice(0, 80),
        title: title.slice(0, 160),
        subtitle: typeof o.subtitle === "string" ? o.subtitle.slice(0, 180) : "",
        href,
      });
      if (out.length >= ADMIN_SEARCH_RECENT_LIMIT) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function pushAdminSearchRecent(current: readonly AdminSearchHit[], hit: AdminSearchHit): AdminSearchHit[] {
  const next = [hit, ...current.filter((row) => !(row.kind === hit.kind && row.id === hit.id))];
  return next.slice(0, ADMIN_SEARCH_RECENT_LIMIT);
}
