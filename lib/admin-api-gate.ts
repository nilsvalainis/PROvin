/**
 * Edge-safe `/api/admin/*` middleware gate: admin session, CSRF Origin,
 * and exemptions for login/logout plus webhook/cron paths if they appear
 * under `/api/admin`.
 */

import {
  isAdminGoogleSessionLive,
  type AdminGoogleState,
} from "@/lib/admin-google-session-live";
import { adminApiGateIsProduction, loadAdminGoogleStateForGate } from "@/lib/admin-google-state-edge";
import {
  ADMIN_SESSION_COOKIE_NAME,
  decodeAdminSessionToken,
  isAdminGoogleSessionPayload,
} from "@/lib/admin-session-token";
import { B2B_DEMO_ADMIN_SECRET_HEADER, verifyB2bDemoAdminSecret } from "@/lib/b2b-demo-admin-secret";
import { getPublicSiteOrigin } from "@/lib/site-url";
import {
  decideAdminApiAccess,
  isStaffPublicApiPath,
  type AccessActor,
} from "@/lib/staff-roles";
import { STAFF_SESSION_COOKIE_NAME, staffSectionsFromPayload, verifyStaffSessionToken } from "@/lib/staff-session-token";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type AdminApiGateDecision =
  | { action: "next" }
  | { action: "unauthorized" }
  | { action: "forbidden" }
  | { action: "forbidden_origin" };

export function isUnsafeHttpMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

export function isAdminApiLoginOrLogoutPath(pathname: string): boolean {
  return (
    pathname === "/api/admin/login" ||
    pathname.startsWith("/api/admin/login/") ||
    pathname === "/api/admin/logout" ||
    pathname.startsWith("/api/admin/logout/")
  );
}

/** Stripe/Vercel-style callbacks if they are ever mounted under `/api/admin`. */
export function isAdminApiWebhookOrCronPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/admin/webhooks/") ||
    pathname.startsWith("/api/admin/webhook/") ||
    pathname.startsWith("/api/admin/cron/") ||
    pathname.startsWith("/api/admin/crons/")
  );
}

export function isAdminApiSessionExemptPath(pathname: string): boolean {
  return (
    isAdminApiLoginOrLogoutPath(pathname) ||
    isAdminApiWebhookOrCronPath(pathname) ||
    isStaffPublicApiPath(pathname)
  );
}

export type AdminApiGateOptions = {
  /** Testiem: iedot stāvokli bez Blob. `null` = stāvokli neizdevās nolasīt. */
  googleState?: AdminGoogleState | null;
  loadGoogleState?: () => Promise<AdminGoogleState | null>;
  nowMs?: number;
};

async function resolveGoogleAdminLive(
  payload: Parameters<typeof isAdminGoogleSessionLive>[1],
  opts?: AdminApiGateOptions,
): Promise<boolean> {
  const nowMs = opts?.nowMs ?? Date.now();
  if (opts && "googleState" in opts) {
    return opts.googleState != null && isAdminGoogleSessionLive(opts.googleState, payload, nowMs);
  }
  const state = opts?.loadGoogleState ? await opts.loadGoogleState() : await loadAdminGoogleStateForGate();
  if (state) return isAdminGoogleSessionLive(state, payload, nowMs);
  return !adminApiGateIsProduction();
}

export async function resolveAccessActorFromCookies(
  cookies: {
    get(name: string): { value: string } | undefined;
  },
  opts?: AdminApiGateOptions,
): Promise<AccessActor> {
  const adminToken = cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const admin = await decodeAdminSessionToken(adminToken, undefined, opts?.nowMs);
  if (admin) {
    if (!isAdminGoogleSessionPayload(admin) || (await resolveGoogleAdminLive(admin, opts))) {
      return { kind: "admin" };
    }
  }
  const staff = await verifyStaffSessionToken(cookies.get(STAFF_SESSION_COOKIE_NAME)?.value);
  if (staff) return { kind: "staff", sections: staffSectionsFromPayload(staff) };
  return { kind: "none" };
}

export function isAdminB2bDemoApiPath(pathname: string): boolean {
  return pathname === "/api/admin/b2b-demo" || pathname.startsWith("/api/admin/b2b-demo/");
}

function originFromUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim() ?? "";
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

function requestHostOrigin(headers: Headers): string | null {
  const hostRaw = headers.get("x-forwarded-host") ?? headers.get("host");
  const host = hostRaw?.split(",")[0]?.trim() ?? "";
  if (!host) return null;
  const protoRaw = headers.get("x-forwarded-proto");
  const protoHint = protoRaw?.split(",")[0]?.trim().replace(/:$/, "") ?? "";
  const proto =
    protoHint ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  return originFromUrl(`${proto}://${host}`);
}

function withWwwVariants(origin: string): string[] {
  try {
    const u = new URL(origin);
    if (u.port) return [origin];
    const host = u.hostname;
    if (host === "localhost" || host.endsWith(".localhost") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return [origin];
    }
    const alt = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
    return [origin, `${u.protocol}//${alt}`];
  } catch {
    return [origin];
  }
}

export function allowedAdminApiOrigins(headers: Headers): Set<string> {
  const out = new Set<string>();
  const add = (origin: string | null) => {
    if (!origin) return;
    for (const o of withWwwVariants(origin)) out.add(o);
  };
  add(requestHostOrigin(headers));
  add(getPublicSiteOrigin());
  return out;
}

/**
 * CSRF: mutating admin API calls must come from the same host (or apex/www
 * of that host / public site). `Sec-Fetch-Site: same-origin` is accepted;
 * `same-site` is not, because `demo.provin.lv` is same-site as `www.provin.lv`.
 */
export function adminApiOriginAllowed(headers: Headers): boolean {
  const secFetchSite = headers.get("sec-fetch-site")?.trim().toLowerCase() ?? "";
  if (secFetchSite === "same-origin") return true;

  const claimed = originFromUrl(headers.get("origin")) ?? originFromUrl(headers.get("referer"));
  if (!claimed) return false;
  return allowedAdminApiOrigins(headers).has(claimed);
}

export async function decideAdminApiGate(
  request: {
    nextUrl: { pathname: string };
    method: string;
    headers: Headers;
    cookies: { get(name: string): { value: string } | undefined };
  },
  opts?: AdminApiGateOptions,
): Promise<AdminApiGateDecision> {
  const pathname = request.nextUrl.pathname;
  if (isAdminApiWebhookOrCronPath(pathname)) return { action: "next" };

  const demoHeader = request.headers.get(B2B_DEMO_ADMIN_SECRET_HEADER);
  const demoHeaderOk = isAdminB2bDemoApiPath(pathname) && verifyB2bDemoAdminSecret(demoHeader);

  if (!isAdminApiSessionExemptPath(pathname) && !demoHeaderOk) {
    const actor = await resolveAccessActorFromCookies(request.cookies, opts);
    const access = decideAdminApiAccess(pathname, actor);
    if (access === "unauthorized") return { action: "unauthorized" };
    if (access === "forbidden") return { action: "forbidden" };
  }

  if (isUnsafeHttpMethod(request.method) && !adminApiOriginAllowed(request.headers)) {
    if (demoHeaderOk) return { action: "next" };
    return { action: "forbidden_origin" };
  }

  return { action: "next" };
}

/**
 * B2B partneru API (`/api/partner/*`): sīkdatnes sesija, tāpēc mainošiem pieprasījumiem
 * tāda pati CSRF Origin pārbaude kā adminam. GET paliek atvērts (lasīšana, PDF saites).
 */
export function decidePartnerApiCsrf(request: { method: string; headers: Headers }): "next" | "forbidden_origin" {
  if (!isUnsafeHttpMethod(request.method)) return "next";
  return adminApiOriginAllowed(request.headers) ? "next" : "forbidden_origin";
}
