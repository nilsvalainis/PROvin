import "server-only";

import {
  emptyGoogleContactMatchIndex,
  findResourceNameInGoogleContactIndex,
  indexGoogleContactPhonesAndEmails,
  orderHasMatchableGoogleContact,
  type GoogleContactMatchIndex,
} from "@/lib/google-contact-match";
import type { IrissGoogleContactStatus, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export { orderHasClientContact } from "@/lib/iriss-google-contact-fields";
export { orderHasMatchableGoogleContact } from "@/lib/google-contact-match";

export const GOOGLE_CONTACTS_LABEL = "IRISS klients";
export const GOOGLE_CONTACTS_OAUTH_COOKIE = "iriss_gcontacts_oauth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PEOPLE_BASE = "https://people.googleapis.com/v1";
const CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts";

export type GoogleContactsConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type GoogleContactSyncResult = {
  status: IrissGoogleContactStatus;
  resourceName?: string;
  error?: string;
  linked?: "created" | "matched";
};

export type GoogleContactDirectoryCache = GoogleContactMatchIndex & {
  loaded?: boolean;
  groupResourceName?: string | null;
};

export type GoogleContactLinkContext = {
  token?: string;
  cache?: GoogleContactDirectoryCache;
};

type ContactRec = Pick<
  IrissPasutijumsRecord,
  "clientFirstName" | "clientLastName" | "phone" | "email" | "googleContactResourceName"
>;

export function emptyGoogleContactDirectoryCache(): GoogleContactDirectoryCache {
  return { ...emptyGoogleContactMatchIndex(), loaded: false };
}

export function readGoogleContactsConfig(): GoogleContactsConfig | null {
  const clientId = process.env.GOOGLE_CONTACTS_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CONTACTS_CLIENT_SECRET?.trim() ?? "";
  const refreshToken = process.env.GOOGLE_CONTACTS_REFRESH_TOKEN?.trim() ?? "";
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export function googleContactsOAuthClient(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CONTACTS_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CONTACTS_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function getGoogleContactsAccessToken(): Promise<string | null> {
  const cfg = readGoogleContactsConfig();
  if (!cfg) return null;
  return accessToken(cfg);
}

async function accessToken(cfg: GoogleContactsConfig): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || `token_http_${res.status}`);
  }
  return data.access_token;
}

async function peopleJson(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${PEOPLE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

function contactBody(rec: Pick<IrissPasutijumsRecord, "clientFirstName" | "clientLastName" | "phone" | "email">) {
  const given = rec.clientFirstName.trim();
  const family = rec.clientLastName.trim();
  const display = [given, family].filter(Boolean).join(" ") || rec.phone.trim() || rec.email.trim();
  return {
    names: [{ givenName: given, familyName: family, displayName: display }],
    phoneNumbers: rec.phone.trim() ? [{ value: rec.phone.trim(), type: "mobile" }] : [],
    emailAddresses: rec.email.trim() ? [{ value: rec.email.trim(), type: "work" }] : [],
  };
}

function rememberContact(cache: GoogleContactDirectoryCache, resourceName: string, rec: GoogleContactMatchFieldsLike): void {
  indexGoogleContactPhonesAndEmails(cache, resourceName, rec);
}

type GoogleContactMatchFieldsLike = { phone?: string; email?: string };

function indexListedPerson(cache: GoogleContactDirectoryCache, person: Record<string, unknown>): void {
  const resourceName = typeof person.resourceName === "string" ? person.resourceName.trim() : "";
  if (!resourceName) return;
  const phones = Array.isArray(person.phoneNumbers) ? person.phoneNumbers : [];
  for (const row of phones) {
    if (!row || typeof row !== "object") continue;
    const p = row as { value?: string; canonicalForm?: string };
    if (typeof p.value === "string") rememberContact(cache, resourceName, { phone: p.value });
    if (typeof p.canonicalForm === "string") rememberContact(cache, resourceName, { phone: p.canonicalForm });
  }
  const emails = Array.isArray(person.emailAddresses) ? person.emailAddresses : [];
  for (const row of emails) {
    if (!row || typeof row !== "object") continue;
    const e = row as { value?: string };
    if (typeof e.value === "string") rememberContact(cache, resourceName, { email: e.value });
  }
}

async function loadDirectory(token: string, cache: GoogleContactDirectoryCache): Promise<void> {
  if (cache.loaded) return;
  if (!cache.byPhone) cache.byPhone = new Map();
  if (!cache.byEmail) cache.byEmail = new Map();
  let pageToken = "";
  do {
    const qs = new URLSearchParams({
      personFields: "names,phoneNumbers,emailAddresses,memberships",
      pageSize: "1000",
    });
    if (pageToken) qs.set("pageToken", pageToken);
    const listed = await peopleJson(token, `/people/me/connections?${qs.toString()}`);
    if (!listed.ok) {
      throw new Error(`connections_${listed.status}`);
    }
    const connections = Array.isArray(listed.data.connections) ? listed.data.connections : [];
    for (const row of connections) {
      if (!row || typeof row !== "object") continue;
      indexListedPerson(cache, row as Record<string, unknown>);
    }
    pageToken = typeof listed.data.nextPageToken === "string" ? listed.data.nextPageToken : "";
  } while (pageToken);
  cache.loaded = true;
}

export async function findExistingGoogleContact(
  token: string,
  rec: Pick<IrissPasutijumsRecord, "phone" | "email">,
  cache: GoogleContactDirectoryCache,
): Promise<string | null> {
  if (!orderHasMatchableGoogleContact(rec)) return null;
  await loadDirectory(token, cache);
  return findResourceNameInGoogleContactIndex(cache, rec);
}

async function ensureLabel(token: string, cache?: GoogleContactDirectoryCache): Promise<string | null> {
  if (cache && cache.groupResourceName) return cache.groupResourceName;
  const listed = await peopleJson(token, "/contactGroups?pageSize=200");
  const groups = Array.isArray(listed.data.contactGroups) ? listed.data.contactGroups : [];
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const row = g as { name?: string; resourceName?: string; formattedName?: string };
    if (row.formattedName === GOOGLE_CONTACTS_LABEL || row.name === GOOGLE_CONTACTS_LABEL) {
      const name = typeof row.resourceName === "string" ? row.resourceName : null;
      if (cache) cache.groupResourceName = name;
      return name;
    }
  }
  const created = await peopleJson(token, "/contactGroups", {
    method: "POST",
    body: JSON.stringify({ contactGroup: { name: GOOGLE_CONTACTS_LABEL } }),
  });
  const group = created.data.resourceName;
  const name = typeof group === "string" ? group : null;
  if (cache) cache.groupResourceName = name;
  return name;
}

async function addToGroup(token: string, groupResource: string, resourceName: string): Promise<void> {
  await peopleJson(token, `/${groupResource}/members:modify`, {
    method: "POST",
    body: JSON.stringify({ resourceNamesToAdd: [resourceName] }),
  });
}

async function labelContact(
  token: string,
  resourceName: string,
  cache?: GoogleContactDirectoryCache,
): Promise<void> {
  const group = await ensureLabel(token, cache);
  if (group) await addToGroup(token, group, resourceName);
}

async function createLabeledContact(
  token: string,
  rec: ContactRec,
  cache: GoogleContactDirectoryCache,
): Promise<GoogleContactSyncResult> {
  const created = await peopleJson(token, "/people:createContact", {
    method: "POST",
    body: JSON.stringify(contactBody(rec)),
  });
  const name = created.data.resourceName;
  if (!created.ok || typeof name !== "string" || !name) {
    return { status: "error", error: `create_${created.status}` };
  }
  rememberContact(cache, name, rec);
  await labelContact(token, name, cache);
  return { status: "saved", resourceName: name, linked: "created" };
}

async function resolveToken(ctx?: GoogleContactLinkContext): Promise<{ token: string } | GoogleContactSyncResult> {
  if (ctx?.token?.trim()) return { token: ctx.token.trim() };
  const cfg = readGoogleContactsConfig();
  if (!cfg) return { status: "unconfigured" };
  return { token: await accessToken(cfg) };
}

/**
 * Link an IRISS order to Google Contacts without patching names/phones/emails.
 * Existing match: only add the IRISS klients group. Otherwise createContact + label.
 */
export async function linkGoogleContactForOrder(
  rec: ContactRec,
  ctx: GoogleContactLinkContext = {},
): Promise<GoogleContactSyncResult> {
  if (!orderHasMatchableGoogleContact(rec)) return { status: "skipped" };
  try {
    const resolved = await resolveToken(ctx);
    if ("status" in resolved) return resolved;
    const token = resolved.token;
    const cache = ctx.cache ?? emptyGoogleContactDirectoryCache();
    const stored = rec.googleContactResourceName?.trim() || "";
    if (stored) {
      await labelContact(token, stored, cache);
      rememberContact(cache, stored, rec);
      return { status: "saved", resourceName: stored, linked: "matched" };
    }
    const existing = await findExistingGoogleContact(token, rec, cache);
    if (existing) {
      await labelContact(token, existing, cache);
      rememberContact(cache, existing, rec);
      return { status: "saved", resourceName: existing, linked: "matched" };
    }
    return await createLabeledContact(token, rec, cache);
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message.slice(0, 180) : "sync_failed" };
  }
}

export async function upsertGoogleContactForOrder(rec: ContactRec): Promise<GoogleContactSyncResult> {
  const cfg = readGoogleContactsConfig();
  if (!cfg) return { status: "unconfigured" };
  if (!orderHasMatchableGoogleContact(rec)) return { status: "skipped" };
  try {
    const token = await accessToken(cfg);
    const cache = emptyGoogleContactDirectoryCache();
    let resourceName = rec.googleContactResourceName?.trim() || "";
    if (resourceName) {
      const current = await peopleJson(token, `/${resourceName}?personFields=names,emailAddresses,phoneNumbers`);
      if (current.ok) {
        await labelContact(token, resourceName, cache);
        rememberContact(cache, resourceName, rec);
        return { status: "saved", resourceName, linked: "matched" };
      }
      resourceName = (await findExistingGoogleContact(token, rec, cache)) || "";
      if (resourceName) {
        await labelContact(token, resourceName, cache);
        rememberContact(cache, resourceName, rec);
        return { status: "saved", resourceName, linked: "matched" };
      }
      return await createLabeledContact(token, rec, cache);
    }
    return await linkGoogleContactForOrder(rec, { token, cache });
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message.slice(0, 180) : "sync_failed" };
  }
}

export function googleContactsAuthorizeUrl(redirectUri: string, state: string): string | null {
  const client = googleContactsOAuthClient();
  if (!client) return null;
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", client.clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", CONTACTS_SCOPE);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeGoogleContactsCode(
  code: string,
  redirectUri: string,
): Promise<{ refreshToken?: string; error?: string }> {
  const client = googleContactsOAuthClient();
  if (!client) return { error: "Nav GOOGLE_CONTACTS_CLIENT_ID / SECRET." };
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok) return { error: data.error_description || data.error || `http_${res.status}` };
  if (!data.refresh_token) {
    return { error: "Google neatdeva refresh token. Atkārtoti autorizējiet ar prompt=consent." };
  }
  return { refreshToken: data.refresh_token };
}
