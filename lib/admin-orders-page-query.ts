/**
 * PRO pasūtījumu saraksta servera lapošana + meklēšana + kārtošana.
 * Noteikums: VISI aktīvie (neizpildītie, ne B2B paka) vienmēr 1. lapā augšā, jaunākie ienākušie pirmie;
 * izpildītie zemāk — pa `limit` (50, 100, …), kārtoti pēc izvēlētās secības.
 */
import { partitionAdminOrdersActiveFirst } from "@/lib/admin-audit-deadline-complete";

export const ORDERS_PAGE_SIZE = 50;
export type AdminOrdersSort = "newest" | "oldest";

/** Telefonā (Nils 06.11): sākumā tikai neizpildītie, izpildītos rāda pa 5. */
export const ORDERS_MOBILE_PAGE_SIZE = 5;

export type AdminOrdersQuery = { q: string; sort: AdminOrdersSort; limit: number; pageSize: number };

/** Telefona pārlūks pēc User-Agent (iPhone, Android, „Mobi”). Planšetes paliek kā dators. */
export function isMobileUserAgent(ua: string | null | undefined): boolean {
  return /iPhone|iPod|Android.+Mobile|Mobi/i.test(ua ?? "");
}

export function parseAdminOrdersQuery(
  sp: Record<string, string | string[] | undefined> | undefined,
  opts?: { mobile?: boolean },
): AdminOrdersQuery {
  const one = (k: string) => {
    const v = sp?.[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const q = one("q").trim().slice(0, 100);
  const sort: AdminOrdersSort = one("sort") === "oldest" ? "oldest" : "newest";
  const pageSize = opts?.mobile ? ORDERS_MOBILE_PAGE_SIZE : ORDERS_PAGE_SIZE;
  const initial = opts?.mobile ? 0 : ORDERS_PAGE_SIZE;
  const n = Number.parseInt(one("limit"), 10);
  let limit = Number.isFinite(n) && n > 0 ? Math.min(5000, Math.ceil(n / pageSize) * pageSize) : initial;
  // Meklēšana: rāda atrastos arī no arhīva, ne tikai neizpildītos.
  if (q && limit < ORDERS_PAGE_SIZE) limit = ORDERS_PAGE_SIZE;
  return { q, sort, limit, pageSize };
}

/** Bez reģistra un diakritikas („Škoda” = „skoda”, „Jānis” = „janis”). */
export function foldSearchText(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

type SearchableRow = {
  id: string;
  created: number;
  activityUnix?: number;
  auditComplete?: boolean;
  isB2bPack?: boolean;
  vin?: string | null;
  makeModel?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  partnerCompanyName?: string | null;
};

export function adminOrderMatchesQuery(row: SearchableRow, q: string): boolean {
  const needle = foldSearchText(q);
  if (!needle) return true;
  const vinNeedle = needle.replace(/[\s-]/g, "").toUpperCase();
  const vin = (row.vin ?? "").replace(/\s/g, "").toUpperCase();
  if (vinNeedle.length >= 3 && vin.includes(vinNeedle)) return true;
  const hay = foldSearchText(
    [row.makeModel, row.customerEmail, row.customerName, row.partnerCompanyName, row.customerPhone, row.id].filter(Boolean).join(" "),
  );
  // Visi vārdi jāatrod (piem. „audi a6”).
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

export function queryAdminOrderRows<T extends SearchableRow>(
  rows: readonly T[],
  query: AdminOrdersQuery,
): { rows: T[]; activeCount: number; doneTotal: number; doneShown: number; matched: number } {
  const matched = rows.filter((r) => adminOrderMatchesQuery(r, query.q));
  const { active, done } = partitionAdminOrdersActiveFirst([...matched]);
  const sortedDone = [...done].sort((a, b) => (query.sort === "oldest" ? a.created - b.created : b.created - a.created));
  const shown = sortedDone.slice(0, query.limit);
  return { rows: [...active, ...shown], activeCount: active.length, doneTotal: sortedDone.length, doneShown: shown.length, matched: matched.length };
}
