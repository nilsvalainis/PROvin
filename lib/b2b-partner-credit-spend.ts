import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { emptyB2bCreditRemaining, type B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import {
  parsePartnerCheckoutLineFromNotes,
  parsePartnerCompanyFromNotes,
  parsePartnerIdFromNotes,
} from "@/lib/b2b-partner-orders";

export type PartnerCreditSpendJob = {
  partnerId?: string | null;
  companyName?: string | null;
  checkoutLine?: string | null;
  notes?: string | null;
  /** Atjaunots kredīts - netērēts neto. */
  creditRestored?: boolean;
};

export function normalizePartnerCompanyKey(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function resolvePartnerCreditSpendJob(
  job: PartnerCreditSpendJob,
  companyToPartnerId?: ReadonlyMap<string, string>,
): { partnerId: string; plan: B2bPartnerPlanId } | null {
  if (job.creditRestored) return null;
  const fromRecord = (job.partnerId ?? "").trim();
  const fromNotes = parsePartnerIdFromNotes(job.notes);
  let partnerId = fromRecord || fromNotes || "";
  if (!partnerId && companyToPartnerId) {
    const company = job.companyName?.trim() || parsePartnerCompanyFromNotes(job.notes);
    const mapped = company ? companyToPartnerId.get(normalizePartnerCompanyKey(company)) : undefined;
    if (mapped) partnerId = mapped;
  }
  if (!partnerId) return null;
  const line = (job.checkoutLine ?? "").trim().toLowerCase();
  const plan: B2bPartnerPlanId =
    line === "dealer" || line === "business"
      ? line
      : parsePartnerCheckoutLineFromNotes(job.notes) ?? "business";
  return { partnerId, plan };
}

export function emptySpendByPartnerId(partnerIds: readonly string[]): Record<string, B2bCreditRemaining> {
  return Object.fromEntries(partnerIds.map((id) => [id, emptyB2bCreditRemaining()]));
}

export function tallyPartnerCreditSpend(
  jobs: readonly PartnerCreditSpendJob[],
  partnerIds: readonly string[],
  companyToPartnerId?: ReadonlyMap<string, string>,
): Record<string, B2bCreditRemaining> {
  const allowed = new Set(partnerIds);
  const out = emptySpendByPartnerId(partnerIds);
  for (const job of jobs) {
    const resolved = resolvePartnerCreditSpendJob(job, companyToPartnerId);
    if (!resolved || !allowed.has(resolved.partnerId)) continue;
    out[resolved.partnerId][resolved.plan] += 1;
  }
  return out;
}
