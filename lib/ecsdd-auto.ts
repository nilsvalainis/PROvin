import "server-only";

import { timingSafeEqual } from "node:crypto";

import { sendAdminPush } from "@/lib/admin-push";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults, type CsddFormFields } from "@/lib/admin-source-blocks";
import {
  ecsddAutoShouldStart,
  reduceEcsddProgress,
  reduceEcsddResult,
  resolveEcsddQuery,
  type EcsddRelayJobEvent,
} from "@/lib/ecsdd-auto-logic";
import { readEcsddAutoStatus, writeEcsddAutoStatus } from "@/lib/ecsdd-auto-store";
import { isEcsddAutoActive, type EcsddAutoStatus, type EcsddRelaySession } from "@/lib/ecsdd-auto-types";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";
import { recordSourceOutcomes } from "@/lib/source-health-store";

/**
 * e.csdd automātiskā uzziņa (Vercel puse). Hetzner relejs `relay/provin-ecsdd` tur e.csdd sesiju (Vienotā pieteikšanās,
 * Smart-ID) un nolasa `tadati` lapu; šeit: kad sākt, push ar kontrolkodu, rezultāta glabāšana pasūtījumam.
 * Smart-ID personas kods un e.csdd sīkdatnes Vercel nekad nenonāk - tie ir tikai serverī.
 */

const LOG = "[ecsdd-auto]";

export type EcsddRelayConfig = { baseUrl: string; token: string; autoEnabled: boolean };

export function readEcsddRelayConfig(env: Record<string, string | undefined> = process.env): EcsddRelayConfig | null {
  const baseUrl = (env.ECSDD_RELAY_URL ?? "").trim().replace(/\/+$/, "");
  const token = (env.ECSDD_RELAY_TOKEN ?? "").trim();
  if (!baseUrl.startsWith("https://") || token.length < 16) return null;
  return { baseUrl, token, autoEnabled: /^(1|true|yes)$/i.test((env.ECSDD_AUTO_ENABLED ?? "").trim()) };
}

/** Releja atzvans uz PROVIN: tas pats `ECSDD_RELAY_TOKEN` (abos virzienos). */
export function verifyEcsddRelayToken(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = (env.ECSDD_RELAY_TOKEN ?? "").trim();
  if (secret.length < 16) return false;
  const given = extractBearerToken(header);
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function saveStatus(sessionId: string, status: EcsddAutoStatus): Promise<EcsddAutoStatus> {
  const w = await writeEcsddAutoStatus(sessionId, status);
  if (!w.ok) console.error(`${LOG} status write failed`, { sessionId: sessionId.slice(0, 12), error: w.error });
  return status;
}

async function relayFetch(config: EcsddRelayConfig, path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, json };
}

function parseSession(raw: unknown): EcsddRelaySession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.state !== "string") return null;
  return s as unknown as EcsddRelaySession;
}

/** Releja sesijas stāvoklis (admin panelim). `null`, ja relejs nav konfigurēts vai nav sasniedzams. */
export async function fetchEcsddRelaySession(): Promise<EcsddRelaySession | null> {
  const config = readEcsddRelayConfig();
  if (!config) return null;
  try {
    const { res, json } = await relayFetch(config, "/session");
    return res.ok ? parseSession(json.session) : null;
  } catch {
    return null;
  }
}

/** Nila pogas: "Pieslēgt e.csdd" (Smart-ID) vai "Atbrīvot e.csdd" (serveris iziet, lai Nils strādā savā pārlūkā). */
export async function ecsddRelaySessionAction(
  action: "login" | "release",
  minutes?: number,
): Promise<{ ok: boolean; session: EcsddRelaySession | null; error?: string }> {
  const config = readEcsddRelayConfig();
  if (!config) return { ok: false, session: null, error: "not_configured" };
  try {
    const { res, json } = await relayFetch(config, `/${action}`, { method: "POST", body: action === "release" ? { minutes } : {} });
    if (!res.ok) return { ok: false, session: parseSession(json.session), error: typeof json.error === "string" ? json.error : `relay_${res.status}` };
    return { ok: true, session: parseSession(json.session) };
  } catch {
    return { ok: false, session: null, error: "relay_unreachable" };
  }
}

export type StartEcsddResult = { ok: boolean; status: EcsddAutoStatus | null; started: boolean };

/**
 * Sāk e.csdd uzziņu vienam pasūtījumam.
 * `auto` (pēc apmaksas) tikai ar `ECSDD_AUTO_ENABLED=1`, ja CSDD API auto atrada un RAW tukšs;
 * `manual` (poga admin) vienmēr, ja relejs konfigurēts.
 */
export async function startEcsddLookup(
  sessionId: string,
  opts: { trigger: "auto" | "manual"; orderVin?: string | null; csdd?: CsddFormFields; force?: boolean },
): Promise<StartEcsddResult> {
  const config = readEcsddRelayConfig();
  if (opts.trigger === "auto" && !config?.autoEnabled) return { ok: true, status: null, started: false };
  const prev = await readEcsddAutoStatus(sessionId);
  if (prev && isEcsddAutoActive(prev) && !opts.force) return { ok: true, status: prev, started: false };
  // Automātika vienu pasūtījumu prasa tikai vienreiz.
  if (opts.trigger === "auto" && prev) return { ok: true, status: prev, started: false };

  let csdd = opts.csdd;
  if (!csdd) {
    const draft = await readOrderDraft(sessionId);
    csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
  }
  if (opts.trigger === "auto" && !ecsddAutoShouldStart(csdd)) return { ok: true, status: null, started: false };

  const target = resolveEcsddQuery(csdd, opts.orderVin);
  if (!target) {
    const status = await saveStatus(sessionId, {
      state: "skipped",
      message: "Nav VIN vai numura e.csdd meklēšanai",
      updatedAt: nowIso(),
      trigger: opts.trigger,
    });
    return { ok: true, status, started: false };
  }

  if (!config) {
    const status = await saveStatus(sessionId, {
      state: "not_configured",
      query: target.query,
      queryKind: target.kind,
      message: "e.csdd relejs nav pieslēgts (Vercel ECSDD_RELAY_URL / ECSDD_RELAY_TOKEN)",
      updatedAt: nowIso(),
      trigger: opts.trigger,
    });
    return { ok: false, status, started: false };
  }

  const requestedAt = nowIso();
  const common = { query: target.query, queryKind: target.kind, requestedAt, trigger: opts.trigger } as const;
  try {
    const { res, json } = await relayFetch(config, "/lookup", {
      method: "POST",
      body: { query: target.query, ref: sessionId, trigger: opts.trigger },
    });
    if (!res.ok || typeof json.jobId !== "string") {
      const status = await saveStatus(sessionId, {
        ...common,
        state: "error",
        message: `e.csdd relejs atteica (${res.status}${typeof json.error === "string" ? `: ${json.error.slice(0, 80)}` : ""})`,
        updatedAt: nowIso(),
      });
      return { ok: false, status, started: false };
    }
    const session = parseSession(json.session);
    const status = await saveStatus(sessionId, {
      ...common,
      state: "queued",
      jobId: json.jobId,
      message: session?.state === "active" ? "Gaida rindā" : "Gaida e.csdd pieslēgšanos",
      updatedAt: nowIso(),
    });
    return { ok: true, status, started: true };
  } catch (e) {
    console.error(`${LOG} relay unreachable`, e instanceof Error ? e.message : "unknown");
    void recordSourceOutcomes([{ id: "ecsdd_auto", ok: false, msg: "relay_unreachable" }]).catch(() => undefined);
    const status = await saveStatus(sessionId, { ...common, state: "error", message: "e.csdd relejs nav sasniedzams", updatedAt: nowIso() });
    return { ok: false, status, started: false };
  }
}

/** Releja notikums par uzdevumu (atzvans). */
export async function handleEcsddJobEvent(
  ev: EcsddRelayJobEvent,
): Promise<{ ok: true; status: EcsddAutoStatus } | { ok: false; error: string; httpStatus: number }> {
  const sessionId = ev.ref;
  const prev = await readEcsddAutoStatus(sessionId);
  if (prev?.jobId && ev.jobId && prev.jobId !== ev.jobId) {
    // Vecs uzdevums (piem. pēc "Pieprasīt vēlreiz") - neko nepārrakstām.
    return { ok: false, error: "stale_job", httpStatus: 409 };
  }
  const now = nowIso();
  if (ev.state !== "result") {
    const status = await saveStatus(sessionId, reduceEcsddProgress(prev, ev, now));
    if (ev.state === "error") {
      void recordSourceOutcomes([{ id: "ecsdd_auto", ok: false, msg: (ev.code ?? "error").slice(0, 60) }]).catch(() => undefined);
    }
    return { ok: true, status };
  }
  const status = await saveStatus(sessionId, reduceEcsddResult(prev, ev, now));
  void recordSourceOutcomes([{ id: "ecsdd_auto", ok: status.state !== "error", msg: status.state }]).catch(() => undefined);
  return { ok: true, status };
}

/** Releja notikums par sesiju: push Nilam ar Smart-ID kontrolkodu. */
export async function handleEcsddSessionEvent(session: EcsddRelaySession): Promise<void> {
  if (session.state !== "awaiting_smartid" || !/^\d{4}$/.test(session.verificationCode ?? "")) return;
  await sendAdminPush({
    title: "e.csdd: apstiprini Smart-ID",
    body: `Kods ${session.verificationCode}. Apstiprini tikai, ja kods telefonā sakrīt. Tava e.csdd sesija citā pārlūkā tiks pārtraukta.`,
    url: "/admin",
    tag: "ecsdd-smartid",
    audience: "pro",
  });
}

/** Pēc ievietošanas CSDD blokā (automātiski vai ar pogu) - lai neievietotu otrreiz. */
export async function markEcsddAutoApplied(sessionId: string): Promise<EcsddAutoStatus | null> {
  const prev = await readEcsddAutoStatus(sessionId);
  if (!prev || prev.state !== "found") return prev;
  return saveStatus(sessionId, { ...prev, appliedAt: nowIso(), updatedAt: nowIso() });
}
