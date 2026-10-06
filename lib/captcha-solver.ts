/**
 * CapSolver (https://docs.capsolver.com) - reCAPTCHA, Turnstile un Cloudflare Challenge.
 * Atslēga: CAPSOLVER_API_KEY. Cloudflare Challenge un reCAPTCHA IP saite prasa
 * sticky proxy (CAPSOLVER_PROXY vai FIXIE_URL) - tokens jāsūta no tā paša IP.
 */
export type RecaptchaV3Task = {
  kind: "recaptcha_v3";
  websiteURL: string;
  websiteKey: string;
  pageAction: string;
  /** CapSolver proxy (URL `http://user:pass@host:port` vai colon forma). Ja ir, lieto ReCaptchaV3Task (ne ProxyLess). */
  proxy?: string;
};

export type RecaptchaV2Task = {
  kind: "recaptcha_v2";
  websiteURL: string;
  websiteKey: string;
  /** CapSolver proxy (URL vai colon forma). Ja ir, lieto ReCaptchaV2Task (ne ProxyLess). */
  proxy?: string;
};

export type TurnstileTask = {
  kind: "turnstile";
  websiteURL: string;
  websiteKey: string;
};

export type CloudflareChallengeTask = {
  kind: "cloudflare_challenge";
  websiteURL: string;
  proxy: string;
  html?: string;
  userAgent?: string;
};

export type CaptchaTask = RecaptchaV3Task | RecaptchaV2Task | TurnstileTask | CloudflareChallengeTask;

export type CaptchaSolveOk = {
  ok: true;
  token: string;
  cookies: Record<string, string>;
  userAgent: string;
};
export type CaptchaSolveErr = { ok: false; reason: string };
export type CaptchaSolveResult = CaptchaSolveOk | CaptchaSolveErr;

const CREATE_URL = "https://api.capsolver.com/createTask";
const RESULT_URL = "https://api.capsolver.com/getTaskResult";

export function getCaptchaSolverApiKey(): string {
  return (process.env.CAPSOLVER_API_KEY ?? "").trim();
}

export function hasCaptchaSolverKey(): boolean {
  return getCaptchaSolverApiKey().length > 8;
}

export const CAPSOLVER_PROXYLESS_TIMEOUT_MS = 45_000;
/** Proxied reCAPTCHA (Fixie) bieži pārsniedz 45 s poll; CapSolver docs: URL forma DNS hostiem. */
export const CAPSOLVER_PROXIED_TIMEOUT_MS = 120_000;

const PROXY_SCHEMES = new Set(["http", "https", "socks4", "socks5"]);

function defaultPortForProxyScheme(scheme: string): string {
  if (scheme === "https") return "443";
  if (scheme === "http") return "80";
  return "";
}

function proxyUrl(scheme: string, host: string, port: string, user?: string, pass?: string): string {
  if (user) {
    return `${scheme}://${encodeURIComponent(user)}:${encodeURIComponent(pass ?? "")}@${host}:${port}`;
  }
  return `${scheme}://${host}:${port}`;
}

/**
 * Normalizē proxy CapSolver API formātam.
 * DNS hostiem (Fixie `*.usefixie.com`) CapSolver dokumentē URL formu `http://user:pass@host:port`
 * ("Use url dns"). Colon forma `host:port:user:pass` paliek derīga IP, bet hostname bieži dod
 * HTTP 400 "custom proxy connect failed".
 */
export function capsolverProxyFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(https?|socks[45]):\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname) return null;
      const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
      const port = parsed.port || defaultPortForProxyScheme(scheme);
      if (!port) return null;
      return proxyUrl(scheme, parsed.hostname, port, parsed.username || undefined, parsed.password);
    } catch {
      return null;
    }
  }
  const parts = trimmed.split(":");
  const scheme = parts[0]?.toLowerCase() ?? "";
  if (PROXY_SCHEMES.has(scheme) && parts.length >= 5) {
    const [, host, port, user, ...rest] = parts;
    if (host && port && user) return proxyUrl(scheme, host, port, user, rest.join(":"));
    return null;
  }
  if (parts.length >= 4) {
    const [host, port, user, ...rest] = parts;
    if (host && port && user) return proxyUrl("http", host, port, user, rest.join(":"));
    return null;
  }
  if (parts.length === 2 && parts[0] && parts[1]) return proxyUrl("http", parts[0], parts[1]);
  return null;
}

function proxyForCapsolverTask(proxy: string | undefined): string {
  const trimmed = proxy?.trim() ?? "";
  if (!trimmed) return "";
  return capsolverProxyFromUrl(trimmed) ?? trimmed;
}

export function getCaptchaSolverProxy(): string {
  const direct = capsolverProxyFromUrl(process.env.CAPSOLVER_PROXY ?? "");
  if (direct) return direct;
  return capsolverProxyFromUrl(process.env.FIXIE_URL ?? "") ?? "";
}

/** CapSolver proxy (URL vai colon) -> http(s)://user:pass@host:port undici ProxyAgent. */
export function httpProxyUrlFromCapsolver(proxy: string): string | null {
  const normalized = capsolverProxyFromUrl(proxy);
  if (!normalized || !/^https?:\/\//i.test(normalized)) return null;
  return normalized;
}

/** HTTP fetch caur to pašu sticky proxy, ar kuru CapSolver risina captcha (FIXIE_URL). */
export function vinStickyHttpProxyUrl(): string | undefined {
  return httpProxyUrlFromCapsolver(getCaptchaSolverProxy()) || undefined;
}

export function captchaCreateTaskBody(apiKey: string, task: CaptchaTask): Record<string, unknown> {
  if (task.kind === "recaptcha_v3") {
    const proxy = proxyForCapsolverTask(task.proxy);
    const recaptchaTask: Record<string, unknown> = {
      type: proxy ? "ReCaptchaV3Task" : "ReCaptchaV3TaskProxyLess",
      websiteURL: task.websiteURL,
      websiteKey: task.websiteKey,
      pageAction: task.pageAction,
    };
    if (proxy) recaptchaTask.proxy = proxy;
    return { clientKey: apiKey, task: recaptchaTask };
  }
  if (task.kind === "recaptcha_v2") {
    const proxy = proxyForCapsolverTask(task.proxy);
    const recaptchaTask: Record<string, unknown> = {
      type: proxy ? "ReCaptchaV2Task" : "ReCaptchaV2TaskProxyLess",
      websiteURL: task.websiteURL,
      websiteKey: task.websiteKey,
    };
    if (proxy) recaptchaTask.proxy = proxy;
    return { clientKey: apiKey, task: recaptchaTask };
  }
  if (task.kind === "turnstile") {
    return {
      clientKey: apiKey,
      task: {
        type: "AntiTurnstileTaskProxyLess",
        websiteURL: task.websiteURL,
        websiteKey: task.websiteKey,
      },
    };
  }
  const cfTask: Record<string, unknown> = {
    type: "AntiCloudflareTask",
    websiteURL: task.websiteURL,
    proxy: proxyForCapsolverTask(task.proxy) || task.proxy,
  };
  if (task.html) cfTask.html = task.html;
  if (task.userAgent) cfTask.userAgent = task.userAgent;
  return { clientKey: apiKey, task: cfTask };
}

export function parseCaptchaCreateTask(raw: unknown): { taskId: string } | { reason: string } {
  if (!raw || typeof raw !== "object") return { reason: "CapSolver createTask: tukša atbilde" };
  const o = raw as Record<string, unknown>;
  const errorId = Number(o.errorId ?? 0);
  const taskId = typeof o.taskId === "string" ? o.taskId.trim() : "";
  if (errorId !== 0 || !taskId) {
    const desc = String(o.errorDescription || o.errorCode || "createTask neizdevās").slice(0, 200);
    return { reason: `CapSolver: ${desc}` };
  }
  return { taskId };
}

export function parseCaptchaTaskResult(raw: unknown): CaptchaSolveResult | { pending: true } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "CapSolver getTaskResult: tukša atbilde" };
  const o = raw as Record<string, unknown>;
  const errorId = Number(o.errorId ?? 0);
  if (errorId !== 0) {
    const desc = String(o.errorDescription || o.errorCode || "uzdevums neizdevās").slice(0, 200);
    return { ok: false, reason: `CapSolver: ${desc}` };
  }
  const status = String(o.status ?? "");
  if (status === "idle" || status === "processing") return { pending: true };
  if (status !== "ready") return { ok: false, reason: `CapSolver: statuss ${status || "nezināms"}` };
  const solution = o.solution && typeof o.solution === "object" ? (o.solution as Record<string, unknown>) : {};
  const cookiesRaw =
    solution.cookies && typeof solution.cookies === "object" ? (solution.cookies as Record<string, unknown>) : {};
  const cookies: Record<string, string> = {};
  for (const [k, v] of Object.entries(cookiesRaw)) {
    if (typeof v === "string" && v.trim()) cookies[k] = v.trim();
  }
  for (const k of ["recaptcha-ca-t", "recaptcha-ca-e"] as const) {
    const v = String(solution[k] ?? "").trim();
    if (v) cookies[k] = v;
  }
  const token = String(solution.gRecaptchaResponse ?? solution.token ?? cookies.cf_clearance ?? "").trim();
  if (!token) return { ok: false, reason: "CapSolver: žetons tukšs" };
  return { ok: true, token, cookies, userAgent: String(solution.userAgent ?? "").trim() };
}

type SolveDeps = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function taskUsesCustomProxy(task: CaptchaTask): boolean {
  if (task.kind === "cloudflare_challenge") return Boolean(task.proxy?.trim());
  if (task.kind === "recaptcha_v3" || task.kind === "recaptcha_v2") return Boolean(task.proxy?.trim());
  return false;
}

function isProxyConnectFailure(reason: string): boolean {
  return /custom proxy connect failed/i.test(reason);
}

export function defaultCaptchaSolveTimeoutMs(task: CaptchaTask): number {
  return taskUsesCustomProxy(task) ? CAPSOLVER_PROXIED_TIMEOUT_MS : CAPSOLVER_PROXYLESS_TIMEOUT_MS;
}

export async function solveCaptcha(task: CaptchaTask, deps: SolveDeps = {}): Promise<CaptchaSolveResult> {
  const apiKey = (deps.apiKey ?? getCaptchaSolverApiKey()).trim();
  if (apiKey.length < 8) return { ok: false, reason: "Nav CAPSOLVER_API_KEY" };
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const timeoutMs = deps.timeoutMs ?? defaultCaptchaSolveTimeoutMs(task);
  const maxCreateAttempts = taskUsesCustomProxy(task) ? 2 : 1;

  let lastReason = "CapSolver: žetons neatnāca laikā";
  for (let attempt = 1; attempt <= maxCreateAttempts; attempt += 1) {
    const deadline = Date.now() + timeoutMs;
    const createdRes = await fetchImpl(CREATE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(captchaCreateTaskBody(apiKey, task)),
      cache: "no-store",
    });
    const createdJson: unknown = await createdRes.json().catch(() => null);
    const created = parseCaptchaCreateTask(createdJson);
    if ("reason" in created) {
      lastReason = created.reason;
      if (attempt < maxCreateAttempts && isProxyConnectFailure(created.reason)) {
        await sleep(2500);
        continue;
      }
      return { ok: false, reason: created.reason };
    }

    await sleep(2000);
    while (Date.now() < deadline) {
      const pollRes = await fetchImpl(RESULT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientKey: apiKey, taskId: created.taskId }),
        cache: "no-store",
      });
      const pollJson: unknown = await pollRes.json().catch(() => null);
      const parsed = parseCaptchaTaskResult(pollJson);
      if ("pending" in parsed) {
        await sleep(1500);
        continue;
      }
      if (!parsed.ok && attempt < maxCreateAttempts && isProxyConnectFailure(parsed.reason)) {
        lastReason = parsed.reason;
        await sleep(2500);
        break;
      }
      return parsed;
    }
    if (Date.now() >= deadline) {
      return { ok: false, reason: "CapSolver: žetons neatnāca laikā" };
    }
  }
  return { ok: false, reason: lastReason };
}
