/**
 * First-party ad attribution (UTM + click IDs) after analytics consent.
 * Compact Stripe metadata for NEW checkout sessions only.
 */

export const AD_CHANNELS = ["google", "meta", "tiktok", "organic_google", "direct", "other"] as const;
export type AdChannel = (typeof AD_CHANNELS)[number];

/** Paid spend form: no organic / direct rows. */
export const AD_PAID_CHANNELS = ["google", "meta", "tiktok", "other"] as const;
export type AdPaidChannel = (typeof AD_PAID_CHANNELS)[number];

export const AD_CHANNEL_LABELS_LV: Record<AdChannel, string> = {
  google: "Google Ads",
  meta: "Meta",
  tiktok: "TikTok",
  organic_google: "Organiskā Google meklēšana",
  direct: "Tiešie / bez avota",
  other: "Citi",
};

export function isAdPaidChannel(value: unknown): value is AdPaidChannel {
  return typeof value === "string" && (AD_PAID_CHANNELS as readonly string[]).includes(value);
}

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "ttclid"] as const;

const CLIP = {
  clickId: 128,
  utm: 80,
  landing: 500,
  referrer: 160,
} as const;

/** Stripe Checkout metadata value limit. */
export const STRIPE_ATTR_METADATA_MAX = 500;

export const STRIPE_ATTR_LAND_FIRST_KEY = "attr_land_first";
export const STRIPE_ATTR_LAND_LAST_KEY = "attr_land_last";
export const STRIPE_ATTR_FBCLID_KEY = "attr_fbclid";
export const STRIPE_ATTR_GCLID_KEY = "attr_gclid";
export const STRIPE_ATTR_TTCLID_KEY = "attr_ttclid";

export type AdTouch = {
  src?: string;
  med?: string;
  cmp?: string;
  term?: string;
  cnt?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  ttclid?: string;
  land?: string;
  ref?: string;
};

export type AdAttributionCookie = {
  v: 1;
  first: AdTouch;
  last: AdTouch;
  consentAt: string;
};

export type AdminOrderAttribution = {
  channel: AdChannel | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  source: string | null;
  medium: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  ttclid: string | null;
  landing: string | null;
  firstLanding: string | null;
  lastLanding: string | null;
};

export function isAdChannel(value: unknown): value is AdChannel {
  return typeof value === "string" && (AD_CHANNELS as readonly string[]).includes(value);
}

function clip(value: string | null | undefined, max: number): string | undefined {
  const t = value?.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function setIf(target: AdTouch, key: keyof AdTouch, value: string | undefined): void {
  if (value) target[key] = value;
}

export function parseVisitFromSearch(args: {
  pathname?: string | null;
  search?: string | null;
  referrer?: string | null;
}): AdTouch {
  const path = (args.pathname ?? "").trim() || "/";
  const searchRaw = args.search ?? "";
  const search = searchRaw.startsWith("?") ? searchRaw.slice(1) : searchRaw;
  const params = new URLSearchParams(search);
  const touch: AdTouch = {};
  setIf(touch, "src", clip(params.get("utm_source"), CLIP.utm));
  setIf(touch, "med", clip(params.get("utm_medium"), CLIP.utm));
  setIf(touch, "cmp", clip(params.get("utm_campaign"), CLIP.utm));
  setIf(touch, "term", clip(params.get("utm_term"), CLIP.utm));
  setIf(touch, "cnt", clip(params.get("utm_content"), CLIP.utm));
  for (const key of CLICK_ID_KEYS) {
    setIf(touch, key, clip(params.get(key), CLIP.clickId));
  }
  const qs = search ? `?${search}` : "";
  setIf(touch, "land", clip(`${path}${qs}`, CLIP.landing));
  setIf(touch, "ref", clip(args.referrer ?? "", CLIP.referrer));
  return touch;
}

export function touchHasMarketingSignal(touch: AdTouch | null | undefined): boolean {
  if (!touch) return false;
  return Boolean(
    touch.src ||
      touch.med ||
      touch.cmp ||
      touch.term ||
      touch.cnt ||
      touch.gclid ||
      touch.gbraid ||
      touch.wbraid ||
      touch.fbclid ||
      touch.ttclid,
  );
}

export function touchHasAnyField(touch: AdTouch | null | undefined): boolean {
  if (!touch) return false;
  return Object.values(touch).some((v) => typeof v === "string" && v.trim());
}

function sourceLooksLike(value: string | undefined, needles: readonly string[]): boolean {
  if (!value) return false;
  const s = value.trim().toLowerCase();
  return needles.some((n) => s === n || s.includes(n));
}

const PAID_MEDIUMS = ["cpc", "ppc", "paid", "paid-social", "paidsocial", "display", "cpm"];

function isPaidMedium(medium: string | undefined): boolean {
  if (!medium) return false;
  const m = medium.trim().toLowerCase();
  return PAID_MEDIUMS.includes(m) || m.includes("paid") || m === "cpc" || m === "ppc";
}

function isOwnReferrer(ref: string | undefined): boolean {
  if (!ref?.trim()) return true;
  try {
    const host = new URL(ref).hostname.toLowerCase();
    return host === "provin.lv" || host.endsWith(".provin.lv") || host === "localhost";
  } catch {
    return false;
  }
}

export function inferChannel(touch: AdTouch | null | undefined): AdChannel | null {
  if (!touch) return null;
  if (touch.gclid || touch.gbraid || touch.wbraid) return "google";
  if (touch.fbclid) return "meta";
  if (touch.ttclid) return "tiktok";
  const paid = isPaidMedium(touch.med);
  if (sourceLooksLike(touch.src, ["adwords", "googleads"])) return "google";
  if (sourceLooksLike(touch.src, ["google", "youtube"])) return paid ? "google" : "organic_google";
  if (sourceLooksLike(touch.src, ["facebook", "fb", "instagram", "ig", "meta"])) return "meta";
  if (sourceLooksLike(touch.src, ["tiktok"])) return "tiktok";
  if (sourceLooksLike(touch.ref, ["google.", "youtube."])) return paid ? "google" : "organic_google";
  if (sourceLooksLike(touch.ref, ["facebook.", "instagram.", "fb.com"])) return "meta";
  if (sourceLooksLike(touch.ref, ["tiktok."])) return "tiktok";
  if (touchHasMarketingSignal(touch)) return "other";
  if (isOwnReferrer(touch.ref)) return "direct";
  return "other";
}

/** Last-touch updates on ads, UTM, or a new external/organic landing. Not on in-site clicks. */
export function touchShouldUpdateLast(touch: AdTouch | null | undefined): boolean {
  if (!touch) return false;
  if (touchHasMarketingSignal(touch)) return true;
  const ch = inferChannel(touch);
  return ch === "organic_google" || ch === "google" || ch === "meta" || ch === "tiktok" || ch === "other";
}

function slimTouch(touch: AdTouch): AdTouch {
  const next: AdTouch = {};
  setIf(next, "src", touch.src);
  setIf(next, "med", touch.med);
  setIf(next, "cmp", touch.cmp);
  setIf(next, "term", touch.term);
  setIf(next, "cnt", touch.cnt);
  setIf(next, "gclid", touch.gclid);
  setIf(next, "gbraid", touch.gbraid);
  setIf(next, "wbraid", touch.wbraid);
  setIf(next, "fbclid", touch.fbclid);
  setIf(next, "ttclid", touch.ttclid);
  return next;
}

function omitLand(touch: AdTouch): AdTouch {
  const next = { ...touch };
  delete next.land;
  return next;
}

function omitSplitClickIds(touch: AdTouch): AdTouch {
  const next = { ...touch };
  delete next.gclid;
  delete next.fbclid;
  delete next.ttclid;
  return next;
}

export function mergeAttributionCookie(args: {
  existing: AdAttributionCookie | null;
  pending: AdTouch | null;
  visit: AdTouch;
  consentAt: string;
}): AdAttributionCookie {
  const first =
    args.existing && touchHasAnyField(args.existing.first)
      ? args.existing.first
      : touchHasAnyField(args.pending)
        ? args.pending!
        : args.visit;
  const last = touchShouldUpdateLast(args.visit)
    ? args.visit
    : args.existing && touchHasAnyField(args.existing.last)
      ? args.existing.last
      : first;
  return {
    v: 1,
    first,
    last,
    consentAt: args.existing?.consentAt || args.consentAt,
  };
}

function parseTouch(raw: unknown): AdTouch {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const touch: AdTouch = {};
  const take = (key: keyof AdTouch, max: number) => {
    setIf(touch, key, clip(typeof o[key] === "string" ? o[key] : "", max));
  };
  take("src", CLIP.utm);
  take("med", CLIP.utm);
  take("cmp", CLIP.utm);
  take("term", CLIP.utm);
  take("cnt", CLIP.utm);
  take("gclid", CLIP.clickId);
  take("gbraid", CLIP.clickId);
  take("wbraid", CLIP.clickId);
  take("fbclid", CLIP.clickId);
  take("ttclid", CLIP.clickId);
  take("land", CLIP.landing);
  take("ref", CLIP.referrer);
  return touch;
}

export function parsePendingAttr(raw: string | null): AdTouch | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    if (rec.v === 1 || rec.src || rec.gclid || rec.land) {
      const touch = parseTouch(o);
      return touchHasAnyField(touch) ? touch : null;
    }
    if (typeof rec.path === "string" || rec.utm) {
      const utm = rec.utm && typeof rec.utm === "object" ? (rec.utm as Record<string, string>) : {};
      const path = typeof rec.path === "string" ? rec.path : "";
      const q = new URLSearchParams();
      for (const key of UTM_KEYS) {
        const v = utm[key];
        if (v) q.set(key, v);
      }
      const [pathname, search = ""] = path.split("?");
      const fromPath = parseVisitFromSearch({
        pathname: pathname || "/",
        search: search ? `?${search}` : q.toString() ? `?${q.toString()}` : "",
        referrer: null,
      });
      return touchHasAnyField(fromPath) ? fromPath : null;
    }
    return null;
  } catch {
    return null;
  }
}

function fromLegacyCookie(raw: Record<string, unknown>): AdAttributionCookie | null {
  const landing = typeof raw.firstLanding === "string" ? raw.firstLanding : "";
  const referrer = typeof raw.referrer === "string" ? raw.referrer : "";
  const utm = raw.utm && typeof raw.utm === "object" ? (raw.utm as Record<string, string>) : {};
  const [pathname, search = ""] = landing.split("?");
  const q = new URLSearchParams(search);
  for (const key of UTM_KEYS) {
    if (utm[key] && !q.get(key)) q.set(key, utm[key]);
  }
  const touch = parseVisitFromSearch({
    pathname: pathname || "/",
    search: q.toString() ? `?${q.toString()}` : "",
    referrer,
  });
  if (!touchHasAnyField(touch)) return null;
  const consentAt = typeof raw.consentAt === "string" && raw.consentAt.trim() ? raw.consentAt : new Date().toISOString();
  return { v: 1, first: touch, last: touch, consentAt };
}

export function parseAttrCookieValue(raw: string | null | undefined): AdAttributionCookie | null {
  if (!raw?.trim()) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const o = JSON.parse(decoded) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    if (rec.v === 1) {
      const first = parseTouch(rec.first);
      const last = parseTouch(rec.last);
      const consentAt =
        typeof rec.consentAt === "string" && rec.consentAt.trim() ? rec.consentAt : new Date().toISOString();
      if (!touchHasAnyField(first) && !touchHasAnyField(last)) return null;
      return { v: 1, first, last, consentAt };
    }
    return fromLegacyCookie(rec);
  } catch {
    return null;
  }
}

export function encodeAttrCookieValue(payload: AdAttributionCookie): string {
  return encodeURIComponent(JSON.stringify(payload));
}

export function readCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    return part.slice(idx + 1).trim();
  }
  return null;
}

function packAttrJson(ch: AdChannel | null, last: AdTouch, first: AdTouch | undefined): string {
  return first ? JSON.stringify({ v: 1, ch, last, first }) : JSON.stringify({ v: 1, ch, last });
}

function putExtra(target: Record<string, string>, key: string, value: string | null | undefined): void {
  const clipped = clip(value, STRIPE_ATTR_METADATA_MAX);
  if (clipped) target[key] = clipped;
}

function pickStr(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function buildStripeAttributionParts(cookie: AdAttributionCookie): {
  attr: string;
  extras: Record<string, string>;
} {
  const extras: Record<string, string> = {};
  putExtra(extras, STRIPE_ATTR_LAND_FIRST_KEY, cookie.first.land);
  putExtra(extras, STRIPE_ATTR_LAND_LAST_KEY, cookie.last.land);

  const ch = inferChannel(cookie.last) ?? inferChannel(cookie.first);
  let last = omitLand(cookie.last);
  let first = omitLand(cookie.first);
  let attr = packAttrJson(ch, last, first);
  if (attr.length > STRIPE_ATTR_METADATA_MAX) {
    last = slimTouch(last);
    first = slimTouch(first);
    attr = packAttrJson(ch, last, first);
  }
  if (attr.length > STRIPE_ATTR_METADATA_MAX) {
    putExtra(extras, STRIPE_ATTR_FBCLID_KEY, pickStr(last.fbclid, first.fbclid));
    putExtra(extras, STRIPE_ATTR_GCLID_KEY, pickStr(last.gclid, first.gclid));
    putExtra(extras, STRIPE_ATTR_TTCLID_KEY, pickStr(last.ttclid, first.ttclid));
    last = omitSplitClickIds(last);
    first = omitSplitClickIds(first);
    attr = packAttrJson(ch, last, first);
  }
  if (attr.length > STRIPE_ATTR_METADATA_MAX) {
    attr = packAttrJson(ch, slimTouch(omitSplitClickIds(last)), undefined);
  }
  if (attr.length > STRIPE_ATTR_METADATA_MAX) {
    attr = attr.slice(0, STRIPE_ATTR_METADATA_MAX);
  }
  return { attr, extras };
}

export function serializeStripeAttr(cookie: AdAttributionCookie): string {
  return buildStripeAttributionParts(cookie).attr;
}

export function stripeAttributionMetadata(cookie: AdAttributionCookie | null): Record<string, string> {
  if (!cookie) return {};
  if (!touchHasAnyField(cookie.first) && !touchHasAnyField(cookie.last)) return {};
  const { attr, extras } = buildStripeAttributionParts(cookie);
  return { attr, ...extras };
}

export function stripeAttributionMetadataFromRequest(
  cookieHeader: string | null | undefined,
  cookieName: string,
): Record<string, string> {
  const raw = readCookieValue(cookieHeader ?? null, cookieName);
  return stripeAttributionMetadata(parseAttrCookieValue(raw));
}

export function adminAttributionFromStripeMetadata(
  metadata: Record<string, string> | null | undefined,
): AdminOrderAttribution | null {
  const raw = metadata?.attr?.trim();
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const last = parseTouch(o.last);
    const first = parseTouch(o.first);
    const channel = isAdChannel(o.ch) ? o.ch : inferChannel(last) ?? inferChannel(first);
    const lastLanding = pickStr(metadata[STRIPE_ATTR_LAND_LAST_KEY], last.land);
    const firstLanding = pickStr(metadata[STRIPE_ATTR_LAND_FIRST_KEY], first.land, lastLanding);
    const campaign = pickStr(last.cmp, first.cmp);
    const term = pickStr(last.term, first.term);
    const content = pickStr(last.cnt, first.cnt);
    const source = pickStr(last.src, first.src);
    const medium = pickStr(last.med, first.med);
    return {
      channel,
      campaign,
      term,
      content,
      source,
      medium,
      gclid: pickStr(metadata[STRIPE_ATTR_GCLID_KEY], last.gclid, first.gclid),
      gbraid: pickStr(last.gbraid, first.gbraid),
      wbraid: pickStr(last.wbraid, first.wbraid),
      fbclid: pickStr(metadata[STRIPE_ATTR_FBCLID_KEY], last.fbclid, first.fbclid),
      ttclid: pickStr(metadata[STRIPE_ATTR_TTCLID_KEY], last.ttclid, first.ttclid),
      landing: lastLanding ?? firstLanding,
      firstLanding,
      lastLanding,
    };
  } catch {
    return null;
  }
}

export function parseAdminOrderAttribution(raw: unknown): AdminOrderAttribution | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (k: string): string | null =>
    typeof o[k] === "string" && o[k].trim() ? (o[k] as string).trim() : null;
  const channel = isAdChannel(o.channel) ? o.channel : null;
  const campaign = str("campaign");
  const term = str("term");
  const content = str("content");
  const gclid = str("gclid");
  const fbclid = str("fbclid");
  const ttclid = str("ttclid");
  const gbraid = str("gbraid");
  const wbraid = str("wbraid");
  const landing = str("landing");
  const firstLanding = str("firstLanding") ?? landing;
  const lastLanding = str("lastLanding") ?? landing;
  if (
    !channel &&
    !campaign &&
    !term &&
    !content &&
    !gclid &&
    !fbclid &&
    !ttclid &&
    !gbraid &&
    !wbraid &&
    !landing &&
    !firstLanding
  ) {
    return null;
  }
  return {
    channel,
    campaign,
    term,
    content,
    source: str("source"),
    medium: str("medium"),
    gclid,
    gbraid,
    wbraid,
    fbclid,
    ttclid,
    landing,
    firstLanding,
    lastLanding,
  };
}

export function orderHasAdAttribution(attr: AdminOrderAttribution | null | undefined): boolean {
  if (!attr) return false;
  return Boolean(
    attr.channel ||
      attr.campaign ||
      attr.term ||
      attr.content ||
      attr.gclid ||
      attr.gbraid ||
      attr.wbraid ||
      attr.fbclid ||
      attr.ttclid,
  );
}
