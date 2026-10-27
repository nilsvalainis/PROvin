import "server-only";

import { randomBytes } from "node:crypto";
import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  emptyB2bPartnerPrices,
  isSafeB2bPartnerId,
  isUsablePartnerPassword,
  normalizePartnerEmail,
  normalizePartnerWriteInput,
  parseB2bPartnerPrices,
  parsePartnerRecord,
  partnerFieldError,
  toPublicPartner,
  toAdminPartner,
  type B2bPartnerAdminListItem,
  type B2bPartnerPriceOverrides,
  type B2bPartnerPublicProfile,
  type B2bPartnerRecord,
  type B2bPartnerStatus,
  type B2bPartnerWriteInput,
} from "@/lib/b2b-partner-account";
import { hashB2bPartnerPassword, verifyB2bPartnerPassword } from "@/lib/b2b-partner-password";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import {
  emptyB2bWalletPrices,
  parseB2bWalletHiddenProducts,
  parseB2bWalletPrices,
  type B2bWalletPriceOverrides,
  type B2bWalletProductId,
} from "@/lib/b2b-wallet";
import {
  B2B_EMAIL_VERIFY_TTL_MS,
  B2B_PASSWORD_RESET_TTL_MS,
  b2bVerifyTokensEqual,
  hashB2bVerifyToken,
  isB2bVerifyHashOpen,
  isPartnerEmailVerified,
  isSafeB2bVerifyToken,
  newB2bVerifyToken,
  newB2bResetToken,
  isSafeB2bResetToken,
  type B2bEmailVerifyPurpose,
} from "@/lib/b2b-partner-verify";

const DOC_KEY = "index";

export type B2bPartnerDoc = {
  version: 1;
  updatedAt: string;
  partners: B2bPartnerRecord[];
};

export function emptyB2bPartnerDoc(): B2bPartnerDoc {
  return { version: 1, updatedAt: new Date().toISOString(), partners: [] };
}

export function parseB2bPartnerDoc(raw: unknown): B2bPartnerDoc {
  if (!raw || typeof raw !== "object") {
    throw new Error("invalid_partner_doc");
  }
  const p = raw as Partial<B2bPartnerDoc>;
  const partners: B2bPartnerRecord[] = [];
  if (Array.isArray(p.partners)) {
    for (const item of p.partners) {
      const row = parsePartnerRecord(item);
      if (row) partners.push(row);
    }
  }
  return {
    version: 1,
    updatedAt:
      typeof p.updatedAt === "string" && p.updatedAt.trim() ? p.updatedAt.trim() : new Date().toISOString(),
    partners,
  };
}

const store = createJsonDocStore<B2bPartnerDoc>({
  blobPrefix: "b2b-partners/",
  dirName: "b2b-partners",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseB2bPartnerDoc,
  empty: emptyB2bPartnerDoc,
});

const READ_CACHE_TTL_MS = 3000;
let readCache: { at: number; doc: B2bPartnerDoc } | null = null;
let readInflight: Promise<B2bPartnerDoc> | null = null;

/** Lasīšanai (saraksts, žetons, N× getById vienā pieprasījumā): viens Blob GET uz ~3 s. */
async function readDocCached(): Promise<B2bPartnerDoc> {
  if (readCache && Date.now() - readCache.at < READ_CACHE_TTL_MS) return readCache.doc;
  if (readInflight) return readInflight;
  readInflight = store
    .read(DOC_KEY)
    .then((doc) => {
      readCache = { at: Date.now(), doc };
      return doc;
    })
    .finally(() => {
      readInflight = null;
    });
  return readInflight;
}

let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function mutatePartners<R>(
  mutate: (doc: B2bPartnerDoc) => { value: R; next?: B2bPartnerDoc } | Promise<{ value: R; next?: B2bPartnerDoc }>,
): Promise<R> {
  readCache = null;
  return withLock(() =>
    store.update<R>(DOC_KEY, async (doc) => {
      const decision = await mutate(doc);
      if (decision.next === undefined) return { value: decision.value };
      return {
        value: decision.value,
        next: { ...decision.next, updatedAt: new Date().toISOString() },
      };
    }),
  );
}

function newPartnerId(): string {
  return `ptr_${randomBytes(8).toString("hex")}`;
}

export async function listB2bPartners(): Promise<B2bPartnerAdminListItem[]> {
  const doc = await readDocCached();
  return doc.partners
    .map(toAdminPartner)
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "lv"));
}

export async function getB2bPartnerById(id: string): Promise<B2bPartnerRecord | null> {
  if (!isSafeB2bPartnerId(id)) return null;
  const doc = await readDocCached();
  return doc.partners.find((p) => p.id === id) ?? null;
}

export async function getB2bPartnerByEmail(email: string): Promise<B2bPartnerRecord | null> {
  const key = normalizePartnerEmail(email);
  if (!key) return null;
  const doc = await readDocCached();
  return doc.partners.find((p) => p.email === key) ?? null;
}

export type CreateB2bPartnerResult =
  | { ok: true; partner: B2bPartnerPublicProfile; verifyToken: string | null }
  | { ok: false; error: "invalid_fields" | "email_taken" | "weak_password" };

export async function createB2bPartner(
  input: B2bPartnerWriteInput,
  password: string,
  opts?: { requireEmailVerification?: boolean; termsVersion?: string },
): Promise<CreateB2bPartnerResult> {
  return mutatePartners<CreateB2bPartnerResult>(async (doc) => {
    const normalized = normalizePartnerWriteInput(input);
    if (partnerFieldError(normalized)) return { value: { ok: false, error: "invalid_fields" } };
    if (!isUsablePartnerPassword(password)) return { value: { ok: false, error: "weak_password" } };
    if (doc.partners.some((p) => p.email === normalized.email)) {
      return { value: { ok: false, error: "email_taken" } };
    }
    const now = new Date().toISOString();
    const requireVerify = Boolean(opts?.requireEmailVerification);
    const verifyToken = requireVerify ? newB2bVerifyToken() : null;
    const record: B2bPartnerRecord = {
      id: newPartnerId(),
      ...normalized,
      passwordHash: hashB2bPartnerPassword(password.trim()),
      status: "active",
      createdAt: now,
      updatedAt: now,
      emailVerifiedAt: requireVerify ? null : now,
      emailVerifyHash: verifyToken ? hashB2bVerifyToken(verifyToken) : null,
      emailVerifyExpiresAt: verifyToken ? new Date(Date.now() + B2B_EMAIL_VERIFY_TTL_MS).toISOString() : null,
      emailVerifyPurpose: verifyToken ? "signup" : null,
      pendingEmail: null,
      passwordResetHash: null,
      passwordResetExpiresAt: null,
      dealerEnabled: false,
      prices: emptyB2bPartnerPrices(),
      walletPrices: emptyB2bWalletPrices(),
      walletHiddenProducts: [],
      adminSeenAt: requireVerify ? null : now,
      termsVersion: opts?.termsVersion ?? null,
      termsAcceptedAt: opts?.termsVersion ? now : null,
    };
    return {
      value: { ok: true, partner: toPublicPartner(record), verifyToken },
      next: { ...doc, partners: [...doc.partners, record] },
    };
  });
}

export async function markB2bPartnerAdminSeen(
  id: string,
): Promise<{ ok: true; partner: B2bPartnerPublicProfile } | { ok: false; error: "not_found" }> {
  return mutatePartners<{ ok: true; partner: B2bPartnerPublicProfile } | { ok: false; error: "not_found" }>(
    async (doc) => {
    if (!isSafeB2bPartnerId(id)) return { value: { ok: false, error: "not_found" } };
    const idx = doc.partners.findIndex((p) => p.id === id);
    if (idx < 0) return { value: { ok: false, error: "not_found" } };
    const prev = doc.partners[idx]!;
    if (prev.adminSeenAt) return { value: { ok: true, partner: toPublicPartner(prev) } };
    const now = new Date().toISOString();
    const record: B2bPartnerRecord = { ...prev, adminSeenAt: now, updatedAt: now };
    const partners = doc.partners.slice();
    partners[idx] = record;
    return { value: { ok: true, partner: toPublicPartner(record) }, next: { ...doc, partners } };
  });
}

export type UpdateB2bPartnerResult =
  | { ok: true; partner: B2bPartnerPublicProfile }
  | { ok: false; error: "not_found" | "invalid_fields" | "email_taken" | "weak_password" };

export async function updateB2bPartner(
  id: string,
  patch: Partial<B2bPartnerWriteInput> & {
    status?: B2bPartnerStatus;
    password?: string;
    dealerEnabled?: boolean;
    prices?: B2bPartnerPriceOverrides;
    walletPrices?: B2bWalletPriceOverrides;
    walletHiddenProducts?: readonly B2bWalletProductId[];
  },
): Promise<UpdateB2bPartnerResult> {
  return mutatePartners<UpdateB2bPartnerResult>(async (doc) => {
    if (!isSafeB2bPartnerId(id)) return { value: { ok: false, error: "not_found" } };
    const idx = doc.partners.findIndex((p) => p.id === id);
    if (idx < 0) return { value: { ok: false, error: "not_found" } };
    const prev = doc.partners[idx]!;
    const nextInput = normalizePartnerWriteInput({
      companyName: patch.companyName ?? prev.companyName,
      companyReg: patch.companyReg ?? prev.companyReg,
      companyAddress: patch.companyAddress ?? prev.companyAddress,
      contactName: patch.contactName ?? prev.contactName,
      email: patch.email ?? prev.email,
      phone: patch.phone ?? prev.phone,
    });
    if (partnerFieldError(nextInput)) return { value: { ok: false, error: "invalid_fields" } };
    if (doc.partners.some((p) => p.id !== id && p.email === nextInput.email)) {
      return { value: { ok: false, error: "email_taken" } };
    }
    if (patch.password != null && patch.password.trim()) {
      if (!isUsablePartnerPassword(patch.password)) return { value: { ok: false, error: "weak_password" } };
    }
    const status: B2bPartnerStatus = patch.status === "disabled" || patch.status === "active" ? patch.status : prev.status;
    const now = new Date().toISOString();
    const emailChanged = nextInput.email !== prev.email;
    const record: B2bPartnerRecord = {
      ...prev,
      ...nextInput,
      status,
      dealerEnabled: typeof patch.dealerEnabled === "boolean" ? patch.dealerEnabled : prev.dealerEnabled,
      prices: patch.prices ? parseB2bPartnerPrices(patch.prices) : prev.prices,
      walletPrices: patch.walletPrices ? parseB2bWalletPrices(patch.walletPrices) : prev.walletPrices,
      walletHiddenProducts: patch.walletHiddenProducts
        ? parseB2bWalletHiddenProducts(patch.walletHiddenProducts)
        : (prev.walletHiddenProducts ?? []),
      passwordHash:
        patch.password != null && patch.password.trim()
          ? hashB2bPartnerPassword(patch.password.trim())
          : prev.passwordHash,
      updatedAt: now,
      ...(patch.password != null && patch.password.trim()
        ? { passwordResetHash: null, passwordResetExpiresAt: null }
        : {}),
      ...(emailChanged
        ? {
            emailVerifiedAt: now,
            pendingEmail: null,
            emailVerifyHash: null,
            emailVerifyExpiresAt: null,
            emailVerifyPurpose: null,
          }
        : {}),
    };
    const partners = doc.partners.slice();
    partners[idx] = record;
    return { value: { ok: true, partner: toPublicPartner(record) }, next: { ...doc, partners } };
  });
}

export type AuthenticateB2bPartnerResult =
  | { ok: true; partner: B2bPartnerRecord }
  | { ok: false; error: "invalid" | "unverified" };

export async function authenticateB2bPartner(
  email: string,
  password: string,
): Promise<AuthenticateB2bPartnerResult> {
  const partner = await getB2bPartnerByEmail(email);
  if (!partner || partner.status !== "active") return { ok: false, error: "invalid" };
  if (!verifyB2bPartnerPassword(password, partner.passwordHash)) return { ok: false, error: "invalid" };
  if (!isPartnerEmailVerified(partner)) return { ok: false, error: "unverified" };
  return { ok: true, partner };
}

function issueVerifyFields(
  purpose: B2bEmailVerifyPurpose,
): { token: string; emailVerifyHash: string; emailVerifyExpiresAt: string; emailVerifyPurpose: B2bEmailVerifyPurpose } {
  const token = newB2bVerifyToken();
  return {
    token,
    emailVerifyHash: hashB2bVerifyToken(token),
    emailVerifyExpiresAt: new Date(Date.now() + B2B_EMAIL_VERIFY_TTL_MS).toISOString(),
    emailVerifyPurpose: purpose,
  };
}

export async function resendB2bPartnerVerifyToken(
  email: string,
): Promise<{ token: string; to: string; purpose: B2bEmailVerifyPurpose } | null> {
  return mutatePartners<{ token: string; to: string; purpose: B2bEmailVerifyPurpose } | null>(async (doc) => {
    const key = normalizePartnerEmail(email);
    if (!key) return { value: null };
    const idx = doc.partners.findIndex((p) => p.email === key || p.pendingEmail === key);
    if (idx < 0) return { value: null };
    const prev = doc.partners[idx]!;
    if (prev.status !== "active") return { value: null };
    const purpose: B2bEmailVerifyPurpose | null = prev.pendingEmail
      ? "email_change"
      : !isPartnerEmailVerified(prev)
        ? "signup"
        : null;
    if (!purpose) return { value: null };
    const issued = issueVerifyFields(purpose);
    const now = new Date().toISOString();
    const partners = doc.partners.slice();
    partners[idx] = {
      ...prev,
      emailVerifyHash: issued.emailVerifyHash,
      emailVerifyExpiresAt: issued.emailVerifyExpiresAt,
      emailVerifyPurpose: issued.emailVerifyPurpose,
      updatedAt: now,
    };
    return {
      value: {
        token: issued.token,
        to: purpose === "email_change" && prev.pendingEmail ? prev.pendingEmail : prev.email,
        purpose,
      },
      next: { ...doc, partners },
    };
  });
}

export async function consumeB2bPartnerVerifyToken(
  token: string,
): Promise<{ ok: true; partner: B2bPartnerRecord } | { ok: false; error: "invalid" }> {
  if (!isSafeB2bVerifyToken(token)) return { ok: false, error: "invalid" };
  return mutatePartners<{ ok: true; partner: B2bPartnerRecord } | { ok: false; error: "invalid" }>(async (doc) => {
    const nowMs = Date.now();
    const idx = doc.partners.findIndex(
      (p) =>
        Boolean(p.emailVerifyHash) &&
        isB2bVerifyHashOpen(p.emailVerifyExpiresAt, nowMs) &&
        b2bVerifyTokensEqual(p.emailVerifyHash!, token),
    );
    if (idx < 0) return { value: { ok: false, error: "invalid" } };
    const prev = doc.partners[idx]!;
    const stamp = new Date().toISOString();
    const partners = doc.partners.slice();
    if (prev.emailVerifyPurpose === "email_change") {
      const nextEmail = prev.pendingEmail;
      if (!nextEmail || doc.partners.some((p) => p.id !== prev.id && p.email === nextEmail)) {
        return { value: { ok: false, error: "invalid" } };
      }
      partners[idx] = {
        ...prev,
        email: nextEmail,
        pendingEmail: null,
        emailVerifiedAt: stamp,
        emailVerifyHash: null,
        emailVerifyExpiresAt: null,
        emailVerifyPurpose: null,
        updatedAt: stamp,
      };
    } else {
      partners[idx] = {
        ...prev,
        pendingEmail: null,
        emailVerifiedAt: stamp,
        emailVerifyHash: null,
        emailVerifyExpiresAt: null,
        emailVerifyPurpose: null,
        updatedAt: stamp,
      };
    }
    return { value: { ok: true, partner: partners[idx]! }, next: { ...doc, partners } };
  });
}

export async function changeB2bPartnerPassword(
  id: string,
  currentPassword: string,
  nextPassword: string,
): Promise<{ ok: true } | { ok: false; error: "not_found" | "invalid_current" | "weak_password" | "same_password" }> {
  return mutatePartners<{ ok: true } | { ok: false; error: "not_found" | "invalid_current" | "weak_password" | "same_password" }>(
    async (doc) => {
    if (!isSafeB2bPartnerId(id)) return { value: { ok: false, error: "not_found" } };
    const idx = doc.partners.findIndex((p) => p.id === id);
    if (idx < 0) return { value: { ok: false, error: "not_found" } };
    const prev = doc.partners[idx]!;
    if (!verifyB2bPartnerPassword(currentPassword, prev.passwordHash)) {
      return { value: { ok: false, error: "invalid_current" } };
    }
    if (!isUsablePartnerPassword(nextPassword)) return { value: { ok: false, error: "weak_password" } };
    if (verifyB2bPartnerPassword(nextPassword.trim(), prev.passwordHash)) {
      return { value: { ok: false, error: "same_password" } };
    }
    const partners = doc.partners.slice();
    partners[idx] = {
      ...prev,
      passwordHash: hashB2bPartnerPassword(nextPassword.trim()),
      passwordResetHash: null,
      passwordResetExpiresAt: null,
      updatedAt: new Date().toISOString(),
    };
    return { value: { ok: true }, next: { ...doc, partners } };
  });
}

export async function requestB2bPartnerEmailChange(
  id: string,
  currentPassword: string,
  nextEmail: string,
): Promise<
  | { ok: true; token: string; to: string; partner: B2bPartnerPublicProfile }
  | { ok: false; error: "not_found" | "invalid_current" | "invalid_email" | "email_taken" | "same_email" }
> {
  return mutatePartners<
    | { ok: true; token: string; to: string; partner: B2bPartnerPublicProfile }
    | { ok: false; error: "not_found" | "invalid_current" | "invalid_email" | "email_taken" | "same_email" }
  >(async (doc) => {
    if (!isSafeB2bPartnerId(id)) return { value: { ok: false, error: "not_found" } };
    const idx = doc.partners.findIndex((p) => p.id === id);
    if (idx < 0) return { value: { ok: false, error: "not_found" } };
    const prev = doc.partners[idx]!;
    if (!verifyB2bPartnerPassword(currentPassword, prev.passwordHash)) {
      return { value: { ok: false, error: "invalid_current" } };
    }
    const email = normalizePartnerEmail(nextEmail).slice(0, 254);
    if (!isValidOrderEmail(email)) return { value: { ok: false, error: "invalid_email" } };
    if (email === prev.email) return { value: { ok: false, error: "same_email" } };
    if (doc.partners.some((p) => p.id !== id && (p.email === email || p.pendingEmail === email))) {
      return { value: { ok: false, error: "email_taken" } };
    }
    const issued = issueVerifyFields("email_change");
    const now = new Date().toISOString();
    const record: B2bPartnerRecord = {
      ...prev,
      pendingEmail: email,
      emailVerifyHash: issued.emailVerifyHash,
      emailVerifyExpiresAt: issued.emailVerifyExpiresAt,
      emailVerifyPurpose: issued.emailVerifyPurpose,
      updatedAt: now,
    };
    const partners = doc.partners.slice();
    partners[idx] = record;
    return {
      value: { ok: true, token: issued.token, to: email, partner: toPublicPartner(record) },
      next: { ...doc, partners },
    };
  });
}

export async function requestB2bPartnerPasswordReset(
  email: string,
): Promise<{ token: string; to: string } | null> {
  return mutatePartners<{ token: string; to: string } | null>(async (doc) => {
    const key = normalizePartnerEmail(email);
    if (!key || !isValidOrderEmail(key)) return { value: null };
    const idx = doc.partners.findIndex((p) => p.email === key);
    if (idx < 0) return { value: null };
    const prev = doc.partners[idx]!;
    if (prev.status !== "active") return { value: null };
    const token = newB2bResetToken();
    const now = new Date().toISOString();
    const partners = doc.partners.slice();
    partners[idx] = {
      ...prev,
      passwordResetHash: hashB2bVerifyToken(token),
      passwordResetExpiresAt: new Date(Date.now() + B2B_PASSWORD_RESET_TTL_MS).toISOString(),
      updatedAt: now,
    };
    return { value: { token, to: prev.email }, next: { ...doc, partners } };
  });
}

export async function completeB2bPartnerPasswordReset(
  token: string,
  nextPassword: string,
): Promise<{ ok: true; partner: B2bPartnerRecord } | { ok: false; error: "invalid" | "weak_password" }> {
  if (!isSafeB2bResetToken(token)) return { ok: false, error: "invalid" };
  if (!isUsablePartnerPassword(nextPassword)) return { ok: false, error: "weak_password" };
  return mutatePartners<{ ok: true; partner: B2bPartnerRecord } | { ok: false; error: "invalid" | "weak_password" }>(
    async (doc) => {
    const nowMs = Date.now();
    const idx = doc.partners.findIndex(
      (p) =>
        Boolean(p.passwordResetHash) &&
        isB2bVerifyHashOpen(p.passwordResetExpiresAt, nowMs) &&
        b2bVerifyTokensEqual(p.passwordResetHash!, token),
    );
    if (idx < 0) return { value: { ok: false, error: "invalid" } };
    const prev = doc.partners[idx]!;
    if (prev.status !== "active") return { value: { ok: false, error: "invalid" } };
    const stamp = new Date().toISOString();
    const partners = doc.partners.slice();
    partners[idx] = {
      ...prev,
      passwordHash: hashB2bPartnerPassword(nextPassword.trim()),
      passwordResetHash: null,
      passwordResetExpiresAt: null,
      updatedAt: stamp,
    };
    return { value: { ok: true, partner: partners[idx]! }, next: { ...doc, partners } };
  });
}

export async function deleteB2bPartner(
  id: string,
): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  return mutatePartners<{ ok: true } | { ok: false; error: "not_found" }>(async (doc) => {
    if (!isSafeB2bPartnerId(id)) return { value: { ok: false, error: "not_found" } };
    const next = doc.partners.filter((p) => p.id !== id);
    if (next.length === doc.partners.length) return { value: { ok: false, error: "not_found" } };
    return { value: { ok: true }, next: { ...doc, partners: next } };
  });
}
