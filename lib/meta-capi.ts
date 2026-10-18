/**
 * Meta Conversions API (server). Failures never throw to checkout / webhook callers.
 * Graph API v21+ POST /{pixel_id}/events. Missing env = no-op.
 */

import { createHash } from "node:crypto";
import { ATTR_COOKIE_NAME, CONSENT_COOKIE_NAME, isConsentCookieGranted } from "@/lib/cookie-consent";
import {
  parseAttrCookieValue,
  readCookieValue,
  STRIPE_ATTR_FBCLID_KEY,
  STRIPE_ATTR_METADATA_MAX,
} from "@/lib/ad-attribution";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkoutAmountCentsToEur } from "@/lib/google-ads";
import { getMetaPixelId } from "@/lib/meta-pixel";
import { getPublicSiteOrigin } from "@/lib/site-url";

export const META_CAPI_GRAPH_VERSION = "v21.0";
export const META_CAPI_TIMEOUT_MS = 4_000;

export const STRIPE_META_PACK_KEY = "meta";
export const STRIPE_META_UA_KEY = "meta_ua";
export const STRIPE_META_IP_KEY = "meta_ip";
export const STRIPE_META_FBP_KEY = "meta_fbp";
export const STRIPE_META_FBC_KEY = "meta_fbc";
export const STRIPE_META_CONSENT_KEY = "meta_c";

const CLIP = {
  fbp: 200,
  fbc: 200,
  ip: 64,
  ua: STRIPE_ATTR_METADATA_MAX,
} as const;

export type MetaCapiEventName = "Purchase" | "InitiateCheckout";

export type MetaCapiUserDataInput = {
  email?: string | null;
  phone?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

export type MetaCapiUserData = {
  em?: string[];
  ph?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
};

export type MetaCapiEvent = {
  event_name: MetaCapiEventName;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: MetaCapiUserData;
  custom_data: {
    currency: "EUR";
    value: number;
  };
};

export type MetaCapiRequestBody = {
  data: MetaCapiEvent[];
  test_event_code?: string;
};

export function parseMetaCapiAccessToken(raw?: string | null): string | null {
  const token = raw?.trim();
  if (!token) return null;
  if (token.length < 16 || token.length > 512) return null;
  if (/\s/.test(token)) return null;
  return token;
}

export function getMetaCapiAccessToken(raw = process.env.META_CAPI_ACCESS_TOKEN): string | null {
  return parseMetaCapiAccessToken(raw);
}

export function parseMetaCapiTestEventCode(raw?: string | null): string | null {
  const code = raw?.trim();
  if (!code) return null;
  if (!/^[A-Za-z0-9_]{4,64}$/.test(code)) return null;
  return code;
}

export function getMetaCapiTestEventCode(raw = process.env.META_CAPI_TEST_EVENT_CODE): string | null {
  return parseMetaCapiTestEventCode(raw);
}

export function isMetaCapiConfigured(args?: {
  pixelId?: string | null;
  accessToken?: string | null;
}): boolean {
  const pixelId = args?.pixelId === undefined ? getMetaPixelId() : args.pixelId;
  const accessToken = args?.accessToken === undefined ? getMetaCapiAccessToken() : args.accessToken;
  return Boolean(pixelId && accessToken);
}

export function shouldSendMetaCapi(args: {
  pixelId?: string | null;
  accessToken?: string | null;
  consentGranted: boolean;
}): boolean {
  if (!args.consentGranted) return false;
  return isMetaCapiConfigured({ pixelId: args.pixelId, accessToken: args.accessToken });
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeMetaEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 254) return null;
  return email;
}

/** E.164 digits without '+'. Latvian 8-digit mobiles/landlines get 371. */
export function normalizeMetaPhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("371") && digits.length >= 11) return digits.slice(0, 15);
  if (digits.length === 8 && /^[26]/.test(digits)) return `371${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function hashMetaEmail(raw: string | null | undefined): string | null {
  const email = normalizeMetaEmail(raw);
  return email ? sha256Hex(email) : null;
}

export function hashMetaPhone(raw: string | null | undefined): string | null {
  const phone = normalizeMetaPhone(raw);
  return phone ? sha256Hex(phone) : null;
}

export function buildMetaCapiUserData(input: MetaCapiUserDataInput): MetaCapiUserData {
  const out: MetaCapiUserData = {};
  const em = hashMetaEmail(input.email);
  const ph = hashMetaPhone(input.phone);
  if (em) out.em = [em];
  if (ph) out.ph = [ph];
  const ip = input.clientIp?.trim();
  if (ip && ip !== "unknown") out.client_ip_address = ip.slice(0, CLIP.ip);
  const ua = input.clientUserAgent?.trim();
  if (ua) out.client_user_agent = ua.slice(0, 512);
  const fbp = normalizeFbp(input.fbp);
  if (fbp) out.fbp = fbp;
  const fbc = input.fbc?.trim();
  if (fbc) out.fbc = fbc.slice(0, CLIP.fbc);
  return out;
}

export function normalizeFbp(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (!/^fb\.1\.\d+\.\d+$/.test(v)) return v.startsWith("fb.") ? v.slice(0, CLIP.fbp) : null;
  return v.slice(0, CLIP.fbp);
}

export function deriveMetaFbc(args: {
  fbcCookie?: string | null;
  fbclid?: string | null;
  nowMs?: number;
}): string | null {
  const existing = args.fbcCookie?.trim();
  if (existing && existing.startsWith("fb.")) return existing.slice(0, CLIP.fbc);
  const fbclid = args.fbclid?.trim();
  if (!fbclid) return null;
  const ts = Math.floor((args.nowMs ?? Date.now()) / 1000);
  return `fb.1.${ts}.${fbclid}`.slice(0, CLIP.fbc);
}

export function buildMetaCapiEvent(args: {
  eventName: MetaCapiEventName;
  eventId: string;
  value: number;
  eventSourceUrl: string;
  userData: MetaCapiUserDataInput;
  eventTime?: number;
}): MetaCapiEvent | null {
  const eventId = args.eventId.trim();
  if (!eventId) return null;
  if (!Number.isFinite(args.value) || args.value <= 0) return null;
  const url = args.eventSourceUrl.trim();
  if (!url) return null;
  return {
    event_name: args.eventName,
    event_time: args.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: url.slice(0, 2048),
    action_source: "website",
    user_data: buildMetaCapiUserData(args.userData),
    custom_data: {
      currency: "EUR",
      value: args.value,
    },
  };
}

export function buildMetaCapiRequestBody(args: {
  events: MetaCapiEvent[];
  testEventCode?: string | null;
}): MetaCapiRequestBody | null {
  if (args.events.length === 0) return null;
  const body: MetaCapiRequestBody = { data: args.events };
  const test = parseMetaCapiTestEventCode(args.testEventCode);
  if (test) body.test_event_code = test;
  return body;
}

export function metaCapiEventsUrl(pixelId: string, graphVersion = META_CAPI_GRAPH_VERSION): string {
  return `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pixelId)}/events`;
}

export type MetaCapiContext = {
  consent: boolean;
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  ua: string | null;
};

function clip(value: string | null | undefined, max: number): string | undefined {
  const t = value?.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function fbclidFromAttrCookie(cookieHeader: string | null | undefined): string | null {
  const raw = readCookieValue(cookieHeader, ATTR_COOKIE_NAME);
  const parsed = parseAttrCookieValue(raw);
  return parsed?.last.fbclid ?? parsed?.first.fbclid ?? null;
}

export function collectMetaCapiContextFromRequest(req: Request): MetaCapiContext {
  const cookieHeader = req.headers.get("cookie");
  const consentCookie = readCookieValue(cookieHeader, CONSENT_COOKIE_NAME);
  const attrPresent = Boolean(readCookieValue(cookieHeader, ATTR_COOKIE_NAME));
  const consent = isConsentCookieGranted(consentCookie) || attrPresent;
  const fbp = normalizeFbp(readCookieValue(cookieHeader, "_fbp"));
  const fbc = deriveMetaFbc({
    fbcCookie: readCookieValue(cookieHeader, "_fbc"),
    fbclid: fbclidFromAttrCookie(cookieHeader),
  });
  const ip = getClientIpFromRequest(req);
  const ua = req.headers.get("user-agent");
  return {
    consent,
    fbp,
    fbc,
    ip: ip && ip !== "unknown" ? ip : null,
    ua: ua?.trim() || null,
  };
}

export function buildStripeMetaCapiParts(ctx: MetaCapiContext): Record<string, string> {
  if (!ctx.consent) return {};
  const extras: Record<string, string> = { [STRIPE_META_CONSENT_KEY]: "1" };

  const fbp = clip(ctx.fbp, CLIP.fbp);
  const fbc = clip(ctx.fbc, CLIP.fbc);
  const ip = clip(ctx.ip, CLIP.ip);
  const ua = clip(ctx.ua, CLIP.ua);

  const pack: Record<string, string | number> = {};
  if (ctx.consent) pack.c = 1;
  if (fbp) pack.fbp = fbp;
  if (fbc) pack.fbc = fbc;
  if (ip) pack.ip = ip;

  let packed = JSON.stringify(pack);
  if (packed.length > STRIPE_ATTR_METADATA_MAX) {
    delete pack.ip;
    packed = JSON.stringify(pack);
    if (ip) extras[STRIPE_META_IP_KEY] = ip;
  }
  if (packed.length > STRIPE_ATTR_METADATA_MAX) {
    delete pack.fbp;
    delete pack.fbc;
    packed = JSON.stringify(pack);
    if (fbp) extras[STRIPE_META_FBP_KEY] = fbp;
    if (fbc) extras[STRIPE_META_FBC_KEY] = fbc;
  }
  extras[STRIPE_META_PACK_KEY] = packed.slice(0, STRIPE_ATTR_METADATA_MAX);
  if (ua) extras[STRIPE_META_UA_KEY] = ua;
  return extras;
}

export function stripeMetaCapiMetadataFromRequest(req: Request): Record<string, string> {
  return buildStripeMetaCapiParts(collectMetaCapiContextFromRequest(req));
}

export function metaCapiContextFromStripeMetadata(
  metadata: Record<string, string> | null | undefined,
): MetaCapiContext {
  const meta = metadata ?? {};
  let pack: Record<string, unknown> = {};
  if (meta[STRIPE_META_PACK_KEY]?.trim()) {
    try {
      const parsed = JSON.parse(meta[STRIPE_META_PACK_KEY]) as unknown;
      if (parsed && typeof parsed === "object") pack = parsed as Record<string, unknown>;
    } catch {
      pack = {};
    }
  }
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const consent =
    meta[STRIPE_META_CONSENT_KEY] === "1" || pack.c === 1 || pack.c === true || pack.c === "1";
  const fbp = normalizeFbp(meta[STRIPE_META_FBP_KEY] ?? str(pack.fbp));
  const fbc = deriveMetaFbc({
    fbcCookie: meta[STRIPE_META_FBC_KEY] ?? str(pack.fbc),
    fbclid: meta[STRIPE_ATTR_FBCLID_KEY] ?? null,
  });
  return {
    consent,
    fbp,
    fbc,
    ip: meta[STRIPE_META_IP_KEY]?.trim() || str(pack.ip),
    ua: meta[STRIPE_META_UA_KEY]?.trim() || null,
  };
}

export function resolveMetaEventSourceUrl(req: Request): string {
  const origin = getPublicSiteOrigin();
  const referer = req.headers.get("referer") ?? req.headers.get("referrer");
  if (referer) {
    try {
      const u = new URL(referer);
      const host = u.hostname.toLowerCase();
      if (
        host === "provin.lv" ||
        host.endsWith(".provin.lv") ||
        host === "localhost" ||
        host.endsWith(".vercel.app")
      ) {
        return u.toString().slice(0, 2048);
      }
    } catch {
      /* ignore */
    }
  }
  return origin;
}

export function resolveInitiateCheckoutValueEur(
  amountTotal: number | null | undefined,
  fallbackCents?: number | null,
): number | null {
  const cents =
    typeof amountTotal === "number" && amountTotal > 0
      ? amountTotal
      : typeof fallbackCents === "number" && fallbackCents > 0
        ? fallbackCents
        : null;
  if (cents == null) return null;
  return checkoutAmountCentsToEur(cents);
}

export function checkoutMetaClientFields(
  eventId: string,
  value: number | null,
): { eventId: string; value?: number } {
  return value != null ? { eventId, value } : { eventId };
}

export async function sendMetaCapiEvents(args: {
  events: MetaCapiEvent[];
  pixelId?: string | null;
  accessToken?: string | null;
  testEventCode?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; skipped?: string }> {
  const pixelId = args.pixelId === undefined ? getMetaPixelId() : args.pixelId;
  const accessToken = args.accessToken === undefined ? getMetaCapiAccessToken() : args.accessToken;
  if (!pixelId || !accessToken) return { ok: true, skipped: "env" };
  const body = buildMetaCapiRequestBody({
    events: args.events,
    testEventCode: args.testEventCode === undefined ? getMetaCapiTestEventCode() : args.testEventCode,
  });
  if (!body) return { ok: true, skipped: "empty" };
  const doFetch = args.fetchImpl ?? fetch;
  try {
    const res = await doFetch(metaCapiEventsUrl(pixelId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, access_token: accessToken }),
      signal: AbortSignal.timeout(META_CAPI_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn("[meta capi] Graph API", res.status);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[meta capi] send failed", err instanceof Error ? err.message : "error");
    return { ok: false };
  }
}

export async function notifyMetaCapiEvent(args: {
  eventName: MetaCapiEventName;
  eventId: string;
  value: number;
  eventSourceUrl: string;
  consentGranted: boolean;
  userData: MetaCapiUserDataInput;
}): Promise<void> {
  if (
    !shouldSendMetaCapi({
      consentGranted: args.consentGranted,
      pixelId: getMetaPixelId(),
      accessToken: getMetaCapiAccessToken(),
    })
  ) {
    return;
  }
  const event = buildMetaCapiEvent({
    eventName: args.eventName,
    eventId: args.eventId,
    value: args.value,
    eventSourceUrl: args.eventSourceUrl,
    userData: args.userData,
  });
  if (!event) return;
  await sendMetaCapiEvents({ events: [event] });
}

export async function notifyMetaInitiateCheckout(args: {
  req: Request;
  eventId: string;
  value: number | null;
  email?: string | null;
  phone?: string | null;
  context?: MetaCapiContext;
}): Promise<void> {
  try {
    const ctx = args.context ?? collectMetaCapiContextFromRequest(args.req);
    if (!ctx.consent || args.value == null) return;
    await notifyMetaCapiEvent({
      eventName: "InitiateCheckout",
      eventId: args.eventId,
      value: args.value,
      eventSourceUrl: resolveMetaEventSourceUrl(args.req),
      consentGranted: true,
      userData: {
        email: args.email,
        phone: args.phone,
        clientIp: ctx.ip,
        clientUserAgent: ctx.ua,
        fbp: ctx.fbp,
        fbc: ctx.fbc,
      },
    });
  } catch (err) {
    console.warn("[meta capi] InitiateCheckout", err instanceof Error ? err.message : "error");
  }
}

export function purchaseEventSourceUrl(sessionId: string): string {
  return `${getPublicSiteOrigin()}/lv/paldies?session_id=${encodeURIComponent(sessionId)}`;
}

export async function notifyMetaPurchaseFromStripeSession(session: {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null; phone?: string | null } | null;
  metadata?: Record<string, string> | null;
}): Promise<void> {
  try {
    if (session.payment_status !== "paid") return;
    const ctx = metaCapiContextFromStripeMetadata(session.metadata);
    if (!ctx.consent) return;
    const cents = typeof session.amount_total === "number" ? session.amount_total : null;
    const value = resolveInitiateCheckoutValueEur(cents);
    if (value == null) return;
    const email = session.customer_details?.email ?? session.customer_email ?? null;
    const phone = session.customer_details?.phone ?? session.metadata?.phone ?? null;
    await notifyMetaCapiEvent({
      eventName: "Purchase",
      eventId: session.id,
      value,
      eventSourceUrl: purchaseEventSourceUrl(session.id),
      consentGranted: true,
      userData: {
        email,
        phone,
        clientIp: ctx.ip,
        clientUserAgent: ctx.ua,
        fbp: ctx.fbp,
        fbc: ctx.fbc,
      },
    });
  } catch (err) {
    console.warn("[meta capi] Purchase", err instanceof Error ? err.message : "error");
  }
}
