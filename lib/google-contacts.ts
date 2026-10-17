import "server-only";

import { orderHasClientContact } from "@/lib/iriss-google-contact-fields";
import type { IrissGoogleContactStatus, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export { orderHasClientContact } from "@/lib/iriss-google-contact-fields";

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
};

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

async function ensureLabel(token: string): Promise<string | null> {
  const listed = await peopleJson(token, "/contactGroups?pageSize=200");
  const groups = Array.isArray(listed.data.contactGroups) ? listed.data.contactGroups : [];
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const row = g as { name?: string; resourceName?: string; formattedName?: string };
    if (row.formattedName === GOOGLE_CONTACTS_LABEL || row.name === GOOGLE_CONTACTS_LABEL) {
      return typeof row.resourceName === "string" ? row.resourceName : null;
    }
  }
  const created = await peopleJson(token, "/contactGroups", {
    method: "POST",
    body: JSON.stringify({ contactGroup: { name: GOOGLE_CONTACTS_LABEL } }),
  });
  const group = created.data.resourceName;
  return typeof group === "string" ? group : null;
}

async function addToGroup(token: string, groupResource: string, resourceName: string): Promise<void> {
  await peopleJson(token, `/${groupResource}/members:modify`, {
    method: "POST",
    body: JSON.stringify({ resourceNamesToAdd: [resourceName] }),
  });
}

export async function upsertGoogleContactForOrder(
  rec: Pick<IrissPasutijumsRecord, "clientFirstName" | "clientLastName" | "phone" | "email" | "googleContactResourceName">,
): Promise<GoogleContactSyncResult> {
  const cfg = readGoogleContactsConfig();
  if (!cfg) return { status: "unconfigured" };
  if (!orderHasClientContact(rec)) return { status: "unconfigured" };
  try {
    const token = await accessToken(cfg);
    const body = contactBody(rec);
    let resourceName = rec.googleContactResourceName?.trim() || "";
    if (resourceName) {
      const current = await peopleJson(token, `/${resourceName}?personFields=names,emailAddresses,phoneNumbers`);
      const etag = typeof current.data.etag === "string" ? current.data.etag : "";
      const patched = await peopleJson(
        token,
        `/${resourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers`,
        { method: "PATCH", body: JSON.stringify({ ...body, resourceName, ...(etag ? { etag } : {}) }) },
      );
      if (!patched.ok) {
        resourceName = "";
      }
    }
    if (!resourceName) {
      const created = await peopleJson(token, "/people:createContact", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const name = created.data.resourceName;
      if (!created.ok || typeof name !== "string" || !name) {
        return { status: "error", error: `create_${created.status}` };
      }
      resourceName = name;
    }
    const group = await ensureLabel(token);
    if (group) await addToGroup(token, group, resourceName);
    return { status: "saved", resourceName };
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
  const data = (await res.json().catch(() => ({}))) as { refresh_token?: string; error?: string; error_description?: string };
  if (!res.ok) return { error: data.error_description || data.error || `http_${res.status}` };
  if (!data.refresh_token) {
    return { error: "Google neatdeva refresh token. Atkārtoti autorizējiet ar prompt=consent." };
  }
  return { refreshToken: data.refresh_token };
}
