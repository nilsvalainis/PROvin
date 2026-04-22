import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

export type IrissSessionPlatform = "mobile" | "autobid" | "openline" | "auto1";

const SESSION_DIR = ".data/iriss-listings-sessions";
const LOGIN_HINT_RE =
  /(login|log in|sign in|anmelden|anmeldung|pieslēgties|ielogoties|autoriz|konto|account|registr|password|passwort)/i;

type SessionFile = {
  platform: IrissSessionPlatform;
  updatedAt: string;
  expiresAt: string;
  userAgent: string;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: "Strict" | "Lax" | "None";
  }>;
};

function envPrefix(platform: IrissSessionPlatform): string {
  return `IRISS_LISTINGS_${platform.toUpperCase()}`;
}

function defaultUserAgent(): string {
  return "Mozilla/5.0 (compatible; PROVIN-IRISS-SLUDINAJUMI/1.0; +https://provin.lv)";
}

function sessionPath(platform: IrissSessionPlatform): string {
  return path.join(process.cwd(), SESSION_DIR, `${platform}.json`);
}

async function readSession(platform: IrissSessionPlatform): Promise<SessionFile | null> {
  try {
    const txt = await fs.readFile(sessionPath(platform), "utf8");
    const raw = JSON.parse(txt) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (!Array.isArray(o.cookies)) return null;
    return {
      platform,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
      expiresAt: typeof o.expiresAt === "string" ? o.expiresAt : "",
      userAgent: typeof o.userAgent === "string" ? o.userAgent : defaultUserAgent(),
      cookies: o.cookies as SessionFile["cookies"],
    };
  } catch {
    return null;
  }
}

async function writeSession(platform: IrissSessionPlatform, data: SessionFile): Promise<void> {
  const fp = sessionPath(platform);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(data, null, 2), "utf8");
}

function cookieHeaderFromSession(url: URL, session: SessionFile | null): string {
  if (!session) return "";
  const nowSec = Math.floor(Date.now() / 1000);
  const host = url.hostname.toLowerCase();
  const pathName = url.pathname || "/";
  const pairs: string[] = [];
  for (const c of session.cookies) {
    const cDomain = (c.domain || "").toLowerCase().replace(/^\./, "");
    const cPath = c.path || "/";
    if (c.expires > 0 && c.expires < nowSec) continue;
    const domainOk = cDomain ? host === cDomain || host.endsWith(`.${cDomain}`) : true;
    if (!domainOk) continue;
    if (!pathName.startsWith(cPath)) continue;
    pairs.push(`${c.name}=${c.value}`);
  }
  return pairs.join("; ");
}

function isLoginLike(statusCode: number, html: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true;
  const tiny = html.slice(0, 12000).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (!LOGIN_HINT_RE.test(tiny)) return false;
  return /password|passwort|parole/i.test(tiny);
}

async function probeWithHeaders(url: string, headers: Record<string, string>): Promise<{ ok: boolean; statusCode: number; note: string }> {
  const ctrl = new AbortController();
  const timeoutMs = Math.max(8000, Number.parseInt(process.env.IRISS_LISTINGS_FETCH_TIMEOUT_MS ?? "18000", 10) || 18000);
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const html = await res.text();
    if (isLoginLike(res.status, html)) return { ok: false, statusCode: res.status, note: "login_required" };
    if (!res.ok) return { ok: false, statusCode: res.status, note: `http_${res.status}` };
    return { ok: true, statusCode: res.status, note: "" };
  } catch (e) {
    return { ok: false, statusCode: 0, note: e instanceof Error ? e.message : "fetch_failed" };
  } finally {
    clearTimeout(t);
  }
}

function requiredLoginConfig(platform: IrissSessionPlatform): {
  loginUrl: string;
  username: string;
  password: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  successSelector: string;
  userAgent: string;
} {
  const pfx = envPrefix(platform);
  return {
    loginUrl: process.env[`${pfx}_LOGIN_URL`]?.trim() ?? "",
    username: process.env[`${pfx}_LOGIN_USERNAME`]?.trim() ?? "",
    password: process.env[`${pfx}_LOGIN_PASSWORD`] ?? "",
    usernameSelector:
      process.env[`${pfx}_LOGIN_USERNAME_SELECTOR`]?.trim() ??
      'input[type="email"], input[name*="user" i], input[name*="email" i], input[id*="user" i], input[id*="email" i]',
    passwordSelector:
      process.env[`${pfx}_LOGIN_PASSWORD_SELECTOR`]?.trim() ?? 'input[type="password"], input[name*="pass" i], input[id*="pass" i]',
    submitSelector: process.env[`${pfx}_LOGIN_SUBMIT_SELECTOR`]?.trim() ?? 'button[type="submit"], input[type="submit"]',
    successSelector: process.env[`${pfx}_LOGIN_SUCCESS_SELECTOR`]?.trim() ?? "",
    userAgent: process.env[`${pfx}_USER_AGENT`]?.trim() || defaultUserAgent(),
  };
}

export async function getPlatformAuthHeaders(platform: IrissSessionPlatform, url: string): Promise<Record<string, string>> {
  const pfx = envPrefix(platform);
  const authHeader = process.env[`${pfx}_AUTH_HEADER`]?.trim() ?? "";
  const cookieFromEnv = process.env[`${pfx}_COOKIE`]?.trim() ?? "";
  const userAgent = process.env[`${pfx}_USER_AGENT`]?.trim() || defaultUserAgent();
  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    "Accept-Language": "lv,en;q=0.9,de;q=0.8",
    Accept: "text/html,application/xhtml+xml",
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
  };
  if (authHeader) headers.Authorization = authHeader;
  let cookie = cookieFromEnv;
  if (!cookie) {
    try {
      const u = new URL(url);
      cookie = cookieHeaderFromSession(u, await readSession(platform));
    } catch {
      cookie = "";
    }
  }
  if (cookie) headers.Cookie = cookie;
  return headers;
}

export async function ensurePlatformSession(platform: IrissSessionPlatform, probeUrl: string): Promise<{
  ok: boolean;
  note: string;
}> {
  const headers = await getPlatformAuthHeaders(platform, probeUrl);
  const initial = await probeWithHeaders(probeUrl, headers);
  if (initial.ok) return { ok: true, note: "session_ok" };

  const cfg = requiredLoginConfig(platform);
  if (!cfg.loginUrl || !cfg.username || !cfg.password) {
    return { ok: false, note: "login_required_missing_credentials" };
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: cfg.userAgent });
    const page = await context.newPage();
    await page.goto(cfg.loginUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.locator(cfg.usernameSelector).first().fill(cfg.username, { timeout: 12000 });
    await page.locator(cfg.passwordSelector).first().fill(cfg.password, { timeout: 12000 });
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => undefined),
      page.locator(cfg.submitSelector).first().click({ timeout: 12000 }),
    ]);
    const waitMs = Math.max(0, Number.parseInt(process.env[`${envPrefix(platform)}_LOGIN_WAIT_MS`] ?? "1500", 10) || 1500);
    if (cfg.successSelector) {
      await page.locator(cfg.successSelector).first().waitFor({ state: "visible", timeout: 20000 }).catch(() => undefined);
    }
    if (waitMs > 0) await page.waitForTimeout(waitMs);

    const cookies = await context.cookies();
    await browser.close();

    const nowSec = Math.floor(Date.now() / 1000);
    const minExpSec = cookies
      .map((c) => c.expires)
      .filter((x) => Number.isFinite(x) && x > nowSec)
      .sort((a, b) => a - b)[0];
    const expiresAt = minExpSec ? new Date(minExpSec * 1000).toISOString() : new Date(Date.now() + 6 * 3600_000).toISOString();
    const toStore: SessionFile = {
      platform,
      updatedAt: new Date().toISOString(),
      expiresAt,
      userAgent: cfg.userAgent,
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
      })),
    };
    await writeSession(platform, toStore);

    const retryHeaders = await getPlatformAuthHeaders(platform, probeUrl);
    const retry = await probeWithHeaders(probeUrl, retryHeaders);
    if (retry.ok) return { ok: true, note: "auto_login_ok" };
    return { ok: false, note: "auto_login_failed_probe" };
  } catch (e) {
    return { ok: false, note: e instanceof Error ? `auto_login_error:${e.message.slice(0, 120)}` : "auto_login_error" };
  }
}

export async function getSessionFileMeta(platform: IrissSessionPlatform): Promise<{ updatedAt: string; expiresAt: string } | null> {
  const s = await readSession(platform);
  if (!s) return null;
  return { updatedAt: s.updatedAt, expiresAt: s.expiresAt };
}
