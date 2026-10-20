import {
  isCabinetDocType,
  isCabinetSectionId,
  type CabinetAccessRule,
  type CabinetDocType,
  type CabinetSectionId,
} from "@/lib/iriss-logistics-cabinet";
import type { IrissSection } from "@/lib/staff-roles";

export const CABINET_INVOICE_TYPES: readonly CabinetDocType[] = [
  "car_invoice",
  "auction_invoice",
  "service_invoice",
  "purchase_confirm",
];

export const CABINET_ACCESS_ROLES = ["logistika", "gramatvede", "serviss"] as const;
export type CabinetAccessRole = (typeof CABINET_ACCESS_ROLES)[number];

export type CabinetAccessDocKey = CabinetDocType | "invoices";

export type CabinetAccessQuery = {
  userId: string;
  roles: readonly CabinetAccessRole[];
  carId: string;
  section: CabinetSectionId;
  docType: CabinetDocType;
};

export function isCabinetAccessRole(v: unknown): v is CabinetAccessRole {
  return v === "logistika" || v === "gramatvede" || v === "serviss";
}

export function isCabinetAccessDocKey(v: unknown): v is CabinetAccessDocKey {
  return v === "invoices" || isCabinetDocType(v);
}

export function cabinetRolesFromSections(sections: readonly IrissSection[]): CabinetAccessRole[] {
  const out: CabinetAccessRole[] = [];
  for (const id of sections) {
    if (isCabinetAccessRole(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function isCabinetInvoiceType(type: CabinetDocType): boolean {
  return (CABINET_INVOICE_TYPES as readonly string[]).includes(type);
}

/** Nils 17:01: Loģistika redz visu. Grāmatvede - viss. Serviss - rēķini pēc noklusējuma nē. */
export function defaultCabinetAccessAllow(role: CabinetAccessRole, docType: CabinetDocType): boolean {
  if (role === "logistika" || role === "gramatvede") return true;
  if (role === "serviss") return !isCabinetInvoiceType(docType);
  return false;
}

function ruleMatchesDoc(rule: CabinetAccessRule, docType: CabinetDocType): boolean {
  if (!rule.docType) return true;
  if (rule.docType === "invoices") return isCabinetInvoiceType(docType);
  return rule.docType === docType;
}

function ruleApplies(rule: CabinetAccessRule, query: CabinetAccessQuery): boolean {
  if (rule.userId && rule.userId !== query.userId) return false;
  if (rule.role && !query.roles.includes(rule.role as CabinetAccessRole) && rule.role !== "admin") return false;
  if (rule.carId && rule.carId !== query.carId) return false;
  if (rule.section && rule.section !== query.section) return false;
  if (!ruleMatchesDoc(rule, query.docType)) return false;
  if (!rule.userId && !rule.role) return false;
  return true;
}

function ruleScore(rule: CabinetAccessRule): number {
  return (
    (rule.userId ? 8 : 0) +
    (rule.carId ? 4 : 0) +
    (rule.section ? 2 : 0) +
    (rule.docType ? 1 : 0) +
    (rule.role ? 0.5 : 0)
  );
}

export function evaluateCabinetAccess(query: CabinetAccessQuery, rules: readonly CabinetAccessRule[]): boolean {
  if (query.roles.length === 0 && query.userId === "env-admin") return true;
  const matches = rules.filter((rule) => ruleApplies(rule, query));
  if (matches.length > 0) {
    const best = Math.max(...matches.map(ruleScore));
    const top = matches.filter((rule) => ruleScore(rule) === best);
    if (top.some((rule) => !rule.allow)) return false;
    return true;
  }
  if (query.roles.length === 0) return false;
  return query.roles.some((role) => defaultCabinetAccessAllow(role, query.docType));
}

export function filterDocumentsByCabinetAccess<T extends { section: CabinetSectionId; type: CabinetDocType }>(
  docs: readonly T[],
  query: Omit<CabinetAccessQuery, "section" | "docType">,
  rules: readonly CabinetAccessRule[],
): T[] {
  return docs.filter((doc) =>
    evaluateCabinetAccess({ ...query, section: doc.section, docType: doc.type }, rules),
  );
}

export function canUseCabinetSection(
  query: Omit<CabinetAccessQuery, "docType"> & { docType?: CabinetDocType },
  rules: readonly CabinetAccessRule[],
  sampleTypes: readonly CabinetDocType[],
): boolean {
  return sampleTypes.some((docType) =>
    evaluateCabinetAccess({ ...query, docType: query.docType ?? docType }, rules),
  );
}
