/**
 * Pasūtījumu saraksts pēc termiņa (?termins=nokavets | steidzams), lai pieskāriens sarkanajam skaitlim
 * uzreiz atver tikos pasūtījumus. Tikai neizpildītie.
 */
import { formatAuditDeadlineRemaining } from "@/lib/admin-audit-deadline";

export type AdminOrdersDeadlineFilter = "overdue" | "urgent";

export const ADMIN_ORDERS_DEADLINE_PARAM = "termins";

export function parseAdminOrdersDeadlineFilter(raw: string | null | undefined): AdminOrdersDeadlineFilter | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "nokavets") return "overdue";
  if (v === "steidzams") return "urgent";
  return null;
}

export function adminOrdersDeadlineFilterParam(f: AdminOrdersDeadlineFilter): string {
  return f === "overdue" ? "nokavets" : "steidzams";
}

export function adminOrdersDeadlineFilterLabel(f: AdminOrdersDeadlineFilter): string {
  return f === "overdue" ? "nokavētie" : "steidzamie un nokavētie";
}

/** "steidzams" ietver arī nokavētos: abiem jāpievēršas tagad. */
export function matchesAdminOrdersDeadlineFilter(
  o: { created: number; deadlineFromUnix?: number | null; auditComplete?: boolean; isB2bPack?: boolean },
  f: AdminOrdersDeadlineFilter,
  nowMs: number,
): boolean {
  if (o.auditComplete || o.isB2bPack) return false;
  const { status } = formatAuditDeadlineRemaining(o.deadlineFromUnix ?? o.created, nowMs);
  return f === "overdue" ? status === "overdue" : status === "overdue" || status === "urgent";
}
