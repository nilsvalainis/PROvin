/**
 * mobile.de (Akamai) nedrīkst dalīt IP ar Nila pārlūku.
 * Automatizācija no šīs mašīnas ir izslēgta, kamēr nav atsevišķa proxy.
 * Apify aktors iet uz api.apify.com, ne uz biroja IP. To šis vārteja neaptur.
 */

export const NANO_IT_OFFICE_EGRESS_IPS = ["91.135.84.67"] as const;

export const MOBILE_DE_PAUSE_MARK = "mobile.de-pauze:";

export const MOBILE_DE_DIRECT_FETCH_NOTE =
  "mobile.de lapu PROVIN neielādē no sava IP (Akamai). Tekstu ielīmē ar roku vai ņem no Apify ielādes.";

export const MOBILE_DE_CIRCUIT_OPEN_REASON =
  "mobile.de-pauze: Akamai Access Denied. Nākamais mēģinājums pēc pauzes, vai dzēs mobile-de-circuit.json.";

export const MOBILE_DE_OFFICE_EGRESS_ERROR = "office_egress_forbidden";

const LOCAL_PROXY_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export type MobileDeEgressEnv = {
  MOBILE_DE_EGRESS_MODE?: string;
  MOBILE_DE_EGRESS_PROXY_URL?: string;
  MOBILE_DE_MAX_ACTOR_STARTS_PER_HOUR?: string;
  MOBILE_DE_AKAMAI_PAUSE_HOURS?: string;
};

export type MobileDeEgressDecision = {
  allowed: boolean;
  reason: string;
};

export function isMobileDeAkamaiHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  return host === "mobile.de" || host.endsWith(".mobile.de");
}

export function isMobileDePageUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return isMobileDeAkamaiHost(u.hostname);
  } catch {
    return false;
  }
}

export function decideMobileDeAutomationEgress(env: MobileDeEgressEnv = {}): MobileDeEgressDecision {
  const mode = (env.MOBILE_DE_EGRESS_MODE ?? "").trim().toLowerCase();
  if (mode !== "proxy") {
    return {
      allowed: false,
      reason:
        "mobile.de automatizācija no šīs mašīnas ir izslēgta. Iestati MOBILE_DE_EGRESS_MODE=proxy un MOBILE_DE_EGRESS_PROXY_URL uz atsevišķu proxy, ne biroja IP 91.135.84.67.",
    };
  }
  const proxy = (env.MOBILE_DE_EGRESS_PROXY_URL ?? "").trim();
  if (!proxy) {
    return { allowed: false, reason: "MOBILE_DE_EGRESS_PROXY_URL nav iestatīts." };
  }
  let parsed: URL;
  try {
    parsed = new URL(proxy);
  } catch {
    return { allowed: false, reason: "MOBILE_DE_EGRESS_PROXY_URL nav derīga saite." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "socks5:") {
    return { allowed: false, reason: "Proxy protokols drīkst būt http, https vai socks5." };
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (LOCAL_PROXY_HOSTS.has(host) || NANO_IT_OFFICE_EGRESS_IPS.some((ip) => ip === host) || proxy.includes("91.135.84.67")) {
    return {
      allowed: false,
      reason: "Proxy norāda uz biroja vai lokālo IP. mobile.de nedrīkst iet caur 91.135.84.67.",
    };
  }
  return { allowed: true, reason: "" };
}

export type MobileDePlaywrightProxy = {
  server: string;
  username?: string;
  password?: string;
};

/** Playwright `proxy` lauks. Paroli neatstāj servera virknē. */
export function mobileDePlaywrightProxy(proxyUrl: string): MobileDePlaywrightProxy {
  const u = new URL(proxyUrl.trim());
  const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`;
  const username = decodeURIComponent(u.username || "");
  const password = decodeURIComponent(u.password || "");
  return {
    server,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  };
}

export function looksLikeAkamaiAccessDenied(text: string): boolean {
  const body = text.slice(0, 8000);
  if (/edgesuite\.net/i.test(body)) return true;
  if (/<title>\s*access denied\s*<\/title>/i.test(body)) return true;
  if (/access denied/i.test(body) && /akamai|reference\s*#/i.test(body)) return true;
  return false;
}

export function mobileDeMaxActorStartsPerHour(env?: MobileDeEgressEnv): number {
  const raw = (env?.MOBILE_DE_MAX_ACTOR_STARTS_PER_HOUR ?? process.env.MOBILE_DE_MAX_ACTOR_STARTS_PER_HOUR)?.trim() ?? "";
  const n = raw ? Number.parseInt(raw, 10) : 24;
  if (!Number.isFinite(n)) return 24;
  return Math.min(60, Math.max(1, n));
}

export function mobileDeAkamaiPauseMs(env?: MobileDeEgressEnv): number {
  const raw = (env?.MOBILE_DE_AKAMAI_PAUSE_HOURS ?? process.env.MOBILE_DE_AKAMAI_PAUSE_HOURS)?.trim() ?? "";
  const hours = raw ? Number.parseFloat(raw) : 6;
  if (!Number.isFinite(hours)) return 6 * 60 * 60 * 1000;
  return Math.min(48, Math.max(1, hours)) * 60 * 60 * 1000;
}

export function mobileDeHourlyCapReason(maxPerHour: number): string {
  return `${MOBILE_DE_PAUSE_MARK} ${maxPerHour} Apify starti stundā. Pārējie pasūtījumi paliek nākamajai stundai.`;
}

export function decideMobileDeActorStart(input: {
  nowMs: number;
  pausedUntilMs: number;
  recentStartMs: readonly number[];
  maxPerHour: number;
}): MobileDeEgressDecision {
  if (input.pausedUntilMs > input.nowMs) {
    return { allowed: false, reason: MOBILE_DE_CIRCUIT_OPEN_REASON };
  }
  const hourAgo = input.nowMs - 60 * 60 * 1000;
  const recent = input.recentStartMs.filter((t) => Number.isFinite(t) && t >= hourAgo && t <= input.nowMs);
  if (recent.length >= input.maxPerHour) {
    return { allowed: false, reason: mobileDeHourlyCapReason(input.maxPerHour) };
  }
  return { allowed: true, reason: "" };
}

export function mobileDeActorStartTimes(entries: readonly { providerId: string; at: string }[]): number[] {
  return entries
    .filter((e) => e.providerId === "apify-mobilede")
    .map((e) => Date.parse(e.at))
    .filter((t) => Number.isFinite(t));
}

export function mobileDeAutomationShouldStopSweep(error: string): boolean {
  return looksLikeAkamaiAccessDenied(error) || error.includes(MOBILE_DE_PAUSE_MARK);
}

export type MobileDeCircuitFile = {
  version: 1;
  pausedUntil: string;
  trippedAt: string;
  reason: string;
};

export function emptyMobileDeCircuit(): MobileDeCircuitFile {
  return { version: 1, pausedUntil: "", trippedAt: "", reason: "" };
}

export function mobileDeCircuitAfterDenial(nowMs: number, reason: string, pauseMs: number): MobileDeCircuitFile {
  return {
    version: 1,
    pausedUntil: new Date(nowMs + pauseMs).toISOString(),
    trippedAt: new Date(nowMs).toISOString(),
    reason: reason.replace(/\s+/g, " ").trim().slice(0, 180),
  };
}

export function actorPayloadContainsOfficeEgress(payload: unknown): boolean {
  return JSON.stringify(payload).includes("91.135.84.67");
}
