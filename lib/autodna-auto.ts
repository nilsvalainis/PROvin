import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import { sendAdminPush } from "@/lib/admin-push";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import {
  AUTODNA_PUSH_ERRORS,
  applyBalanceUpdate,
  autodnaPdfFileName,
  autodnaVinPageUrl,
  balanceIsStale,
  decideAutodnaStart,
  isPdfBytes,
  reduceAutodnaProgress,
  type AutodnaRelayJobEvent,
} from "@/lib/autodna-auto-logic";
import {
  autodnaPdfBlobPath,
  readAutodnaAutoStatus,
  readAutodnaBalance,
  writeAutodnaAutoStatus,
  writeAutodnaBalance,
  writeAutodnaPdf,
} from "@/lib/autodna-auto-store";
import type { AutodnaAutoStatus, AutodnaBalance, AutodnaSessionState } from "@/lib/autodna-auto-types";
import { authorizeAutodnaBackgroundPurchase, type AutodnaBackgroundPurchaseRequest } from "@/lib/autodna-background-purchase";
import { AUTODNA_PRECHECK_BLOCK_LV, autodnaPrecheckCountsLabel, type AutodnaPrecheckGuard } from "@/lib/autodna-purchase-guard";
import { resolveAutodnaPurchaseGuard } from "@/lib/autodna-purchase-precheck";
import { getDropboxClient } from "@/lib/dropbox-client";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";
import { orderCarFromCsdd } from "@/lib/ltab-auto";
import { saveFileToProvOrderFolder } from "@/lib/ltab-dropbox";
import { saveFileToOrderFolderOrLegacy } from "@/lib/order-dropbox";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

/**
 * AutoDNA fona pirkums (Vercel puse). Hetzner relejs `relay/provin-autodna` tur www.autodna.lv sesiju un dara pārlūka
 * darbu (kredīta pirkums, PDF); šeit: pogas pieprasījums, releja notikumi, PDF saglabāšana, atlikuma kešs.
 * AutoDNA parole Vercel nekad nenonāk - tā ir tikai releja env failā. Partnera API (lib/autodna-api.ts) netiek lietots.
 *
 * Pirkums TIKAI pēc operatora klikšķa (`explicitOperatorConfirm: true`); automātiskās plūsmas šo moduli nesasniedz
 * (tests: lib/autodna-auto.test.ts).
 */

export const AUTODNA_PDF_MAX_BYTES = 15 * 1024 * 1024;
const LOG = "[autodna-auto]";

export type AutodnaRelayConfig = { baseUrl: string; token: string };

export function readAutodnaRelayConfig(env: Record<string, string | undefined> = process.env): AutodnaRelayConfig | null {
  const baseUrl = (env.AUTODNA_RELAY_URL ?? "").trim().replace(/\/+$/, "");
  const token = (env.AUTODNA_RELAY_TOKEN ?? "").trim();
  if (!baseUrl.startsWith("https://") || token.length < 16) return null;
  return { baseUrl, token };
}

/** Releja atzvans: tas pats `AUTODNA_RELAY_TOKEN` (abos virzienos). */
export function verifyAutodnaRelayToken(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = (env.AUTODNA_RELAY_TOKEN ?? "").trim();
  if (secret.length < 16) return false;
  const given = extractBearerToken(header);
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function relayFetch(config: AutodnaRelayConfig, path: string, init?: { method?: string; body?: unknown; timeoutMs?: number }) {
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

function nowIso(): string {
  return new Date().toISOString();
}

async function saveStatus(sessionId: string, status: AutodnaAutoStatus): Promise<AutodnaAutoStatus> {
  const w = await writeAutodnaAutoStatus(sessionId, status);
  if (!w.ok) console.error(`${LOG} status write failed`, { sessionId: sessionId.slice(0, 12), error: w.error });
  return status;
}

export type StartAutodnaResult = {
  ok: boolean;
  started: boolean;
  status: AutodnaAutoStatus;
  reason?: string;
  /** Pirkums atteikts priekšpārbaudes dēļ (Nila likums 25.11) - relejam netika sūtīts. */
  precheck?: AutodnaPrecheckGuard;
};

async function startJob(
  sessionId: string,
  opts: { vin: string; kind: "purchase" | "report"; requestId: string },
  guard?: (config: AutodnaRelayConfig | null) => Promise<AutodnaPrecheckGuard>,
): Promise<StartAutodnaResult> {
  const prev = await readAutodnaAutoStatus(sessionId);
  const decision = decideAutodnaStart(prev, opts);
  if (!decision.start) return { ok: true, started: false, status: decision.status, reason: decision.reason };

  const config = readAutodnaRelayConfig();
  if (!config) {
    const status = await saveStatus(sessionId, {
      state: "not_configured",
      vin: opts.vin,
      kind: opts.kind,
      requestId: opts.requestId,
      message: "AutoDNA relejs nav pieslēgts (Vercel AUTODNA_RELAY_URL / AUTODNA_RELAY_TOKEN)",
      updatedAt: nowIso(),
    });
    return { ok: false, started: false, status };
  }
  // Pirkuma aizsargs PIRMS releja izsaukuma: bez >0 arhīva foto vai vēstures ierakstu relejam nesūta.
  let precheck: AutodnaPrecheckGuard | undefined;
  if (guard) {
    // Otrs klikšķis pārbaudes laikā redz aktīvu uzdevumu un jaunu nesāk.
    await saveStatus(sessionId, { state: "queued", vin: opts.vin, kind: opts.kind, requestId: opts.requestId, updatedAt: nowIso(), message: "Pārbauda AutoDNA priekšpārbaudi" });
    precheck = await guard(config).catch(
      (): AutodnaPrecheckGuard => ({ allowed: false, code: "precheck_unavailable", photos: null, history: null }),
    );
    if (!precheck.allowed) {
      const code = precheck.code ?? "precheck_unavailable";
      const status = await saveStatus(sessionId, {
        state: "error",
        vin: opts.vin,
        kind: opts.kind,
        requestId: opts.requestId,
        code,
        message: `${AUTODNA_PRECHECK_BLOCK_LV[code]} (${autodnaPrecheckCountsLabel(precheck)})`,
        precheck: { photos: precheck.photos, history: precheck.history, ...(precheck.checkedAt ? { checkedAt: precheck.checkedAt } : {}) },
        updatedAt: nowIso(),
      });
      return { ok: false, started: false, status, reason: code, precheck };
    }
  }
  const precheckField = precheck
    ? { precheck: { photos: precheck.photos, history: precheck.history, ...(precheck.checkedAt ? { checkedAt: precheck.checkedAt } : {}) } }
    : {};

  // Pieprasījums tiek pierakstīts PIRMS releja izsaukuma: otrs klikšķis to pašu requestId neatkārto.
  const requestedAt = nowIso();
  await saveStatus(sessionId, { state: "queued", vin: opts.vin, kind: opts.kind, requestId: opts.requestId, requestedAt, updatedAt: requestedAt, message: "Gaida rindā", ...precheckField });
  try {
    const { res, json } = await relayFetch(config, opts.kind === "purchase" ? "/purchase" : "/report", {
      method: "POST",
      body: { vin: opts.vin, ref: sessionId, requestId: opts.requestId, ...(opts.kind === "purchase" ? { confirm: true } : {}) },
    });
    if (!res.ok || typeof json.jobId !== "string") {
      const status = await saveStatus(sessionId, {
        state: "error",
        vin: opts.vin,
        kind: opts.kind,
        requestId: opts.requestId,
        requestedAt,
        code: typeof json.error === "string" ? json.error.slice(0, 60) : `relay_${res.status}`,
        message: `AutoDNA relejs atteica (${res.status})`,
        updatedAt: nowIso(),
      });
      return { ok: false, started: false, status };
    }
    const status = await saveStatus(sessionId, {
      state: "queued",
      vin: opts.vin,
      kind: opts.kind,
      requestId: opts.requestId,
      jobId: json.jobId,
      requestedAt,
      updatedAt: nowIso(),
      message: "Gaida rindā",
      ...precheckField,
    });
    return { ok: true, started: true, status };
  } catch (e) {
    console.error(`${LOG} relay unreachable`, e instanceof Error ? e.message : "unknown");
    const status = await saveStatus(sessionId, {
      state: "error",
      vin: opts.vin,
      kind: opts.kind,
      requestId: opts.requestId,
      requestedAt,
      code: "relay_unreachable",
      message: "AutoDNA relejs nav sasniedzams",
      updatedAt: nowIso(),
    });
    return { ok: false, started: false, status };
  }
}

/**
 * "Pirkt AutoDNA (fonā)": TIKAI admin poga pēc apstiprinājuma dialoga. Bez `explicitOperatorConfirm: true` - nekas.
 * Viens pirkums uz pasūtījumu/VIN; relejs pirms pirkuma pārbauda, vai VIN jau nopirkts, un kredītu atlikumu.
 */
export async function startAutodnaPurchase(
  sessionId: string,
  req: AutodnaBackgroundPurchaseRequest & { requestId?: string },
): Promise<StartAutodnaResult | { ok: false; started: false; error: "missing_confirm" | "invalid_vin" }> {
  const auth = authorizeAutodnaBackgroundPurchase(req);
  if (!auth.ok) return { ok: false, started: false, error: auth.code };
  const requestId = (req.requestId ?? "").trim().slice(0, 80) || randomUUID();
  return startJob(sessionId, { vin: auth.vin, kind: "purchase", requestId }, (config) => getAutodnaPurchasePrecheck(sessionId, auth.vin, { live: true, config }));
}

/** Releja priekšpārbaude ielogotajā pārlūkā (tikai lasīšana). */
async function relayPrecheck(config: AutodnaRelayConfig, vin: string): Promise<unknown> {
  const { res, json } = await relayFetch(config, "/precheck", { method: "POST", body: { vin }, timeoutMs: 45_000 });
  return res.ok ? json : null;
}

/**
 * Nila likums 25.11: pēdējā AutoDNA priekšpārbaude šim VIN (pirkuma pogai un aizsargam).
 * `live: false` - tikai saglabātie VIN SCAN rezultāti (bez tīkla).
 */
export async function getAutodnaPurchasePrecheck(
  sessionId: string,
  vin: string,
  opts: { live?: boolean; config?: AutodnaRelayConfig | null } = {},
): Promise<AutodnaPrecheckGuard> {
  const v = normalizeVin(vin);
  if (!isValidVin(v)) return { allowed: false, code: "precheck_unavailable", photos: null, history: null };
  const config = opts.config === undefined ? readAutodnaRelayConfig() : opts.config;
  return resolveAutodnaPurchaseGuard({
    sessionId,
    vin: v,
    live: opts.live !== false,
    ...(config && opts.live !== false ? { askRelay: (x: string) => relayPrecheck(config, x) } : {}),
  });
}

/** "Ielādēt nopirkto": jau nopirktas atskaites PDF no konta. Nekad nepērk. */
export async function startAutodnaReportDownload(
  sessionId: string,
  vin: string,
  requestId?: string,
): Promise<StartAutodnaResult | { ok: false; started: false; error: "invalid_vin" }> {
  const v = normalizeVin(vin);
  if (!isValidVin(v)) return { ok: false, started: false, error: "invalid_vin" };
  return startJob(sessionId, { vin: v, kind: "report", requestId: (requestId ?? "").trim().slice(0, 80) || randomUUID() });
}

async function storeBalance(credits: number, checkedAt?: string): Promise<AutodnaBalance> {
  const prev = await readAutodnaBalance();
  const { next, push } = applyBalanceUpdate(prev, credits, new Date(), checkedAt);
  await writeAutodnaBalance(next);
  if (push) {
    await sendAdminPush({
      title: "AutoDNA: maz kredītu",
      body: `Kontā atlikuši ${credits} ${credits === 1 ? "kredīts" : "kredīti"}. Papildini AutoDNA kontu.`,
      url: "/admin",
      tag: "autodna-credits",
      audience: "pro",
    });
  }
  return next;
}

export type AutodnaOverview = {
  relayConfigured: boolean;
  balance: AutodnaBalance | null;
  session: AutodnaSessionState;
  /** Relejs pirkuma pogu vēl nespiež (AUTODNA_PURCHASE_LIVE nav 1) - poga adminā tad netiek rādīta. */
  purchaseLive: boolean;
};

/** Atlikums adminam: kešs; ja vecāks par 30 min - pajautā relejam (tas atdod savu kešu un atjauno fonā). */
export async function getAutodnaOverview(opts: { refresh?: boolean } = {}): Promise<AutodnaOverview> {
  const config = readAutodnaRelayConfig();
  let balance = await readAutodnaBalance();
  let session: AutodnaSessionState = "unknown";
  let purchaseLive = false;
  if (!config) return { relayConfigured: false, balance, session, purchaseLive };
  const stale = Boolean(opts.refresh) || balanceIsStale(balance, new Date());
  try {
    const { json: sess } = await relayFetch(config, "/session", { timeoutMs: 3000 });
    const s = sess.session as { state?: unknown } | undefined;
    if (typeof s?.state === "string") session = s.state as AutodnaSessionState;
    purchaseLive = sess.purchaseLive === true;
    if (stale) {
      const { res, json } = await relayFetch(config, `/balance${opts.refresh ? "?refresh=1" : ""}`, { timeoutMs: 5000 });
      const b = json.balance as { credits?: unknown; checkedAt?: unknown } | undefined;
      const relayAt = typeof b?.checkedAt === "string" ? Date.parse(b.checkedAt) : NaN;
      if (res.ok && typeof b?.credits === "number" && Number.isFinite(relayAt) && relayAt > (Date.parse(balance?.checkedAt ?? "") || 0)) {
        balance = await storeBalance(b.credits, new Date(relayAt).toISOString());
      }
    }
  } catch {
    /* relejs nav sasniedzams - rādām kešu */
  }
  return { relayConfigured: true, balance, session, purchaseLive };
}

/** Nila poga "Pieslēgt AutoDNA". */
export async function autodnaLogin(): Promise<{ ok: boolean; session: AutodnaSessionState; error?: string; code?: string }> {
  const config = readAutodnaRelayConfig();
  if (!config) return { ok: false, session: "unknown", error: "not_configured" };
  try {
    const { res, json } = await relayFetch(config, "/login", { method: "POST", body: {}, timeoutMs: 55_000 });
    const s = json.session as { state?: unknown; code?: unknown } | undefined;
    return {
      ok: res.ok && json.ok === true,
      session: typeof s?.state === "string" ? (s.state as AutodnaSessionState) : "unknown",
      ...(typeof json.error === "string" ? { error: json.error.slice(0, 60) } : {}),
      ...(typeof s?.code === "string" ? { code: s.code.slice(0, 60) } : {}),
    };
  } catch {
    return { ok: false, session: "unknown", error: "relay_unreachable" };
  }
}

export type AutodnaRelayEvent =
  | AutodnaRelayJobEvent
  | { kind: "session"; state: "needs_human"; code?: string; at?: string }
  | { kind: "balance"; credits: number; at?: string };

/** Rezultāta PDF no releja (Vercel pieprasījuma ķermenis ir ~4,5 MB, tāpēc PDF neatnāk atzvanā). */
async function fetchRelayPdf(jobId: string): Promise<Uint8Array | null> {
  const config = readAutodnaRelayConfig();
  if (!config || !/^[a-f0-9-]{36}$/.test(jobId)) return null;
  try {
    const res = await fetch(`${config.baseUrl}/jobs/${jobId}/pdf`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > 0 ? buf : null;
  } catch {
    return null;
  }
}

async function saveResult(sessionId: string, prev: AutodnaAutoStatus | null, ev: AutodnaRelayJobEvent): Promise<AutodnaAutoStatus> {
  const now = nowIso();
  const base: AutodnaAutoStatus = {
    ...(prev ?? { state: "queued", updatedAt: now }),
    vin: ev.vin || prev?.vin,
    jobId: ev.jobId,
    updatedAt: now,
    existing: ev.existing === true,
  };
  delete base.appliedAt;
  delete base.pdf;
  delete base.code;
  const bytes = ev.pdfBase64 ? new Uint8Array(Buffer.from(ev.pdfBase64, "base64")) : await fetchRelayPdf(ev.jobId);
  if (!bytes || !isPdfBytes(bytes) || bytes.byteLength > AUTODNA_PDF_MAX_BYTES) {
    return saveStatus(sessionId, { ...base, state: "error", code: "bad_pdf", message: "AutoDNA atdeva bojātu PDF - lejupielādē ar roku" });
  }
  const vin = normalizeVin(ev.vin || prev?.vin || "");
  const name = autodnaPdfFileName(vin);
  const notes: string[] = [];
  const blobOk = (await writeAutodnaPdf(sessionId, bytes)).ok;
  if (!blobOk) notes.push("PDF nav saglabāts krātuvē");

  let dropboxPath: string | undefined;
  const client = getDropboxClient();
  if (client) {
    try {
      const draft = await readOrderDraft(sessionId);
      const csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
      const car = orderCarFromCsdd(csdd, "", vin || draft?.orderEdits?.vin || "");
      // Jaunie pasūtījumi: tikai sava mape (AUDITI/...); vecajiem - mape pēc VIN `/_PROv` saknē.
      const saved = await saveFileToOrderFolderOrLegacy(sessionId, name, bytes, () =>
        saveFileToProvOrderFolder(client, { ...car, vin: vin || car.vin }, name, bytes),
      );
      dropboxPath = saved.path;
    } catch (e) {
      console.error(`${LOG} dropbox save failed`, e instanceof Error ? e.message.slice(0, 200) : "unknown");
      notes.push("Dropbox neizdevās");
    }
  } else {
    notes.push("Dropbox nav konfigurēts");
  }
  if (!blobOk && !dropboxPath) {
    return saveStatus(sessionId, { ...base, state: "error", code: "store_failed", message: "PDF saņemts, bet neizdevās saglabāt" });
  }
  const status = await saveStatus(sessionId, {
    ...base,
    state: "ready",
    readyAt: now,
    message: `${ev.existing ? "Atskaite jau bija kontā - kredīts netika tērēts" : "Atskaite nopirkta ar 1 kredītu"}${notes.length ? ` · ${notes.join(", ")}` : ""}`,
    pdf: { ...(dropboxPath ? { dropboxPath } : {}), ...(blobOk ? { blobPath: autodnaPdfBlobPath(sessionId) } : {}), name, size: bytes.byteLength, savedAt: now },
  });
  await sendAdminPush({
    title: "AutoDNA: atskaite gatava",
    body: `${vin}: ${ev.existing ? "atskaite jau bija kontā" : "nopirkta ar 1 kredītu"}. Dati ievietojas pasūtījumā.`,
    url: `/admin/orders/${encodeURIComponent(sessionId)}`,
    tag: `autodna-${sessionId}`,
    audience: "pro",
  });
  return status;
}

/** Releja notikums (atzvans). */
export async function handleAutodnaRelayEvent(
  ev: AutodnaRelayEvent,
): Promise<{ ok: true; state?: string } | { ok: false; error: string; httpStatus: number }> {
  if (ev.kind === "balance") {
    await storeBalance(ev.credits, ev.at);
    return { ok: true };
  }
  if (ev.kind === "session") {
    await sendAdminPush({
      title: "AutoDNA: vajag tevi",
      body:
        ev.code === "bad_credentials"
          ? "AutoDNA neņēma paroli. Iestati paroli (autodna.lv -> Login -> Aizmirsi paroli?) un ieliec to 1Password ierakstā «www.autodna.lv»."
          : "AutoDNA pieteikšanās prasa cilvēka pārbaudi - ielogojies pats.",
      url: "/admin",
      tag: "autodna-login",
      audience: "pro",
    });
    return { ok: true };
  }
  const sessionId = ev.ref;
  const prev = await readAutodnaAutoStatus(sessionId);
  if (prev?.jobId && ev.jobId && prev.jobId !== ev.jobId) return { ok: false, error: "stale_job", httpStatus: 409 };
  if (typeof ev.credits === "number") await storeBalance(ev.credits);
  if (ev.state !== "result") {
    const status = await saveStatus(sessionId, reduceAutodnaProgress(prev, ev, nowIso()));
    if (status.state === "error" && (status.code === "turnstile" || status.code === "precheck_unavailable")) {
      await sendAdminPush({
        title: "AutoDNA: apstiprini, ka esi cilvēks",
        body: `Atver ${autodnaVinPageUrl(ev.vin)}, nospied "Verificējiet, ka esat cilvēks", tad pasūtījumā vēlreiz "Pirkt AutoDNA (fonā)".`,
        url: `/admin/orders/${encodeURIComponent(sessionId)}`,
        tag: `autodna-${sessionId}`,
        audience: "pro",
      });
    } else if (status.state === "error" && status.code && AUTODNA_PUSH_ERRORS.has(status.code)) {
      await sendAdminPush({
        title: "AutoDNA: pirkums apstājās",
        body: `${ev.vin}: ${status.message ?? status.code}`,
        url: `/admin/orders/${encodeURIComponent(sessionId)}`,
        tag: `autodna-${sessionId}`,
        audience: "pro",
      });
    }
    return { ok: true, state: status.state };
  }
  const status = await saveResult(sessionId, prev, ev);
  return { ok: true, state: status.state };
}

/** Pēc ievietošanas blokā - lai neievietotu otrreiz. */
export async function markAutodnaAutoApplied(sessionId: string): Promise<AutodnaAutoStatus | null> {
  const prev = await readAutodnaAutoStatus(sessionId);
  if (!prev || prev.state !== "ready") return prev;
  return saveStatus(sessionId, { ...prev, appliedAt: nowIso(), updatedAt: nowIso() });
}
