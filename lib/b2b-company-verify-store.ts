import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  isCompanyVerifyDecision,
  normalizeCompanyVerifyInput,
  type CompanyVerifyDecision,
  type CompanyVerifyInput,
  type CompanyVerifyReport,
  type CompanyVerifySubjectKind,
} from "@/lib/b2b-company-verify";

export const B2B_COMPANY_VERIFY_TTL_MS = 6 * 60 * 60 * 1000;

export type CompanyVerifyCacheDoc = {
  version: 1;
  kind: CompanyVerifySubjectKind;
  id: string;
  input: CompanyVerifyInput;
  report: CompanyVerifyReport;
  decision: CompanyVerifyDecision;
  decidedAt: string | null;
  cachedAt: string;
};

const store = createJsonDocStore<CompanyVerifyCacheDoc | null>({
  blobPrefix: "b2b-company-verify/",
  dirName: "b2b-company-verify",
  isSafeKey: isSafeCompanyVerifyCacheKey,
  parse: parseCompanyVerifyCacheDoc,
  empty: () => null,
});

export function companyVerifyCacheKey(_kind: CompanyVerifySubjectKind, id: string): string {
  return id.trim();
}

export function isSafeCompanyVerifyCacheKey(key: string): boolean {
  return /^(lead_[a-z0-9_]{4,60}|ptr_[a-f0-9]{16})$/i.test(key);
}

export function parseCompanyVerifyCacheDoc(raw: unknown): CompanyVerifyCacheDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind === "lead" || o.kind === "partner" ? o.kind : null;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const report = o.report && typeof o.report === "object" ? (o.report as CompanyVerifyReport) : null;
  const cachedAt = typeof o.cachedAt === "string" ? o.cachedAt : "";
  if (!kind || !id || !report || !cachedAt) return null;
  if (!Array.isArray(report.checks) || (report.overall !== "derigs" && report.overall !== "saubigs")) {
    return null;
  }
  return {
    version: 1,
    kind,
    id,
    input: normalizeCompanyVerifyInput(o.input && typeof o.input === "object" ? (o.input as CompanyVerifyInput) : {}),
    report,
    decision: isCompanyVerifyDecision(o.decision) ? o.decision : "pending",
    decidedAt: typeof o.decidedAt === "string" && o.decidedAt.trim() ? o.decidedAt.trim() : null,
    cachedAt,
  };
}

export function isFreshCompanyVerifyCache(doc: CompanyVerifyCacheDoc | null, now = Date.now()): boolean {
  if (!doc) return false;
  const at = Date.parse(doc.cachedAt);
  if (!Number.isFinite(at)) return false;
  return now - at < B2B_COMPANY_VERIFY_TTL_MS;
}

export async function readCompanyVerifyCache(
  kind: CompanyVerifySubjectKind,
  id: string,
): Promise<CompanyVerifyCacheDoc | null> {
  return store.read(companyVerifyCacheKey(kind, id));
}

export async function writeCompanyVerifyCache(doc: CompanyVerifyCacheDoc): Promise<CompanyVerifyCacheDoc> {
  const key = companyVerifyCacheKey(doc.kind, doc.id);
  await store.update(key, () => ({ value: doc, next: doc }));
  return doc;
}

export async function setCompanyVerifyDecision(
  kind: CompanyVerifySubjectKind,
  id: string,
  decision: CompanyVerifyDecision,
): Promise<CompanyVerifyCacheDoc | null> {
  const key = companyVerifyCacheKey(kind, id);
  return store.update(key, (current) => {
    if (!current) return { value: null };
    const next: CompanyVerifyCacheDoc = {
      ...current,
      decision,
      decidedAt: decision === "pending" ? null : new Date().toISOString(),
    };
    return { value: next, next };
  });
}
