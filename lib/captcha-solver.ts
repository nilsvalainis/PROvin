/**
 * CapSolver (https://docs.capsolver.com) - reCAPTCHA, Turnstile un Cloudflare Challenge.
 * Atslēga: CAPSOLVER_API_KEY.
 * Cloudflare Challenge un lkf.ee reCAPTCHA v2: sticky proxy (CAPSOLVER_PROXY vai FIXIE_URL),
 * tokens jāsūta no tā paša IP.
 * mnt.ee reCAPTCHA v3: pēc noklusējuma ProxyLess (Fixie datacenter neder V3); HTTP no Vercel.
 * Ja mnt.ee noraida standarta žetonu, viens mēģinājums ar M1 (CAPSOLVER_MNT_V3_M1=0 izslēdz).
 * CAPSOLVER_FORCE_PROXY=1 atjauno veco mnt.ee ceļu (V3 + HTTP caur Fixie).
 */
export type RecaptchaV3Task = {
  kind: "recaptcha_v3";
  websiteURL: string;
  websiteKey: string;
  pageAction: string;
  /** CapSolver proxy (URL `http://user:pass@host:port` vai colon forma). Ja ir, lieto ReCaptchaV3Task (ne ProxyLess). */
  proxy?: string;
  /**
   * `m1` = CapSolver augstā score versija (ReCaptchaV3M1Task / ReCaptchaV3M1TaskProxyLess, ~3 $/k).
   * Noklusējums `standard` (~1 $/k). M1 lieto kā rezervi, ja vietne noraida standarta žetonu.
   */
  variant?: "standard" | "m1";
  /**
   * Anti-Captcha / 2Captcha / CapMonster `minScore` rinda (0.3 / 0.7 / 0.9). Noklusējums 0.9:
   * mnt.ee noraida zema score žetonus. CapSolver šo parametru nelieto.
   */
  minScore?: 0.3 | 0.7 | 0.9;
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

/**
 * Risinātāji ar vienādu createTask / getTaskResult protokolu (Anti-Captcha API saime).
 * CapSolver ir primārais (Cloudflare, v2, v3). Pārējie: tikai reCAPTCHA v3 rezerve mnt.ee,
 * jo tiem ir `minScore` 0.9 rinda (reāli strādnieki ar augstu score).
 */
export type CaptchaProviderId = "capsolver" | "anticaptcha" | "2captcha" | "capmonster";

export type CaptchaProvider = {
  id: CaptchaProviderId;
  /** Admin UI: `CapSolver`, `Anti-Captcha`, `2Captcha`, `CapMonster`. */
  label: string;
  apiKey: string;
  createUrl: string;
  resultUrl: string;
};

const PROVIDER_META: Record<CaptchaProviderId, { label: string; base: string; envKey: string }> = {
  capsolver: { label: "CapSolver", base: "https://api.capsolver.com", envKey: "CAPSOLVER_API_KEY" },
  anticaptcha: { label: "Anti-Captcha", base: "https://api.anti-captcha.com", envKey: "ANTICAPTCHA_API_KEY" },
  "2captcha": { label: "2Captcha", base: "https://api.2captcha.com", envKey: "TWOCAPTCHA_API_KEY" },
  capmonster: { label: "CapMonster", base: "https://api.capmonster.cloud", envKey: "CAPMONSTER_API_KEY" },
};

/** Secība, kādā mnt.ee mēģina rezerves risinātājus (ja atslēga ir iestatīta). */
const RECAPTCHA_V3_FALLBACK_ORDER: CaptchaProviderId[] = ["anticaptcha", "2captcha", "capmonster"];

export function captchaProvider(id: CaptchaProviderId, apiKey?: string): CaptchaProvider {
  const meta = PROVIDER_META[id];
  return {
    id,
    label: meta.label,
    apiKey: (apiKey ?? process.env[meta.envKey] ?? "").trim(),
    createUrl: `${meta.base}/createTask`,
    resultUrl: `${meta.base}/getTaskResult`,
  };
}

/** mnt.ee V3 rezerves ar `minScore` 0.9: tikai tie, kam env ir atslēga. */
export function recaptchaV3FallbackProviders(
  env: Record<string, string | undefined> = process.env,
): CaptchaProvider[] {
  return RECAPTCHA_V3_FALLBACK_ORDER.map((id) => captchaProvider(id, env[PROVIDER_META[id].envKey])).filter(
    (p) => p.apiKey.length > 8,
  );
}

export function getCaptchaSolverApiKey(): string {
  return (process.env.CAPSOLVER_API_KEY ?? "").trim();
}

export function hasCaptchaSolverKey(): boolean {
  return getCaptchaSolverApiKey().length > 8;
}

/** ProxyLess reCAPTCHA (mnt.ee v3): CapSolver parasti gatavs ~4 s, bet Vercel poll var kavēties. */
export const CAPSOLVER_PROXYLESS_TIMEOUT_MS = 90_000;
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

/** `1` / `true` / `yes` - mnt.ee atkal sūta V3 un formu caur Fixie (vecais ceļš). */
export function isCapsolverForceProxy(raw = process.env.CAPSOLVER_FORCE_PROXY): boolean {
  return /^(1|true|yes)$/i.test((raw ?? "").trim());
}

/**
 * mnt.ee HTTP GET/POST: pēc noklusējuma tieši no Vercel. Cloudflare Challenge joprojām
 * pārslēdz sesiju uz Fixie. CAPSOLVER_FORCE_PROXY=1 sāk ar sticky proxy.
 */
export function mntFormHttpProxyUrl(): string | undefined {
  return isCapsolverForceProxy() ? vinStickyHttpProxyUrl() : undefined;
}

/**
 * mnt.ee reCAPTCHA v3: pēc noklusējuma bez proxy (ReCaptchaV3TaskProxyLess).
 * CAPSOLVER_FORCE_PROXY=1 atjauno ReCaptchaV3Task ar Fixie.
 */
export function mntRecaptchaV3Proxy(): string | undefined {
  return isCapsolverForceProxy() ? getCaptchaSolverProxy() || undefined : undefined;
}

/**
 * mnt.ee: ja vietne noraida standarta V3 žetonu („reCAPTCHA valideerimise viga”), vienu reizi
 * mēģina CapSolver M1 (augstā score) žetonu. Noklusējums ieslēgts; `CAPSOLVER_MNT_V3_M1=0` izslēdz.
 */
export function isMntRecaptchaM1FallbackEnabled(raw = process.env.CAPSOLVER_MNT_V3_M1): boolean {
  return !/^(0|false|no|off)$/i.test((raw ?? "").trim());
}

/** Piem. `mnt.ee: CapSolver: žetons neatnāca laikā`. */
export function prefixCaptchaSourceReason(reason: string, sourceLabel?: string): string {
  const label = sourceLabel?.trim();
  if (!label) return reason;
  if (reason === label || reason.startsWith(`${label} `) || reason.startsWith(`${label}:`)) return reason;
  return `${label}: ${reason}`;
}

export function captchaCreateTaskBody(
  apiKey: string,
  task: CaptchaTask,
  providerId: CaptchaProviderId = "capsolver",
): Record<string, unknown> {
  if (task.kind === "recaptcha_v3" && providerId !== "capsolver") {
    // Anti-Captcha protokols: `Proxyless` ar mazo l, bez M1, ar minScore rindu. Proxy V3 nav.
    return {
      clientKey: apiKey,
      task: {
        type: "RecaptchaV3TaskProxyless",
        websiteURL: task.websiteURL,
        websiteKey: task.websiteKey,
        pageAction: task.pageAction,
        minScore: task.minScore ?? 0.9,
      },
    };
  }
  if (task.kind === "recaptcha_v3") {
    const proxy = proxyForCapsolverTask(task.proxy);
    const base = task.variant === "m1" ? "ReCaptchaV3M1Task" : "ReCaptchaV3Task";
    const recaptchaTask: Record<string, unknown> = {
      type: proxy ? base : `${base}ProxyLess`,
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

export function parseCaptchaCreateTask(raw: unknown, label = "CapSolver"): { taskId: string } | { reason: string } {
  if (!raw || typeof raw !== "object") return { reason: `${label} createTask: tukša atbilde` };
  const o = raw as Record<string, unknown>;
  const errorId = Number(o.errorId ?? 0);
  // Anti-Captcha / 2Captcha taskId ir skaitlis, CapSolver - virkne.
  const taskId =
    typeof o.taskId === "string" ? o.taskId.trim() : typeof o.taskId === "number" ? String(o.taskId) : "";
  if (errorId !== 0 || !taskId) {
    const desc = String(o.errorDescription || o.errorCode || "createTask neizdevās").slice(0, 200);
    return { reason: `${label}: ${desc}` };
  }
  return { taskId };
}

export function parseCaptchaTaskResult(raw: unknown, label = "CapSolver"): CaptchaSolveResult | { pending: true } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: `${label} getTaskResult: tukša atbilde` };
  const o = raw as Record<string, unknown>;
  const errorId = Number(o.errorId ?? 0);
  if (errorId !== 0) {
    const desc = String(o.errorDescription || o.errorCode || "uzdevums neizdevās").slice(0, 200);
    return { ok: false, reason: `${label}: ${desc}` };
  }
  const status = String(o.status ?? "");
  if (status === "idle" || status === "processing") return { pending: true };
  if (status !== "ready") return { ok: false, reason: `${label}: statuss ${status || "nezināms"}` };
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
  if (!token) return { ok: false, reason: `${label}: žetons tukšs` };
  return { ok: true, token, cookies, userAgent: String(solution.userAgent ?? "").trim() };
}

type SolveDeps = {
  /** Noklusējums CapSolver (CAPSOLVER_API_KEY). mnt.ee V3 rezerve: Anti-Captcha / 2Captcha / CapMonster. */
  provider?: CaptchaProvider;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  /** Testiem: fiksēts pulkstenis, lai poll noildze nebūtu reāls 90 s. */
  now?: () => number;
  /** Admin UI: `mnt.ee` / `lkf.ee` / `car.info`. */
  sourceLabel?: string;
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

function isAbortLike(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
}

export function defaultCaptchaSolveTimeoutMs(task: CaptchaTask): number {
  return taskUsesCustomProxy(task) ? CAPSOLVER_PROXIED_TIMEOUT_MS : CAPSOLVER_PROXYLESS_TIMEOUT_MS;
}

/** Risinātāja `task.type` (ProxyLess vs proxied) diagnostikai. */
export function captchaTaskTypeName(task: CaptchaTask, providerId: CaptchaProviderId = "capsolver"): string {
  const recaptchaTask = captchaCreateTaskBody("k", task, providerId).task as Record<string, unknown>;
  return String(recaptchaTask.type ?? task.kind);
}

/**
 * Admin ziņai: CapSolver tikai tips (`ReCaptchaV3TaskProxyLess`), citiem arī risinātājs un rinda
 * (`Anti-Captcha RecaptchaV3TaskProxyless 0.9`).
 */
export function captchaTaskDisplayName(task: CaptchaTask, provider?: CaptchaProvider): string {
  const type = captchaTaskTypeName(task, provider?.id);
  if (!provider || provider.id === "capsolver") return type;
  const score = task.kind === "recaptcha_v3" ? ` ${task.minScore ?? 0.9}` : "";
  return `${provider.label} ${type}${score}`;
}

export function formatCaptchaPollTimeoutReason(info: {
  taskType: string;
  taskId?: string;
  lastStatus?: string;
  attempt: number;
  maxAttempts: number;
  providerLabel?: string;
}): string {
  const bits = [info.taskType];
  const id = info.taskId?.trim();
  if (id) bits.push(`uzdevums ${id.slice(0, 8)}`);
  bits.push(`statuss ${info.lastStatus?.trim() || "nav"}`);
  if (info.maxAttempts > 1) bits.push(`mēģinājums ${info.attempt}/${info.maxAttempts}`);
  return `${info.providerLabel ?? "CapSolver"}: žetons neatnāca laikā (${bits.join(", ")})`;
}

function remainingMs(deadline: number, now: () => number): number {
  return Math.max(1_000, deadline - now());
}

function pollStatusLabel(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "tukša_atbilde";
  const o = raw as Record<string, unknown>;
  if (Number(o.errorId ?? 0) !== 0) {
    return String(o.errorDescription || o.errorCode || "kļūda").slice(0, 80);
  }
  return String(o.status ?? "").trim() || "nav";
}

function appendHttpIfNeeded(reason: string, httpStatus: number): string {
  if (httpStatus >= 400 && !/HTTP \d+/.test(reason)) return `${reason} (HTTP ${httpStatus})`;
  return reason;
}

async function capsolverPostJson(
  fetchImpl: typeof fetch,
  url: string,
  payload: unknown,
  timeoutMs: number,
  providerLabel = "CapSolver",
): Promise<{ json: unknown; httpStatus: number } | { networkReason: string }> {
  const endpoint = `${providerLabel} ${url.includes("createTask") ? "createTask" : "getTaskResult"}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1_000, timeoutMs));
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: ctrl.signal,
    });
    const httpStatus = typeof (res as Response).status === "number" ? (res as Response).status : 200;
    const json: unknown = await res.json().catch(() => null);
    if (json == null) {
      return { networkReason: `${endpoint}: tukša atbilde (HTTP ${httpStatus})` };
    }
    return { json, httpStatus };
  } catch (e) {
    if (isAbortLike(e)) return { networkReason: `${endpoint}: tīkla noildze` };
    const msg = e instanceof Error ? e.message.slice(0, 160) : "kļūda";
    return { networkReason: `${endpoint}: tīkls (${msg})` };
  } finally {
    clearTimeout(timer);
  }
}

function labeledSolveResult(result: CaptchaSolveResult, sourceLabel?: string): CaptchaSolveResult {
  if (result.ok) return result;
  return { ok: false, reason: prefixCaptchaSourceReason(result.reason, sourceLabel) };
}

export async function solveCaptcha(task: CaptchaTask, deps: SolveDeps = {}): Promise<CaptchaSolveResult> {
  const provider = deps.provider ?? captchaProvider("capsolver", deps.apiKey ?? getCaptchaSolverApiKey());
  const apiKey = (deps.apiKey ?? provider.apiKey).trim();
  const label = deps.sourceLabel;
  const providerLabel = provider.label;
  if (apiKey.length < 8) {
    const envKey = PROVIDER_META[provider.id].envKey;
    return labeledSolveResult({ ok: false, reason: `Nav ${envKey}` }, label);
  }
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? defaultCaptchaSolveTimeoutMs(task);
  const proxied = taskUsesCustomProxy(task) && provider.id === "capsolver";
  const taskType = captchaTaskTypeName(task, provider.id);
  const payload = captchaCreateTaskBody(apiKey, task, provider.id);
  const maxAttempts = 2;

  let lastReason = formatCaptchaPollTimeoutReason({
    taskType,
    lastStatus: "nav",
    attempt: 1,
    maxAttempts: proxied ? 1 : maxAttempts,
    providerLabel,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const deadline = now() + timeoutMs;
    const createdPost = await capsolverPostJson(
      fetchImpl,
      provider.createUrl,
      payload,
      remainingMs(deadline, now),
      providerLabel,
    );
    if ("networkReason" in createdPost) {
      return labeledSolveResult({ ok: false, reason: createdPost.networkReason }, label);
    }

    const immediate = parseCaptchaTaskResult(createdPost.json, providerLabel);
    if (!("pending" in immediate) && immediate.ok) {
      return labeledSolveResult(immediate, label);
    }

    const created = parseCaptchaCreateTask(createdPost.json, providerLabel);
    if ("reason" in created) {
      const reason = appendHttpIfNeeded(created.reason, createdPost.httpStatus);
      lastReason = reason;
      if (attempt < maxAttempts && proxied && isProxyConnectFailure(reason)) {
        await sleep(2500);
        continue;
      }
      return labeledSolveResult({ ok: false, reason }, label);
    }

    let lastStatus = pollStatusLabel(createdPost.json);
    await sleep(2000);
    let retryCreateForProxy = false;
    while (now() < deadline) {
      const pollPost = await capsolverPostJson(
        fetchImpl,
        provider.resultUrl,
        // Anti-Captcha / 2Captcha gaida skaitlisku taskId; CapSolver virkni.
        { clientKey: apiKey, taskId: provider.id === "capsolver" ? created.taskId : numericIfPossible(created.taskId) },
        remainingMs(deadline, now),
        providerLabel,
      );
      if ("networkReason" in pollPost) {
        lastStatus = pollPost.networkReason.replace(/^.*?getTaskResult:\s*/i, "");
        if (now() >= deadline) break;
        await sleep(1500);
        continue;
      }
      lastStatus = pollStatusLabel(pollPost.json);
      const parsed = parseCaptchaTaskResult(pollPost.json, providerLabel);
      if ("pending" in parsed) {
        await sleep(1500);
        continue;
      }
      if (!parsed.ok && attempt < maxAttempts && proxied && isProxyConnectFailure(parsed.reason)) {
        lastReason = parsed.reason;
        retryCreateForProxy = true;
        await sleep(2500);
        break;
      }
      return labeledSolveResult(parsed, label);
    }
    if (retryCreateForProxy) continue;

    lastReason = formatCaptchaPollTimeoutReason({
      taskType,
      taskId: created.taskId,
      lastStatus,
      attempt,
      maxAttempts: proxied ? 1 : maxAttempts,
      providerLabel,
    });
    if (!proxied && attempt < maxAttempts) {
      console.warn("[capsolver] ProxyLess poll noildze, atkārtoju createTask", lastReason);
      await sleep(1500);
      continue;
    }
    console.warn("[capsolver]", lastReason);
    return labeledSolveResult({ ok: false, reason: lastReason }, label);
  }
  console.warn("[capsolver]", lastReason);
  return labeledSolveResult({ ok: false, reason: lastReason }, label);
}

function numericIfPossible(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id;
}
