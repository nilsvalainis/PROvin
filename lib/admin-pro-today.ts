/**
 * PRO telefona sākums «Šodien» (22.11 makets v3, izvēlne B): augšā darāmais lielās rindās.
 * Tikai esošie dati: pasūtījumu ielases indikācija (tā pati, ko saraksta filtri), termiņi (SLA) un ātro vērtējumu rinda.
 * Tīra loģika (klients + testi). Ja kādam skaitlim datu nav (vēl nav ielādēts vai neizdevās) - rindu nerāda.
 */

import { adminIngestMatchesFilter, type AdminIngestFilter, type AdminOrderIngest } from "@/lib/admin-mobile-ingest";
import { isAdminOrderInactive } from "@/lib/admin-audit-deadline";
import { ADMIN_ORDERS_DEADLINE_PARAM } from "@/lib/admin-orders-deadline-filter";
import type { ProHomeSummary } from "@/lib/admin-pro-home";

/** Pasūtījumu saraksta URL parametrs ielases filtram (telefons): `?ielase=nav-nosutiti|kludas|ielasa`. */
export const ADMIN_ORDERS_INGEST_PARAM = "ielase";

const INGEST_PARAM_TO_FILTER: Record<string, AdminIngestFilter> = {
  "nav-nosutiti": "not_sent",
  kludas: "errors",
  ielasa: "running",
};

export function parseAdminOrdersIngestParam(raw: string | null | undefined): AdminIngestFilter {
  return INGEST_PARAM_TO_FILTER[(raw ?? "").trim().toLowerCase()] ?? "all";
}

export type ProTodayIngestCounts = { notSent: number; errors: number };

/** Tikai aktīvie (neizpildītie) pasūtījumi: «Šodien» rāda darāmo, nevis vēsturi. */
export function countProTodayIngest(
  rows: ReadonlyArray<{ ingest: AdminOrderIngest | null | undefined; auditComplete?: boolean; isB2bPack?: boolean; fullyReversed?: boolean }>,
): ProTodayIngestCounts {
  const out: ProTodayIngestCounts = { notSent: 0, errors: 0 };
  for (const r of rows) {
    if (isAdminOrderInactive(r)) continue;
    if (adminIngestMatchesFilter(r.ingest, "not_sent")) out.notSent++;
    if (adminIngestMatchesFilter(r.ingest, "errors")) out.errors++;
  }
  return out;
}

export function parseProTodayIngestCounts(raw: unknown): ProTodayIngestCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  const notSent = n(o.notSent);
  const errors = n(o.errors);
  if (notSent == null || errors == null) return null;
  return { notSent, errors };
}

/** «34 h», «24 d», «<1 h». */
export function formatProTodayAge(ageMs: number): string {
  const h = Math.floor(Math.max(0, ageMs) / 3_600_000);
  if (h < 1) return "<1 h";
  if (h >= 48) return `${Math.floor(h / 24)} d`;
  return `${h} h`;
}

export type ProTodayRow = {
  id: "not_sent" | "errors" | "overdue" | "fast";
  count: number;
  title: string;
  sub: string;
  href: string;
  /** Sarkans skaitlis: kļūdas un kavējumi (tikai, ja > 0). */
  alert: boolean;
};

export type ProTodayInput = {
  ingest: ProTodayIngestCounts | null;
  proHome: ProHomeSummary | null;
  /** Neatbildētie ātrie vērtējumi (null - nav zināms). */
  openCount: number | null;
  openOldestAt?: string | null;
  nowMs: number;
};

/** Augšējās rindas tādā secībā kā maketā. Rindas, kurām datu nav, izlaistas. */
export function proTodayRows(input: ProTodayInput): ProTodayRow[] {
  const rows: ProTodayRow[] = [];
  const { ingest, proHome, openCount, openOldestAt, nowMs } = input;
  if (ingest) {
    rows.push({
      id: "not_sent",
      count: ingest.notSent,
      title: "Nav nosūtīti",
      sub: "dīlera dati · ielasīti",
      href: `/admin/dashboard?${ADMIN_ORDERS_INGEST_PARAM}=nav-nosutiti`,
      alert: false,
    });
    rows.push({
      id: "errors",
      count: ingest.errors,
      title: "Kļūda vai datu nav",
      sub: "jāielasa vēlreiz vai jāatmaksā",
      href: `/admin/dashboard?${ADMIN_ORDERS_INGEST_PARAM}=kludas`,
      alert: ingest.errors > 0,
    });
  }
  if (proHome) {
    // Tas pats, ko rāda saraksts ar `?termins=nokavets` (MINI, auditi un dīleri).
    const overdue = proHome.orders.overdue + proHome.dealers.overdue;
    const oldest = [proHome.orders.oldestOverdueFromUnix, proHome.dealers.oldestOverdueFromUnix].filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v),
    );
    // Kavējums skaitās no termiņa beigām (48 h pēc sākuma).
    const oldestFrom = oldest.length > 0 ? Math.min(...oldest) : null;
    rows.push({
      id: "overdue",
      count: overdue,
      title: "Auditi kavē",
      sub: overdue > 0 && oldestFrom != null ? `vecākais ${formatProTodayAge(nowMs - (oldestFrom * 1000 + 48 * 3_600_000))}` : "termiņi kārtībā",
      href: `/admin/dashboard?${ADMIN_ORDERS_DEADLINE_PARAM}=nokavets`,
      alert: overdue > 0,
    });
  }
  if (openCount != null) {
    const oldestMs = openOldestAt ? Date.parse(openOldestAt) : NaN;
    rows.push({
      id: "fast",
      count: openCount,
      title: "Ātrie vērtējumi gaida",
      sub: openCount > 0 && Number.isFinite(oldestMs) ? `vecākais ${formatProTodayAge(nowMs - oldestMs)}` : openCount > 0 ? "gaida atbildi" : "viss atbildēts",
      href: "/admin/atras-vertesanas?tab=pending",
      alert: false,
    });
  }
  return rows;
}
