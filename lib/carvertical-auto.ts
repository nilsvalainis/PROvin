import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import { sendAdminPush } from "@/lib/admin-push";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import {
  applyBalanceUpdate,
  balanceIsStale,
  carverticalPdfFileName,
  decideStart,
  isPdfBytes,
  reduceCarverticalProgress,
  type CarverticalRelayJobEvent,
} from "@/lib/carvertical-auto-logic";
import {
  carverticalPdfBlobPath,
  readCarverticalAutoStatus,
  readCarverticalBalance,
  writeCarverticalAutoStatus,
  writeCarverticalBalance,
  writeCarverticalPdf,
} from "@/lib/carvertical-auto-store";
import type { CarverticalAutoStatus, CarverticalBalance, CarverticalSessionState } from "@/lib/carvertical-auto-types";
import { authorizeCarVerticalBackgroundPurchase, type CarVerticalPurchaseRequest } from "@/lib/carvertical-purchase";
import { getDropboxClient } from "@/lib/dropbox-client";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";
import { orderCarFromCsdd } from "@/lib/ltab-auto";
import { saveFileToProvOrderFolder } from "@/lib/ltab-dropbox";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

/**
 * CarVertical fona pirkums (Vercel puse). Hetzner relejs `relay/provin-carvertical` tur CarVertical sesiju un dara
 * pārlūka darbu (kredīta pirkums, PDF); šeit: pogas pieprasījums, releja notikumi, PDF saglabāšana, atlikuma kešs.
 * CarVertical parole Vercel nekad nenonāk - tā ir tikai releja env failā.
 *
 * Pirkums TIKAI pēc operatora klikšķa (`explicitOperatorConfirm: true`); automātiskās plūsmas šo moduli nesasniedz
 * (tests: lib/carvertical-auto.test.ts).
 */

export const CARVERTICAL_PDF_MAX_BYTES = 15 * 1024 * 1024;
const LOG = "[carvertical-auto]";

export type CarverticalRelayConfig = { baseUrl: string; token: string };

export function readCarverticalRelayConfig(env: Record<string, string | undefined> = process.env): CarverticalRelayConfig | null {
  const baseUrl = (env.CARVERTICAL_RELAY_URL ?? "").trim().replace(/\/+$/, "");
  const token = (env.CARVERTICAL_RELAY_TOKEN ?? "").trim();
  if (!baseUrl.startsWith("https://") || token.length < 16) return null;
  return { baseUrl, token };
}

/** Releja atzvans: tas pats `CARVERTICAL_RELAY_TOKEN` (abos virzienos). */
export function verifyCarverticalRelayToken(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = (env.CARVERTICAL_RELAY_TOKEN ?? "").trim();
  if (secret.length < 16) return false;
  const given = extractBearerToken(header);
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function relayFetch(config: CarverticalRelayConfig, path: string, init?: { method?: string; body?: unknown; timeoutMs?: number }) {
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

async function saveStatus(sessionId: string, status: CarverticalAutoStatus): Promise<CarverticalAutoStatus> {
  const w = await writeCarverticalAutoStatus(sessionId, status);
  if (!w.ok) console.error(`${LOG} status write failed`, { sessionId: sessionId.slice(0, 12), error: w.error });
  return status;
}

export type StartCarverticalResult = { ok: boolean; started: boolean; status: CarverticalAutoStatus; reason?: string };

async function startJob(
  sessionId: string,
  opts: { vin: string; kind: "purchase" | "report"; requestId: string },
): Promise<StartCarverticalResult> {
  const prev = await readCarverticalAutoStatus(sessionId);
  const decision = decideStart(prev, opts);
  if (!decision.start) return { ok: true, started: false, status: decision.status, reason: decision.reason };

  const config = readCarverticalRelayConfig();
  if (!config) {
    const status = await saveStatus(sessionId, {
      state: "not_configured",
      vin: opts.vin,
      kind: opts.kind,
      requestId: opts.requestId,
      message: "CarVertical relejs nav pieslēgts (Vercel CARVERTICAL_RELAY_URL / CARVERTICAL_RELAY_TOKEN)",
      updatedAt: nowIso(),
    });
    return { ok: false, started: false, status };
  }
  // Pieprasījums tiek pierakstīts PIRMS releja izsaukuma: otrs klikšķis to pašu requestId neatkārto.
  const requestedAt = nowIso();
  await saveStatus(sessionId, { state: "queued", vin: opts.vin, kind: opts.kind, requestId: opts.requestId, requestedAt, updatedAt: requestedAt, message: "Gaida rindā" });
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
        message: `CarVertical relejs atteica (${res.status})`,
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
      message: "CarVertical relejs nav sasniedzams",
      updatedAt: nowIso(),
    });
    return { ok: false, started: false, status };
  }
}

/**
 * "Pirkt CarVertical (fonā)": TIKAI admin poga pēc apstiprinājuma dialoga. Bez `explicitOperatorConfirm: true` - nekas.
 * Viens pirkums uz pasūtījumu/VIN; relejs pirms pirkuma pārbauda "Manas atskaites" un kredītu atlikumu.
 */
export async function startCarverticalPurchase(
  sessionId: string,
  req: CarVerticalPurchaseRequest & { requestId?: string },
): Promise<StartCarverticalResult | { ok: false; started: false; error: "missing_confirm" | "invalid_vin" }> {
  const auth = authorizeCarVerticalBackgroundPurchase(req);
  if (!auth.ok) return { ok: false, started: false, error: auth.code };
  const requestId = (req.requestId ?? "").trim().slice(0, 80) || randomUUID();
  return startJob(sessionId, { vin: auth.vin, kind: "purchase", requestId });
}

/** "Ielādēt nopirkto": jau nopirktas atskaites PDF no konta. Nekad nepērk. */
export async function startCarverticalReportDownload(sessionId: string, vin: string, requestId?: string): Promise<StartCarverticalResult | { ok: false; started: false; error: "invalid_vin" }> {
  const v = normalizeVin(vin);
  if (!isValidVin(v)) return { ok: false, started: false, error: "invalid_vin" };
  return startJob(sessionId, { vin: v, kind: "report", requestId: (requestId ?? "").trim().slice(0, 80) || randomUUID() });
}

async function storeBalance(credits: number, checkedAt?: string): Promise<CarverticalBalance> {
  const prev = await readCarverticalBalance();
  const { next, push } = applyBalanceUpdate(prev, credits, new Date(), checkedAt);
  await writeCarverticalBalance(next);
  if (push) {
    await sendAdminPush({
      title: "CarVertical: maz kredītu",
      body: `Kontā atlikuši ${credits} ${credits === 1 ? "kredīts" : "kredīti"}. Papildini CarVertical kontu.`,
      url: "/admin",
      tag: "carvertical-credits",
      audience: "pro",
    });
  }
  return next;
}

export type CarverticalOverview = {
  relayConfigured: boolean;
  balance: CarverticalBalance | null;
  session: CarverticalSessionState;
};

/** Atlikums adminam: kešs; ja vecāks par 30 min - pajautā relejam (tas atdod savu kešu un atjauno fonā). */
export async function getCarverticalOverview(opts: { refresh?: boolean } = {}): Promise<CarverticalOverview> {
  const config = readCarverticalRelayConfig();
  let balance = await readCarverticalBalance();
  let session: CarverticalSessionState = "unknown";
  if (!config) return { relayConfigured: false, balance, session };
  if (opts.refresh || balanceIsStale(balance, new Date())) {
    try {
      const { res, json } = await relayFetch(config, `/balance${opts.refresh ? "?refresh=1" : ""}`, { timeoutMs: 5000 });
      const b = json.balance as { credits?: unknown; checkedAt?: unknown } | undefined;
      const s = (json.session as { state?: unknown } | undefined)?.state;
      if (typeof s === "string") session = s as CarverticalSessionState;
      const relayAt = typeof b?.checkedAt === "string" ? Date.parse(b.checkedAt) : NaN;
      if (res.ok && typeof b?.credits === "number" && Number.isFinite(relayAt) && relayAt > (Date.parse(balance?.checkedAt ?? "") || 0)) {
        balance = await storeBalance(b.credits, new Date(relayAt).toISOString());
      }
    } catch {
      /* relejs nav sasniedzams - rādām kešu */
    }
  }
  return { relayConfigured: true, balance, session };
}

/** Nila pogas: "Pieslēgt CarVertical" (CarVertical sūta kodu uz e-pastu) un koda ievade. */
export async function carverticalSessionAction(
  action: "login" | "code",
  code?: string,
): Promise<{ ok: boolean; session: CarverticalSessionState; error?: string }> {
  const config = readCarverticalRelayConfig();
  if (!config) return { ok: false, session: "unknown", error: "not_configured" };
  try {
    const { res, json } = await relayFetch(config, action === "login" ? "/login" : "/login/code", {
      method: "POST",
      body: action === "code" ? { code: String(code ?? "") } : {},
      timeoutMs: 55_000,
    });
    const state = (json.session as { state?: unknown } | undefined)?.state;
    return {
      ok: res.ok && json.ok === true,
      session: typeof state === "string" ? (state as CarverticalSessionState) : "unknown",
      ...(typeof json.error === "string" ? { error: json.error.slice(0, 60) } : {}),
    };
  } catch {
    return { ok: false, session: "unknown", error: "relay_unreachable" };
  }
}

export type CarverticalRelayEvent =
  | CarverticalRelayJobEvent
  | { kind: "session"; state: "awaiting_code" | "needs_human"; code?: string; at?: string }
  | { kind: "balance"; credits: number; at?: string };

/** Rezultāta PDF no releja (Vercel pieprasījuma ķermenis ir ~4,5 MB, tāpēc PDF neatnāk atzvanā). */
async function fetchRelayPdf(jobId: string): Promise<Uint8Array | null> {
  const config = readCarverticalRelayConfig();
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

async function saveResult(sessionId: string, prev: CarverticalAutoStatus | null, ev: CarverticalRelayJobEvent): Promise<CarverticalAutoStatus> {
  const now = nowIso();
  const base: CarverticalAutoStatus = {
    ...(prev ?? { state: "queued", updatedAt: now }),
    vin: ev.vin || prev?.vin,
    jobId: ev.jobId,
    updatedAt: now,
    ...(ev.reportId ? { reportId: ev.reportId } : {}),
    existing: ev.existing === true,
  };
  delete base.appliedAt;
  delete base.pdf;
  delete base.code;
  const bytes = ev.pdfBase64 ? new Uint8Array(Buffer.from(ev.pdfBase64, "base64")) : await fetchRelayPdf(ev.jobId);
  if (!bytes || !isPdfBytes(bytes) || bytes.byteLength > CARVERTICAL_PDF_MAX_BYTES) {
    return saveStatus(sessionId, { ...base, state: "error", code: "bad_pdf", message: "CarVertical atdeva bojātu PDF - lejupielādē ar roku" });
  }
  const vin = normalizeVin(ev.vin || prev?.vin || "");
  const name = carverticalPdfFileName(vin);
  const notes: string[] = [];
  const blobOk = (await writeCarverticalPdf(sessionId, bytes)).ok;
  if (!blobOk) notes.push("PDF nav saglabāts krātuvē");

  let dropboxPath: string | undefined;
  const client = getDropboxClient();
  if (client) {
    try {
      const draft = await readOrderDraft(sessionId);
      const csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
      const car = orderCarFromCsdd(csdd, "", vin || draft?.orderEdits?.vin || "");
      const saved = await saveFileToProvOrderFolder(client, { ...car, vin: vin || car.vin }, name, bytes);
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
    pdf: { ...(dropboxPath ? { dropboxPath } : {}), ...(blobOk ? { blobPath: carverticalPdfBlobPath(sessionId) } : {}), name, size: bytes.byteLength, savedAt: now },
  });
  await sendAdminPush({
    title: "CarVertical: atskaite gatava",
    body: `${vin}: ${ev.existing ? "atskaite jau bija kontā" : "nopirkta ar 1 kredītu"}. Dati ievietojas pasūtījumā.`,
    url: `/admin/orders/${encodeURIComponent(sessionId)}`,
    tag: `carvertical-${sessionId}`,
    audience: "pro",
  });
  return status;
}

/** Releja notikums (atzvans). */
export async function handleCarverticalRelayEvent(
  ev: CarverticalRelayEvent,
): Promise<{ ok: true; state?: string } | { ok: false; error: string; httpStatus: number }> {
  if (ev.kind === "balance") {
    await storeBalance(ev.credits, ev.at);
    return { ok: true };
  }
  if (ev.kind === "session") {
    await sendAdminPush({
      title: ev.state === "awaiting_code" ? "CarVertical: ievadi kodu" : "CarVertical: vajag tevi",
      body:
        ev.state === "awaiting_code"
          ? "CarVertical nosūtīja pieteikšanās kodu uz konta e-pastu. Ievadi to pasūtījuma CarVertical blokā."
          : "CarVertical prasa captcha vai citu pārbaudi - ielogojies pats.",
      url: "/admin",
      tag: "carvertical-login",
      audience: "pro",
    });
    return { ok: true };
  }
  const sessionId = ev.ref;
  const prev = await readCarverticalAutoStatus(sessionId);
  if (prev?.jobId && ev.jobId && prev.jobId !== ev.jobId) return { ok: false, error: "stale_job", httpStatus: 409 };
  if (typeof ev.credits === "number") await storeBalance(ev.credits);
  if (ev.state !== "result") {
    const status = await saveStatus(sessionId, reduceCarverticalProgress(prev, ev, nowIso()));
    return { ok: true, state: status.state };
  }
  const status = await saveResult(sessionId, prev, ev);
  return { ok: true, state: status.state };
}

/** Pēc ievietošanas blokā - lai neievietotu otrreiz. */
export async function markCarverticalAutoApplied(sessionId: string): Promise<CarverticalAutoStatus | null> {
  const prev = await readCarverticalAutoStatus(sessionId);
  if (!prev || prev.state !== "ready") return prev;
  return saveStatus(sessionId, { ...prev, appliedAt: nowIso(), updatedAt: nowIso() });
}
