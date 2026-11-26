import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { sendAdminPush } from "@/lib/admin-push";
import { patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults, type CsddFormFields } from "@/lib/admin-source-blocks";
import { applyCsddPasteToForm, backfillCsddExtendedFromRaw, parseCsddPaste } from "@/lib/csdd-paste-parse";
import {
  ECSDD_SMARTID_RETRY_CODES,
  ecsddAutoPrevAllowsStart,
  ecsddAutoShouldStart,
  ecsddSmartIdExpired,
  ecsddSmartIdExpiredStatus,
  reduceEcsddProgress,
  reduceEcsddResult,
  resolveEcsddQuery,
  type EcsddRelayJobEvent,
} from "@/lib/ecsdd-auto-logic";
import {
  readEcsddAutoStatus,
  readEcsddSmartIdRetryIndex,
  writeEcsddAutoStatus,
  writeEcsddSmartIdRetryIndex,
} from "@/lib/ecsdd-auto-store";
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

export async function relayFetch(
  config: EcsddRelayConfig,
  path: string,
  init?: { method?: string; body?: unknown; timeoutMs?: number },
) {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(init?.timeoutMs ?? 10_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, json };
}

export function parseSession(raw: unknown): EcsddRelaySession | null {
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

/** Īss teksta hash (salīdzināšanai, ne drošībai). */
export function ecsddRawHash(text: string): string {
  return createHash("sha1").update(text.trim()).digest("hex").slice(0, 16);
}

/** Vai pirms ievietošanas esošais RAW jāsaglabā kā «iepriekšējais» (nav tukšs, nav tas pats / vecāks e.csdd teksts). */
export function ecsddShouldKeepPreviousRaw(before: string, rawText: string, appliedRawHash: string | undefined): boolean {
  const b = before.trim();
  if (!b || b === rawText.trim()) return false;
  return !appliedRawHash || ecsddRawHash(b) !== appliedRawHash;
}

/** Pasūtījuma ref (ne ātrā vērtējuma `qe_` / VIN SCAN `vs_`): tikai tiem e.csdd tekstu ievieto darba vietā. */
export function isEcsddOrderRef(ref: string): boolean {
  return !/^(qe|vs)_/.test(ref);
}

/**
 * Sāk e.csdd uzziņu vienam pasūtījumam.
 * `auto` (pēc pasūtījuma apstrādes) tikai ar `ECSDD_AUTO_ENABLED=1`, ja CSDD API auto atrada vai ir LV numurs;
 * vienu pasūtījumu automātika prasa tikai vienreiz (`resume` - tikai pēc veiksmīgas pieteikšanās, bez jauna Smart-ID).
 * `manual` (poga admin) vienmēr, ja relejs konfigurēts.
 */
export async function startEcsddLookup(
  sessionId: string,
  opts: { trigger: "auto" | "manual"; orderVin?: string | null; csdd?: CsddFormFields; force?: boolean; resume?: boolean },
): Promise<StartEcsddResult> {
  const config = readEcsddRelayConfig();
  if (opts.trigger === "auto" && !config?.autoEnabled) return { ok: true, status: null, started: false };
  const prev = await readEcsddAutoStatus(sessionId);
  if (prev && isEcsddAutoActive(prev) && !opts.force) return { ok: true, status: prev, started: false };
  // Automātika vienu pasūtījumu prasa tikai vienreiz.
  if (opts.trigger === "auto" && !opts.resume && !ecsddAutoPrevAllowsStart(prev)) return { ok: true, status: prev, started: false };
  // Iepriekšējais RAW (pirms e.csdd) paliek atjaunojams arī pēc atkārtota pieprasījuma.
  const keep: Partial<EcsddAutoStatus> = {};
  if (prev?.previousRawText) keep.previousRawText = prev.previousRawText;
  if (prev?.previousRawSavedAt) keep.previousRawSavedAt = prev.previousRawSavedAt;
  if (prev?.appliedRawHash) keep.appliedRawHash = prev.appliedRawHash;

  let csdd = opts.csdd;
  if (!csdd) {
    const draft = await readOrderDraft(sessionId);
    csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
  }
  if (opts.trigger === "auto" && !opts.resume && !ecsddAutoShouldStart(csdd)) return { ok: true, status: null, started: false };

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
  const common = { ...keep, query: target.query, queryKind: target.kind, requestedAt, trigger: opts.trigger } as const;
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

/**
 * e.csdd teksts -> CSDD bloks pasūtījuma darba vietā (serverī, tas pats RAW parseris, ko Nila ielīmējums / poga).
 * Maina TIKAI `sourceBlocks.csdd`, ar revīzijas pārbaudi (konflikts -> nolasa no jauna, līdz 3 reizēm);
 * melnraksta Blob revīziju raksta `patchOrderDraft` (#1216). Atgriež iepriekšējo RAW, lai to saglabātu statusā.
 */
export async function applyEcsddRawToOrderDraft(
  sessionId: string,
  rawText: string,
): Promise<{ ok: true; previousRaw: string; changed: boolean } | { ok: false; error: string }> {
  const raw = rawText.trim();
  if (!raw) return { ok: false, error: "empty" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const draft = await readOrderDraft(sessionId).catch(() => null);
    const baseline = draft?.workspace ?? {
      sourceBlocks: createDefaultSourceBlocks(),
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
    };
    const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
    const previousRaw = (blocks.csdd.rawUnprocessedData ?? "").trim();
    if (previousRaw === raw) return { ok: true, previousRaw, changed: false };
    const csdd = backfillCsddExtendedFromRaw(applyCsddPasteToForm(blocks.csdd, raw, parseCsddPaste(raw)));
    const res = await patchOrderDraft(
      sessionId,
      { workspace: { ...baseline, sourceBlocks: { ...blocks, csdd } } },
      draft?.workspaceRevision ? { expectedWorkspaceRevision: draft.workspaceRevision } : {},
    );
    if (res.ok) return { ok: true, previousRaw, changed: true };
    if (res.error !== "stale_revision") {
      console.error(`${LOG} apply failed`, { sessionId: sessionId.slice(-8), error: res.error });
      return { ok: false, error: res.error };
    }
  }
  return { ok: false, error: "stale_revision" };
}

/** Pasūtījumu ar neapstiprinātu Smart-ID pieraksta, lai pēc nākamās pieteikšanās to ieliktu rindā no jauna. */
async function rememberSmartIdRetry(ref: string, query: string): Promise<void> {
  if (!isEcsddOrderRef(ref)) return;
  const list = await readEcsddSmartIdRetryIndex().catch(() => []);
  if (list.some((e) => e.ref === ref)) return;
  await writeEcsddSmartIdRetryIndex([...list, { ref, query, at: nowIso() }]).catch(() => undefined);
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
      if (ECSDD_SMARTID_RETRY_CODES.includes(ev.code ?? "")) await rememberSmartIdRetry(sessionId, ev.query);
    }
    return { ok: true, status };
  }
  let status = reduceEcsddResult(prev, ev, now);
  if (status.state === "found" && status.rawText && isEcsddOrderRef(sessionId)) {
    // Nila 26.11: e.csdd dati CSDD blokā automātiski (bez apstiprinājuma); vecais RAW saglabāts statusā + revīzijā.
    const applied = await applyEcsddRawToOrderDraft(sessionId, status.rawText).catch(() => ({ ok: false as const, error: "exception" }));
    if (applied.ok) {
      const keepPrev = ecsddShouldKeepPreviousRaw(applied.previousRaw, status.rawText, prev?.appliedRawHash);
      status = {
        ...status,
        appliedAt: now,
        appliedBy: "auto",
        appliedRawHash: ecsddRawHash(status.rawText),
        message: "e.csdd dati ievietoti CSDD blokā automātiski",
        ...(keepPrev ? { previousRawText: applied.previousRaw.slice(0, 60_000), previousRawSavedAt: now } : {}),
      };
    } else {
      status = { ...status, message: "e.csdd dati saņemti - spied \"Ievietot e.csdd datus\"" };
    }
  }
  status = await saveStatus(sessionId, status);
  void recordSourceOutcomes([{ id: "ecsdd_auto", ok: status.state !== "error", msg: status.state }]).catch(() => undefined);
  return { ok: true, status };
}

/** Pēc 5 min bez Smart-ID apstiprinājuma: «Smart-ID neapstiprināts» (+ rindā no jauna pēc nākamās pieteikšanās). */
export async function expireStaleEcsddSmartId(sessionId: string, status: EcsddAutoStatus | null): Promise<EcsddAutoStatus | null> {
  if (!status || !ecsddSmartIdExpired(status, Date.now())) return status;
  const next = await saveStatus(sessionId, ecsddSmartIdExpiredStatus(status, nowIso()));
  if (status.query) await rememberSmartIdRetry(sessionId, status.query);
  return next;
}

/**
 * Serveris atkal ielogojies (Nila «Mēģināt vēlreiz» vai rīta pieteikšanās): visus pasūtījumus, kuru uzziņa beidzās
 * ar neapstiprinātu Smart-ID, ieliek rindā no jauna - aktīvā sesijā tie iet bez jauna Smart-ID.
 */
export async function resumeEcsddSmartIdRetries(): Promise<number> {
  const list = await readEcsddSmartIdRetryIndex().catch(() => []);
  if (!list.length) return 0;
  await writeEcsddSmartIdRetryIndex([]).catch(() => undefined);
  const cutoff = Date.now() - 24 * 3_600_000;
  let started = 0;
  for (const e of list) {
    if (Date.parse(e.at) < cutoff) continue;
    const cur = await readEcsddAutoStatus(e.ref).catch(() => null);
    // Jau atrasts / Nils pats pieprasīja no jauna - neaiztiek.
    if (cur && (cur.state === "found" || cur.state === "not_found" || isEcsddAutoActive(cur))) continue;
    const r = await startEcsddLookup(e.ref, { trigger: "auto", resume: true, orderVin: cur?.query || e.query }).catch(() => null);
    if (r?.started) started++;
  }
  return started;
}

/** Releja notikums par sesiju: push Nilam ar Smart-ID kontrolkodu. */
export async function handleEcsddSessionEvent(session: EcsddRelaySession): Promise<void> {
  if (session.state === "active") {
    await resumeEcsddSmartIdRetries().catch((e) => console.error(`${LOG} resume failed`, e instanceof Error ? e.message : "unknown"));
    return;
  }
  if (session.state !== "awaiting_smartid" || !/^\d{4}$/.test(session.verificationCode ?? "")) return;
  await sendAdminPush({
    title: "e.csdd: apstiprini Smart-ID",
    body: `Kods ${session.verificationCode}. Apstiprini tikai, ja kods telefonā sakrīt. Tava e.csdd sesija citā pārlūkā tiks pārtraukta.`,
    url: "/admin",
    tag: "ecsdd-smartid",
    audience: "pro",
  });
}

/**
 * Poga «Ievietot e.csdd datus» (klients ievieto ar to pašu parseri): atzīmē un saglabā iepriekšējo RAW,
 * lai to varētu atjaunot. `restore` - «Atjaunot iepriekšējo RAW» (pēc tam automātika tekstu neievieto).
 */
export async function markEcsddAutoApplied(
  sessionId: string,
  opts: { previousRawText?: string; action?: "apply" | "restore" } = {},
): Promise<EcsddAutoStatus | null> {
  const prev = await readEcsddAutoStatus(sessionId);
  if (!prev || prev.state !== "found") return prev;
  const now = nowIso();
  if (opts.action === "restore") {
    const next: EcsddAutoStatus = { ...prev, restoredAt: now, updatedAt: now, message: "Atjaunots iepriekšējais RAW" };
    delete next.appliedAt;
    delete next.appliedBy;
    return saveStatus(sessionId, next);
  }
  const before = (opts.previousRawText ?? "").trim();
  const raw = prev.rawText ?? "";
  const next: EcsddAutoStatus = {
    ...prev,
    appliedAt: now,
    appliedBy: "manual",
    ...(raw.trim() ? { appliedRawHash: ecsddRawHash(raw) } : {}),
    updatedAt: now,
    message: "e.csdd dati ievietoti CSDD blokā",
    ...(ecsddShouldKeepPreviousRaw(before, raw, prev.appliedRawHash) ? { previousRawText: before.slice(0, 60_000), previousRawSavedAt: now } : {}),
  };
  delete next.restoredAt;
  return saveStatus(sessionId, next);
}
