import "server-only";

import {
  buildCompanyVerifyReport,
  isCompanyVerifyDecision,
  normalizeCompanyVerifyInput,
  type CompanyVerifyDecision,
  type CompanyVerifyInput,
  type CompanyVerifySubjectKind,
  type CompanyVerifyView,
} from "@/lib/b2b-company-verify";
import { fetchCompanyVerifySources, type CompanyVerifyFetch } from "@/lib/b2b-company-verify-sources";
import {
  isFreshCompanyVerifyCache,
  readCompanyVerifyCache,
  setCompanyVerifyDecision,
  writeCompanyVerifyCache,
} from "@/lib/b2b-company-verify-store";
import { getB2bPartnerLeadById, setB2bPartnerLeadDecision } from "@/lib/b2b-partner-lead-store";
import { getB2bPartnerById, updateB2bPartner } from "@/lib/b2b-partner-store";

export function inputFromLeadLike(row: {
  companyName: string;
  contactName: string;
  email: string;
  companyReg?: string;
  companyAddress?: string;
  vatNumber?: string;
}): CompanyVerifyInput {
  return normalizeCompanyVerifyInput({
    companyName: row.companyName,
    companyReg: row.companyReg ?? "",
    companyAddress: row.companyAddress ?? "",
    vatNumber: row.vatNumber ?? "",
    contactName: row.contactName,
    email: row.email,
  });
}

export async function loadCompanyVerifySubject(
  kind: CompanyVerifySubjectKind,
  id: string,
): Promise<{ input: CompanyVerifyInput } | null> {
  if (kind === "lead") {
    const lead = await getB2bPartnerLeadById(id);
    if (!lead) return null;
    return { input: inputFromLeadLike(lead) };
  }
  const partner = await getB2bPartnerById(id);
  if (!partner) return null;
  return { input: inputFromLeadLike(partner) };
}

export async function runCompanyVerify(opts: {
  kind: CompanyVerifySubjectKind;
  id: string;
  refresh?: boolean;
  fetchImpl?: CompanyVerifyFetch;
}): Promise<CompanyVerifyView | null> {
  const subject = await loadCompanyVerifySubject(opts.kind, opts.id);
  if (!subject) return null;
  const cached = await readCompanyVerifyCache(opts.kind, opts.id);
  if (!opts.refresh && cached && isFreshCompanyVerifyCache(cached)) {
    return {
      kind: opts.kind,
      id: opts.id,
      input: subject.input,
      report: cached.report,
      decision: cached.decision,
      decidedAt: cached.decidedAt,
      cached: true,
    };
  }
  const sources = await fetchCompanyVerifySources(subject.input, opts.fetchImpl);
  const report = buildCompanyVerifyReport(subject.input, sources);
  const doc = await writeCompanyVerifyCache({
    version: 1,
    kind: opts.kind,
    id: opts.id,
    input: subject.input,
    report,
    decision: cached?.decision ?? "pending",
    decidedAt: cached?.decidedAt ?? null,
    cachedAt: report.fetchedAt,
  });
  return {
    kind: opts.kind,
    id: opts.id,
    input: subject.input,
    report: doc.report,
    decision: doc.decision,
    decidedAt: doc.decidedAt,
    cached: false,
  };
}

export async function applyCompanyVerifyDecision(opts: {
  kind: CompanyVerifySubjectKind;
  id: string;
  decision: CompanyVerifyDecision;
}): Promise<CompanyVerifyView | null> {
  if (!isCompanyVerifyDecision(opts.decision)) return null;
  if (opts.kind === "lead") {
    const lead = await setB2bPartnerLeadDecision(opts.id, opts.decision);
    if (!lead) return null;
  } else {
    const status = opts.decision === "rejected" ? "disabled" : opts.decision === "approved" ? "active" : undefined;
    if (status) {
      const result = await updateB2bPartner(opts.id, { status });
      if (!result.ok) return null;
    } else if (!(await getB2bPartnerById(opts.id))) {
      return null;
    }
  }
  let cached = await setCompanyVerifyDecision(opts.kind, opts.id, opts.decision);
  if (!cached) {
    const fresh = await runCompanyVerify({ kind: opts.kind, id: opts.id });
    if (!fresh) return null;
    cached = await setCompanyVerifyDecision(opts.kind, opts.id, opts.decision);
  }
  const subject = await loadCompanyVerifySubject(opts.kind, opts.id);
  if (!subject || !cached) return null;
  return {
    kind: opts.kind,
    id: opts.id,
    input: subject.input,
    report: cached.report,
    decision: cached.decision,
    decidedAt: cached.decidedAt,
    cached: true,
  };
}
