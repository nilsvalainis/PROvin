import "server-only";

import { timingSafeEqual } from "node:crypto";

import { sendAdminPush } from "@/lib/admin-push";
import { patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { getDropboxClient } from "@/lib/dropbox-client";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";
import { saveFileToProvOrderFolder } from "@/lib/ltab-dropbox";
import { orderCarFromCsdd } from "@/lib/ltab-auto";
import { isPdfBytes } from "@/lib/ltab-auto-logic";
import { saveFileToOrderFolderOrLegacy } from "@/lib/order-dropbox";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { recordSourceOutcomes } from "@/lib/source-health-store";
import {
  applyTraficomFiResultToBlock,
  isTraficomOrderRef,
  readTraficomFiRelayConfig,
  reduceTraficomFiProgress,
  reduceTraficomFiResult,
  traficomFiAutoPrevAllowsStart,
  traficomFiShouldKeepPreviousRaw,
  type TraficomFiRelayEvent,
} from "@/lib/traficom-fi-auto-logic";
import { readTraficomFiAutoStatus, writeTraficomFiAutoStatus } from "@/lib/traficom-fi-auto-store";
import { isTraficomFiAutoActive, type TraficomFiAutoStatus, type TraficomFiRelaySession } from "@/lib/traficom-fi-auto-types";
import { vinScanVinFromRelayRef } from "@/lib/vin-scan/v4-view";

/**
 * Traficom (Somija) automātiskā ielase (Vercel puse). Hetzner relejs `relay/provin-traficom` dara pārlūka darbu
 * (Suomi.fi eIDAS -> VISS -> eParaksts Mobile, meklēšana pēc VIN, bezmaksas dati + PDF); šeit: kad sākt, push,
 * PDF pasūtījuma Dropbox mapē, dati `traficom_fi` blokā (vecais RAW saglabāts, atjaunojams).
 * eParaksts lietotāja numurs Vercel nekad nenonāk - tas ir tikai releja env failā.
 */

export const TRAFICOM_FI_PDF_MAX_BYTES = 3 * 1024 * 1024;
const LOG = "[traficom-fi-auto]";

export { readTraficomFiRelayConfig };

/** Releja atzvans uz PROVIN: tas pats `TRAFICOM_RELAY_TOKEN` (abos virzienos). */
export function verifyTraficomFiRelayToken(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = (env.TRAFICOM_RELAY_TOKEN ?? "").trim();
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

async function saveStatus(sessionId: string, status: TraficomFiAutoStatus): Promise<TraficomFiAutoStatus> {
  const w = await writeTraficomFiAutoStatus(sessionId, status);
  if (!w.ok) console.error(`${LOG} status write failed`, { sessionId: sessionId.slice(0, 12), error: w.error });
  return status;
}

async function relayFetch(path: string, init?: { method?: string; body?: unknown; timeoutMs?: number }) {
  const config = readTraficomFiRelayConfig();
  if (!config) return null;
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

/** Releja sesija (tikai nolasa). `null` - relejs nav konfigurēts vai nav sasniedzams. */
export async function fetchTraficomFiRelaySession(): Promise<TraficomFiRelaySession | null> {
  try {
    const out = await relayFetch("/session", { timeoutMs: 6_000 });
    if (!out?.res.ok) return null;
    const s = out.json.session as TraficomFiRelaySession | undefined;
    return s && typeof s.state === "string" ? s : null;
  } catch {
    return null;
  }
}

/** «Atbrīvot sesiju»: relejs aizver pārlūku un izdzēš profilu (nākamais vaicājums prasīs eParaksts). */
export async function releaseTraficomFiRelaySession(): Promise<{ ok: boolean; session: TraficomFiRelaySession | null }> {
  try {
    const out = await relayFetch("/logout", { method: "POST", body: {}, timeoutMs: 15_000 });
    if (!out?.res.ok) return { ok: false, session: null };
    return { ok: true, session: (out.json.session as TraficomFiRelaySession | undefined) ?? null };
  } catch {
    return { ok: false, session: null };
  }
}

export type StartTraficomFiResult = { ok: boolean; status: TraficomFiAutoStatus; started: boolean };

/**
 * Sāk Traficom vaicājumu pēc VIN.
 * `auto` (pēc apmaksas / VIN SCAN ar FI pazīmēm) tikai ar `TRAFICOM_AUTO_ENABLED=1` un tikai vienreiz uz atsauci;
 * `manual` (poga «Ielasīt no reģistra» / «Pieprasīt vēlreiz») vienmēr, ja relejs konfigurēts.
 */
export async function startTraficomFiLookup(
  sessionId: string,
  opts: { trigger: "auto" | "manual"; vin: string; force?: boolean; reason?: string },
): Promise<StartTraficomFiResult> {
  const config = readTraficomFiRelayConfig();
  const vin = normalizeVin(opts.vin ?? "");
  if (opts.trigger === "auto" && !config?.autoEnabled) {
    return { ok: true, status: { state: "skipped", message: "Traficom automātika izslēgta", updatedAt: nowIso() }, started: false };
  }
  const prev = await readTraficomFiAutoStatus(sessionId);
  if (prev && isTraficomFiAutoActive(prev) && !opts.force) return { ok: true, status: prev, started: false };
  if (opts.trigger === "auto" && !traficomFiAutoPrevAllowsStart(prev)) return { ok: true, status: prev!, started: false };
  if (!isValidVin(vin)) {
    const status = await saveStatus(sessionId, { ...(prev ?? {}), state: "error", message: "Nav derīga VIN Traficom meklēšanai", updatedAt: nowIso(), trigger: opts.trigger });
    return { ok: false, status, started: false };
  }
  // Iepriekšējais RAW (atjaunošanai) paliek arī jaunā pieprasījuma laikā.
  const keep: Partial<TraficomFiAutoStatus> = {};
  if (prev?.previousRawText) keep.previousRawText = prev.previousRawText;
  if (prev?.previousRawSavedAt) keep.previousRawSavedAt = prev.previousRawSavedAt;
  if (!config) {
    const status = await saveStatus(sessionId, {
      ...keep,
      state: "not_configured",
      vin,
      message: "Traficom relejs nav pieslēgts (Vercel TRAFICOM_RELAY_URL / TRAFICOM_RELAY_TOKEN)",
      updatedAt: nowIso(),
      trigger: opts.trigger,
    });
    return { ok: false, status, started: false };
  }
  const requestedAt = nowIso();
  try {
    const out = await relayFetch("/lookup", {
      method: "POST",
      body: { vin, ref: sessionId, trigger: opts.trigger, force: opts.force === true },
    });
    const json = out?.json ?? {};
    if (!out?.res.ok || typeof json.jobId !== "string") {
      const status = await saveStatus(sessionId, {
        ...keep,
        state: "error",
        vin,
        message: `Traficom relejs atteica (${out?.res.status ?? "?"}${typeof json.error === "string" ? `: ${json.error.slice(0, 80)}` : ""})`,
        requestedAt,
        updatedAt: nowIso(),
        trigger: opts.trigger,
      });
      return { ok: false, status, started: false };
    }
    const status = await saveStatus(sessionId, {
      ...keep,
      state: "queued",
      vin,
      jobId: json.jobId,
      message: json.state === "cached" ? "Rezultāts no releja keša (≤7 d)" : "Gaida rindā",
      requestedAt,
      updatedAt: nowIso(),
      trigger: opts.trigger,
      ...(opts.reason ? { reason: opts.reason.slice(0, 80) } : {}),
    });
    return { ok: true, status, started: true };
  } catch (e) {
    const status = await saveStatus(sessionId, {
      ...keep,
      state: "error",
      vin,
      message: "Traficom relejs nav sasniedzams",
      requestedAt,
      updatedAt: nowIso(),
      trigger: opts.trigger,
    });
    console.error(`${LOG} relay unreachable`, e instanceof Error ? e.message : "unknown");
    void recordSourceOutcomes([{ id: "traficom_auto", ok: false, msg: "relay_unreachable" }]).catch(() => undefined);
    return { ok: false, status, started: false };
  }
}

export function traficomFiPdfFileName(vin: string): string {
  return `Traficom FI - ${normalizeVin(vin) || "VIN"}.pdf`;
}

async function saveTraficomPdf(sessionId: string, vin: string, bytes: Uint8Array): Promise<TraficomFiAutoStatus["pdf"]> {
  const client = getDropboxClient();
  if (!client) return undefined;
  try {
    const draft = await readOrderDraft(sessionId).catch(() => null);
    const csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
    const car = orderCarFromCsdd(csdd, csdd.registrationNumber ?? "", vin);
    const name = traficomFiPdfFileName(vin);
    const saved = await saveFileToOrderFolderOrLegacy(sessionId, name, bytes, () => saveFileToProvOrderFolder(client, car, name, bytes));
    return { dropboxPath: saved.path, name: saved.path.split("/").pop() || name, size: bytes.byteLength, savedAt: nowIso() };
  } catch (e) {
    console.error(`${LOG} dropbox save failed`, e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return undefined;
  }
}

/**
 * Ievieto Traficom datus pasūtījuma `traficom_fi` blokā (maina TIKAI šo bloku, ar revīzijas pārbaudi, līdz 3 reizēm).
 * Atgriež iepriekšējo RAW, lai to saglabātu statusā («Atjaunot iepriekšējo RAW»).
 */
export async function applyTraficomFiToOrderDraft(
  sessionId: string,
  status: TraficomFiAutoStatus,
): Promise<{ ok: true; previousRaw: string; changed: boolean } | { ok: false; error: string }> {
  const raw = (status.rawText ?? "").trim();
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
    const previousRaw = (blocks.traficom_fi.rawUnprocessedData ?? "").trim();
    if (previousRaw === raw) return { ok: true, previousRaw, changed: false };
    const traficom_fi = applyTraficomFiResultToBlock(blocks.traficom_fi, { rawText: raw, data: status.data });
    const res = await patchOrderDraft(
      sessionId,
      { workspace: { ...baseline, sourceBlocks: { ...blocks, traficom_fi } } },
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

function adminUrlFor(ref: string): string {
  const vsVin = vinScanVinFromRelayRef(ref);
  if (vsVin) return `/admin/vin-scan?vin=${encodeURIComponent(vsVin)}`;
  return `/admin/orders/${encodeURIComponent(ref)}`;
}

/** Releja notikums (atzvans). */
export async function handleTraficomFiRelayEvent(
  ev: TraficomFiRelayEvent,
): Promise<{ ok: true; status: TraficomFiAutoStatus } | { ok: false; error: string; httpStatus: number }> {
  const sessionId = ev.ref;
  const prev = await readTraficomFiAutoStatus(sessionId);
  // Kešots rezultāts nāk ar jaunu jobId (relejs atbild uzreiz) - to pieņem, ja gaidām rezultātu.
  if (prev?.jobId && ev.jobId && prev.jobId !== ev.jobId) return { ok: false, error: "stale_job", httpStatus: 409 };
  const now = nowIso();
  const adminUrl = adminUrlFor(sessionId);

  if (ev.state !== "result") {
    const status = await saveStatus(sessionId, reduceTraficomFiProgress(prev, ev, now));
    if (ev.state === "awaiting_eparaksts") {
      await sendAdminPush({
        title: "Traficom: apstiprini eParaksts",
        body: status.verificationCode
          ? `Kods ${status.verificationCode}. Apstiprini eParaksts mobile tikai, ja kods sakrīt.`
          : "Apstiprini pieteikšanos eParaksts mobile lietotnē (Somijas Traficom, 5 min).",
        url: adminUrl,
        tag: "traficom-eparaksts",
        audience: "pro",
      });
    }
    if (ev.state === "error") {
      void recordSourceOutcomes([{ id: "traficom_auto", ok: false, msg: (ev.code ?? "error").slice(0, 60) }]).catch(() => undefined);
    }
    return { ok: true, status };
  }

  let status = reduceTraficomFiResult(prev, ev, now);
  // Iepriekšējais RAW paliek no iepriekšējās ievietošanas.
  if (prev?.previousRawText) status = { ...status, previousRawText: prev.previousRawText, previousRawSavedAt: prev.previousRawSavedAt };

  const bytes = ev.pdfBase64 ? new Uint8Array(Buffer.from(ev.pdfBase64, "base64")) : null;
  const orderRef = isTraficomOrderRef(sessionId);
  if (status.state === "found" && bytes && orderRef && isPdfBytes(bytes) && bytes.byteLength <= TRAFICOM_FI_PDF_MAX_BYTES) {
    const pdf = await saveTraficomPdf(sessionId, status.vin ?? ev.vin, bytes);
    if (pdf) status = { ...status, pdf };
  }

  if (status.state === "found" && status.rawText && orderRef) {
    // Kā e.csdd (#1277): dati blokā automātiski; vecais RAW saglabāts statusā.
    const applied = await applyTraficomFiToOrderDraft(sessionId, status).catch(() => ({ ok: false as const, error: "exception" }));
    if (applied.ok) {
      status = {
        ...status,
        appliedAt: now,
        appliedBy: "auto",
        message: `${status.cached ? "Traficom dati (kešs)" : "Traficom dati"} ievietoti blokā automātiski`,
        ...(traficomFiShouldKeepPreviousRaw(applied.previousRaw, status.rawText ?? "")
          ? { previousRawText: applied.previousRaw.slice(0, 60_000), previousRawSavedAt: now }
          : {}),
      };
    } else {
      status = { ...status, message: "Traficom dati saņemti - spied «Ievietot datus»" };
    }
  }
  status = await saveStatus(sessionId, status);

  const red = status.data?.flags.filter((f) => f.level === "red") ?? [];
  if (status.state === "found" && red.length) {
    await sendAdminPush({
      title: "Traficom: sarkanie karogi",
      body: `${status.vin ?? ""}: ${red
        .map((f) => f.text)
        .join("; ")
        .slice(0, 160)}`,
      url: adminUrl,
      tag: `traficom-${sessionId}`,
      audience: "pro",
    });
  }
  void recordSourceOutcomes([{ id: "traficom_auto", ok: status.state !== "error", msg: status.state }]).catch(() => undefined);
  return { ok: true, status };
}

/**
 * Poga «Ievietot datus» (klients ievieto ar to pašu funkciju): atzīmē un saglabā iepriekšējo RAW.
 * `restore` - «Atjaunot iepriekšējo RAW» (pēc tam automātika datus vairs neievieto).
 */
export async function markTraficomFiApplied(
  sessionId: string,
  opts: { previousRawText?: string; action?: "apply" | "restore" } = {},
): Promise<TraficomFiAutoStatus | null> {
  const prev = await readTraficomFiAutoStatus(sessionId);
  if (!prev || prev.state !== "found") return prev;
  const now = nowIso();
  if (opts.action === "restore") {
    const next: TraficomFiAutoStatus = { ...prev, restoredAt: now, updatedAt: now, message: "Atjaunots iepriekšējais RAW" };
    delete next.appliedAt;
    delete next.appliedBy;
    return saveStatus(sessionId, next);
  }
  const before = (opts.previousRawText ?? "").trim();
  const next: TraficomFiAutoStatus = {
    ...prev,
    appliedAt: now,
    appliedBy: "manual",
    updatedAt: now,
    message: "Traficom dati ievietoti blokā",
    ...(traficomFiShouldKeepPreviousRaw(before, prev.rawText ?? "") ? { previousRawText: before.slice(0, 60_000), previousRawSavedAt: now } : {}),
  };
  delete next.restoredAt;
  return saveStatus(sessionId, next);
}
