const TENANT_ID_RE = /^tnt_[a-z0-9]{6,32}$/;
const USER_ID_RE = /^usr_[a-z0-9]{6,32}$/;
const ORDER_ID_RE = /^ord_[a-z0-9]{6,32}$/;
const OFFER_ID_RE = /^off_[a-z0-9]{6,32}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

export function isSafeB2bDemoTenantId(id: string): boolean {
  return TENANT_ID_RE.test(id);
}

export function isSafeB2bDemoUserId(id: string): boolean {
  return USER_ID_RE.test(id);
}

export function isSafeB2bDemoOrderId(id: string): boolean {
  return ORDER_ID_RE.test(id);
}

export function isSafeB2bDemoOfferId(id: string): boolean {
  return OFFER_ID_RE.test(id);
}

export function isSafeB2bDemoSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function normalizeB2bDemoEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeB2bDemoSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
