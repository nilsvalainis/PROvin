import {
  CABINET_SECTIONS,
  isCabinetDocType,
  isCabinetSectionId,
  type CabinetAccessRule,
  type CabinetDocType,
  type CabinetSectionId,
} from "@/lib/iriss-logistics-cabinet";
import { ENV_ADMIN_USER_ID, type IrissSection } from "@/lib/staff-roles";

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

export type CabinetAccessView = {
  write: boolean;
  hideSums: boolean;
  admin: boolean;
  sections: CabinetSectionId[];
};

const SECTION_SAMPLE_TYPES: Record<CabinetSectionId, readonly CabinetDocType[]> = {
  A: ["purchase_confirm", "car_invoice", "auction_invoice", "service_invoice"],
  B: ["pickup_pdf"],
  C: ["service_invoice", "csdd_status", "note"],
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

export function isCabinetAdminQuery(query: Pick<CabinetAccessQuery, "userId" | "roles">): boolean {
  return query.userId === ENV_ADMIN_USER_ID && query.roles.length === 0;
}

/** v5.1 / Andris: Loģistika neredz A un servisa rēķinus. Grāmatvede - A rēķini + C, tikai piešķirtiem auto. */
export function defaultCabinetAccessAllow(
  role: CabinetAccessRole,
  docType: CabinetDocType,
  section?: CabinetSectionId,
): boolean {
  if (role === "logistika") {
    if (section === "A") return false;
    if (isCabinetInvoiceType(docType)) return false;
    return true;
  }
  if (role === "gramatvede") {
    if (section === "B") return false;
    if (section === "A") return isCabinetInvoiceType(docType);
    if (section === "C") return true;
    return isCabinetInvoiceType(docType);
  }
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

export function gramatvedeCarAssigned(
  query: Pick<CabinetAccessQuery, "userId" | "roles" | "carId">,
  rules: readonly CabinetAccessRule[],
): boolean {
  return rules.some((rule) => {
    if (!rule.allow) return false;
    if (rule.role && rule.role !== "gramatvede" && rule.role !== "admin") return false;
    if (rule.userId && rule.userId !== query.userId) return false;
    if (rule.carId && rule.carId !== query.carId) return false;
    return Boolean(rule.userId || rule.role === "gramatvede");
  });
}

function isAssignmentOnlyRule(rule: CabinetAccessRule): boolean {
  return !rule.section && !rule.docType;
}

export function evaluateCabinetAccess(query: CabinetAccessQuery, rules: readonly CabinetAccessRule[]): boolean {
  if (isCabinetAdminQuery(query)) return true;
  const matches = rules.filter((rule) => ruleApplies(rule, query));
  const specific = matches.filter((rule) => !isAssignmentOnlyRule(rule));
  if (specific.length > 0) {
    const best = Math.max(...specific.map(ruleScore));
    const top = specific.filter((rule) => ruleScore(rule) === best);
    if (top.some((rule) => !rule.allow)) return false;
    return true;
  }
  if (matches.some((rule) => isAssignmentOnlyRule(rule) && !rule.allow)) return false;
  if (query.roles.length === 0) return false;
  const gramatvedeOnly = query.roles.includes("gramatvede") && !query.roles.includes("logistika");
  if (gramatvedeOnly && !gramatvedeCarAssigned(query, rules)) return false;
  return query.roles.some((role) => defaultCabinetAccessAllow(role, query.docType, query.section));
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

export function visibleCabinetSections(
  query: Omit<CabinetAccessQuery, "section" | "docType">,
  rules: readonly CabinetAccessRule[],
): CabinetSectionId[] {
  return CABINET_SECTIONS.filter((section) =>
    canUseCabinetSection({ ...query, section }, rules, SECTION_SAMPLE_TYPES[section]),
  );
}

export function cabinetCarVisibleToActor(
  query: Omit<CabinetAccessQuery, "section" | "docType">,
  rules: readonly CabinetAccessRule[],
): boolean {
  if (isCabinetAdminQuery(query)) return true;
  if (query.roles.includes("logistika") || query.roles.includes("serviss")) return true;
  if (query.roles.includes("gramatvede")) return gramatvedeCarAssigned(query, rules);
  return false;
}

export function cabinetActorCanWrite(query: Pick<CabinetAccessQuery, "userId" | "roles">): boolean {
  if (isCabinetAdminQuery(query)) return true;
  return query.roles.includes("logistika") || query.roles.includes("serviss");
}

export function cabinetActorHidesSums(query: Pick<CabinetAccessQuery, "userId" | "roles">): boolean {
  if (isCabinetAdminQuery(query)) return false;
  if (query.roles.includes("gramatvede")) return false;
  return query.roles.includes("logistika") || query.roles.includes("serviss");
}

export function buildCabinetAccessView(
  query: Omit<CabinetAccessQuery, "section" | "docType">,
  rules: readonly CabinetAccessRule[],
): CabinetAccessView {
  return {
    write: cabinetActorCanWrite(query),
    hideSums: cabinetActorHidesSums(query),
    admin: isCabinetAdminQuery(query),
    sections: visibleCabinetSections(query, rules),
  };
}

export function isCabinetSectionIdList(v: unknown): v is CabinetSectionId[] {
  return Array.isArray(v) && v.every((x) => isCabinetSectionId(x));
}
