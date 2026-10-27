/**
 * Meta Pixel (browser) - load and fire only after analytics consent.
 * No cookieless mode: missing pixel id or denied consent is a no-op.
 */

import { shouldEnablePublicSiteAnalytics } from "@/lib/analytics-public-scope";
import {
  CONSENT_STORAGE_KEY,
  parseConsent,
} from "@/lib/cookie-consent";
import { stripLocalePrefix } from "@/i18n/locales";

export type MetaStandardEvent =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "InitiateCheckout"
  | "Purchase";

export type MetaEventParams = Record<string, string | number | string[] | undefined>;

export type FbqFn = (...args: unknown[]) => void;

/** Home pricing hero (MINI / AUDITS / dīlera dati). */
export const META_VIEW_CONTENT_PRICING_PATH = "/" as const;
/** Services catalog - official dealer-data product lives here. */
export const META_VIEW_CONTENT_DEALER_PATH = "/pakalpojumi" as const;

export function parseMetaPixelId(raw?: string | null): string | null {
  const id = raw?.trim();
  if (!id || id === "0") return null;
  if (!/^\d{5,20}$/.test(id)) return null;
  return id;
}

/** Publisks Pixel ID. Tukšs / nederīgs = no-op (Vercel env pievienos vēlāk). */
export function getMetaPixelId(raw = process.env.NEXT_PUBLIC_META_PIXEL_ID): string | null {
  return parseMetaPixelId(raw);
}

export function readStoredAnalyticsConsent(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof window === "undefined" ? null : window.localStorage,
): boolean {
  if (!storage) return false;
  try {
    // Meta ir reklāmas kategorija (sīkdatņu joslas "Reklāma"); vecais ieraksts = analytics.
    return parseConsent(storage.getItem(CONSENT_STORAGE_KEY))?.ads === true;
  } catch {
    return false;
  }
}

export function shouldLoadMetaPixel(args: {
  pixelId: string | null | undefined;
  analyticsConsent: boolean;
  pathname?: string | null;
  hostname?: string | null;
}): boolean {
  if (!args.pixelId) return false;
  if (!args.analyticsConsent) return false;
  if (args.pathname != null && !shouldEnablePublicSiteAnalytics(args.pathname, args.hostname)) {
    return false;
  }
  return true;
}

export function shouldFireMetaBrowserEvent(args: {
  analyticsConsent: boolean;
  fbqReady: boolean;
}): boolean {
  return args.analyticsConsent && args.fbqReady;
}

export function getFbq(): FbqFn | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as unknown as { fbq?: FbqFn }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

export function applyMetaConsent(granted: boolean): void {
  const fbq = getFbq();
  if (!fbq) return;
  fbq("consent", granted ? "grant" : "revoke");
}

export function createMetaEventId(
  randomUuid: () => string = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallbackUuid(),
): string {
  const id = randomUuid().trim();
  return id || fallbackUuid();
}

function fallbackUuid(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type MetaViewContentPayload = {
  content_name: string;
  content_ids: string[];
  content_type: "product";
};

export function metaViewContentForPath(pathname: string): MetaViewContentPayload | null {
  const rest = stripLocalePrefix(pathname);
  if (rest === "/" || rest === "") {
    return {
      content_name: "pricing",
      content_ids: ["mini", "audits", "dealer"],
      content_type: "product",
    };
  }
  if (rest === META_VIEW_CONTENT_DEALER_PATH) {
    return {
      content_name: "dealer-data",
      content_ids: ["dealer"],
      content_type: "product",
    };
  }
  return null;
}

export function buildMetaPixelInitSnippet(pixelId: string): string {
  const id = parseMetaPixelId(pixelId);
  if (!id) return "";
  return (
    "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?" +
    "n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;" +
    "n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;" +
    "t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}" +
    "(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');" +
    "fbq('consent','grant');" +
    `fbq('init','${id}');`
  );
}

export function trackMetaStandardEvent(
  event: MetaStandardEvent,
  params: MetaEventParams | undefined,
  eventId: string,
  fbq: FbqFn | null = getFbq(),
  analyticsConsent = readStoredAnalyticsConsent(),
): boolean {
  if (!shouldFireMetaBrowserEvent({ analyticsConsent, fbqReady: Boolean(fbq) })) return false;
  if (!eventId.trim()) return false;
  const payload = params ? stripUndefined(params) : {};
  fbq!("track", event, payload, { eventID: eventId });
  return true;
}

function stripUndefined(params: MetaEventParams): Record<string, string | number | string[]> {
  const out: Record<string, string | number | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function trackMetaPageView(pathname: string, eventId = createMetaEventId()): boolean {
  return trackMetaStandardEvent("PageView", { page_path: stripLocalePrefix(pathname) }, eventId);
}

export function trackMetaViewContent(pathname: string, eventId = createMetaEventId()): boolean {
  const content = metaViewContentForPath(pathname);
  if (!content) return false;
  return trackMetaStandardEvent("ViewContent", content, eventId);
}

export function trackMetaRoute(pathname: string): boolean {
  const page = trackMetaPageView(pathname);
  trackMetaViewContent(pathname);
  return page;
}

export function trackMetaLead(eventId = createMetaEventId()): boolean {
  return trackMetaStandardEvent("Lead", { content_name: "vin" }, eventId);
}

export function trackMetaInitiateCheckout(args: {
  eventId: string;
  value: number;
  currency?: "EUR";
}): boolean {
  if (!Number.isFinite(args.value) || args.value <= 0) return false;
  return trackMetaStandardEvent(
    "InitiateCheckout",
    { value: args.value, currency: args.currency ?? "EUR" },
    args.eventId,
  );
}

export function trackMetaPurchase(args: {
  eventId: string;
  value: number;
  currency?: "EUR";
}): boolean {
  if (!Number.isFinite(args.value) || args.value <= 0) return false;
  if (!args.eventId.trim()) return false;
  return trackMetaStandardEvent(
    "Purchase",
    { value: args.value, currency: args.currency ?? "EUR" },
    args.eventId,
  );
}

/** After Stripe Checkout session is created: fire browser InitiateCheckout, then redirect. */
export function followStripeCheckoutUrl(data: {
  url?: string;
  eventId?: string;
  value?: number;
}): boolean {
  if (!data.url) return false;
  if (data.eventId && typeof data.value === "number") {
    trackMetaInitiateCheckout({ eventId: data.eventId, value: data.value });
  }
  window.location.href = data.url;
  return true;
}
