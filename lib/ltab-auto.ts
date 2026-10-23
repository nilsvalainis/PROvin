import "server-only";

import { timingSafeEqual } from "node:crypto";

import { sendAdminPush } from "@/lib/admin-push";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults, type CsddFormFields } from "@/lib/admin-source-blocks";
import { getDropboxClient } from "@/lib/dropbox-client";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";
import { runLtabPdfAgent } from "@/lib/copilot-vendor-pdf-agent";
import {
  isPdfBytes,
  ltabCertificateHasClaims,
  ltabCertificateMismatch,
  reduceLtabProgress,
  type LtabRelayEvent,
} from "@/lib/ltab-auto-logic";
import { readLtabAutoStatus, writeLtabAutoStatus } from "@/lib/ltab-auto-store";
import { isLtabAutoActive, type LtabAutoStatus } from "@/lib/ltab-auto-types";
import { saveLtabPdfToOrderFolder } from "@/lib/ltab-dropbox";
import { LTAB_SKIP_REASON_LV, resolveLtabQueryTarget } from "@/lib/ltab-query-target";
import { normalizeVin } from "@/lib/order-field-validation";
import type { LtabCertificate } from "@/lib/ltab-report-extract";
import { recordSourceOutcomes } from "@/lib/source-health-store";

/**
 * LTAB automātiskā izziņa (Vercel puse). Hetzner relejs `relay/provin-ltab` dara pārlūka darbu
 * (latvija.lv Smart-ID, meklēšana pēc numurzīmes, PDF), šeit: kad sākt, push ar kontrolkodu,
 * oriģinālā PDF saglabāšana pasūtījuma Dropbox mapē un izziņas nolasīšana.
 * Smart-ID personas kods Vercel nekad nenonāk - tas ir tikai releja env failā.
 */

export const LTAB_PDF_MAX_BYTES = 3 * 1024 * 1024;
const LOG = "[ltab-auto]";

export type LtabRelayConfig = { baseUrl: string; token: string; autoEnabled: boolean };

export function readLtabRelayConfig(env: Record<string, string | undefined> = process.env): LtabRelayConfig | null {
  const baseUrl = (env.LTAB_RELAY_URL ?? "").trim().replace(/\/+$/, "");
  const token = (env.LTAB_RELAY_TOKEN ?? "").trim();
  if (!baseUrl.startsWith("https://") || token.length < 16) return null;
  return { baseUrl, token, autoEnabled: /^(1|true|yes)$/i.test((env.LTAB_AUTO_ENABLED ?? "").trim()) };
}

/** Releja atzvans uz PROVIN: tas pats `LTAB_RELAY_TOKEN` (abos virzienos). */
export function verifyLtabRelayToken(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = (env.LTAB_RELAY_TOKEN ?? "").trim();
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

async function saveStatus(sessionId: string, status: LtabAutoStatus): Promise<LtabAutoStatus> {
  const w = await writeLtabAutoStatus(sessionId, status);
  if (!w.ok) console.error(`${LOG} status write failed`, { sessionId: sessionId.slice(0, 12), error: w.error });
  return status;
}

export type StartLtabResult = { ok: boolean; status: LtabAutoStatus; started: boolean };

/**
 * Sāk LTAB pieprasījumu vienam pasūtījumam.
 * `auto` (pēc apmaksas) strādā tikai ar `LTAB_AUTO_ENABLED=1`; `manual` (poga admin) vienmēr, ja relejs konfigurēts.
 * Ja CSDD nerāda LV reģistrāciju, solis tiek izlaists (pēc VIN LTAB neprasām).
 */
export async function startLtabLookup(
  sessionId: string,
  opts: { trigger: "auto" | "manual"; orderVin?: string | null; csdd?: CsddFormFields; force?: boolean },
): Promise<StartLtabResult> {
  const config = readLtabRelayConfig();
  if (opts.trigger === "auto" && !config?.autoEnabled) {
    return { ok: true, status: { state: "skipped", message: "LTAB automātika izslēgta", updatedAt: nowIso() }, started: false };
  }
  const prev = await readLtabAutoStatus(sessionId);
  if (prev && isLtabAutoActive(prev) && !opts.force) return { ok: true, status: prev, started: false };
  if (opts.trigger === "auto" && prev && (prev.state === "claims" || prev.state === "no_claims")) {
    return { ok: true, status: prev, started: false };
  }

  let csdd = opts.csdd;
  if (!csdd) {
    const draft = await readOrderDraft(sessionId);
    csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
  }
  const target = resolveLtabQueryTarget(csdd, opts.orderVin);
  if (target.kind === "skip") {
    // Automātika nepārraksta iepriekšēju rezultātu ar "izlaists".
    if (opts.trigger === "auto" && prev) return { ok: true, status: prev, started: false };
    const status = await saveStatus(sessionId, {
      state: "skipped",
      message: LTAB_SKIP_REASON_LV[target.reason],
      updatedAt: nowIso(),
      trigger: opts.trigger,
    });
    return { ok: true, status, started: false };
  }

  if (!config) {
    const status = await saveStatus(sessionId, {
      state: "not_configured",
      plate: target.plate,
      message: "LTAB relejs nav pieslēgts (Vercel LTAB_RELAY_URL / LTAB_RELAY_TOKEN)",
      updatedAt: nowIso(),
      trigger: opts.trigger,
    });
    return { ok: false, status, started: false };
  }

  const requestedAt = nowIso();
  try {
    const res = await fetch(`${config.baseUrl}/lookup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plate: target.plate, ref: sessionId, trigger: opts.trigger }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { jobId?: unknown; error?: unknown; state?: unknown; message?: unknown };
    if (!res.ok || typeof json.jobId !== "string") {
      const status = await saveStatus(sessionId, {
        state: "error",
        plate: target.plate,
        message: `LTAB relejs atteica (${res.status}${typeof json.error === "string" ? `: ${json.error.slice(0, 80)}` : ""})`,
        requestedAt,
        updatedAt: nowIso(),
        trigger: opts.trigger,
      });
      return { ok: false, status, started: false };
    }
    const night = json.state === "deferred_night";
    const status = await saveStatus(sessionId, {
      state: "queued",
      plate: target.plate,
      jobId: json.jobId,
      message: night ? "Gaida rītu (07:00) - naktī Smart-ID neprasām" : "Gaida rindā",
      requestedAt,
      updatedAt: nowIso(),
      trigger: opts.trigger,
    });
    return { ok: true, status, started: true };
  } catch (e) {
    const status = await saveStatus(sessionId, {
      state: "error",
      plate: target.plate,
      message: "LTAB relejs nav sasniedzams",
      requestedAt,
      updatedAt: nowIso(),
      trigger: opts.trigger,
    });
    console.error(`${LOG} relay unreachable`, e instanceof Error ? e.message : "unknown");
    void recordSourceOutcomes([{ id: "ltab_auto", ok: false, msg: "relay_unreachable" }]).catch(() => undefined);
    return { ok: false, status, started: false };
  }
}

function orderCarFromCsdd(csdd: CsddFormFields, plate: string, orderVin: string) {
  const reg = csdd.registry?.data;
  const [makeFromForm, ...modelParts] = (csdd.makeModel ?? "").trim().split(/\s+/);
  return {
    vin: normalizeVin(reg?.vin || csdd.vin || orderVin || ""),
    make: (reg?.make || makeFromForm || "").trim(),
    model: (reg?.model || modelParts.join(" ") || "").trim(),
    year: (reg?.year || csdd.modelYear || "").trim().slice(0, 4),
    plate,
  };
}

/** Releja notikums (atzvans). Atgriež jauno stāvokli vai kļūdu. */
export async function handleLtabRelayEvent(
  ev: LtabRelayEvent,
): Promise<{ ok: true; status: LtabAutoStatus } | { ok: false; error: string; httpStatus: number }> {
  const sessionId = ev.ref;
  const prev = await readLtabAutoStatus(sessionId);
  if (prev?.jobId && ev.jobId && prev.jobId !== ev.jobId) {
    // Vecs uzdevums (piem. pēc "Pieprasīt vēlreiz") - neko nepārrakstām.
    return { ok: false, error: "stale_job", httpStatus: 409 };
  }
  const now = nowIso();

  if (ev.state !== "result") {
    const status = await saveStatus(sessionId, reduceLtabProgress(prev, ev, now));
    if (ev.state === "awaiting_smartid" && status.verificationCode) {
      await sendAdminPush({
        title: "LTAB: apstiprini Smart-ID",
        body: `Kods ${status.verificationCode}. Apstiprini tikai, ja kods telefonā sakrīt.`,
        url: `/admin/orders/${encodeURIComponent(sessionId)}`,
        tag: "ltab-smartid",
        audience: "pro",
      });
    }
    if (ev.state === "error") {
      void recordSourceOutcomes([{ id: "ltab_auto", ok: false, msg: (ev.code ?? "error").slice(0, 60) }]).catch(() => undefined);
    }
    return { ok: true, status };
  }

  const base: LtabAutoStatus = { ...(prev ?? { updatedAt: now, state: "queued" }), plate: ev.plate || prev?.plate, jobId: ev.jobId, updatedAt: now, checkedAt: ev.at || now };
  delete base.verificationCode;
  delete base.mismatch;
  delete base.appliedAt;
  delete base.pdf;
  delete base.certificate;

  const bytes = ev.pdfBase64 ? new Uint8Array(Buffer.from(ev.pdfBase64, "base64")) : null;
  if (bytes && (!isPdfBytes(bytes) || bytes.byteLength > LTAB_PDF_MAX_BYTES)) {
    const status = await saveStatus(sessionId, { ...base, state: "error", message: "LTAB atdeva bojātu vai pārāk lielu PDF - augšupielādē manuāli" });
    return { ok: true, status };
  }

  let certificate: LtabCertificate | undefined;
  if (bytes) {
    const agent = await runLtabPdfAgent({ fileName: "ltab.pdf", buffer: bytes.slice().buffer });
    const action = agent.actions.find((a) => a.type === "set_ltab_certificate");
    if (action && action.type === "set_ltab_certificate") certificate = action.certificate;
  }

  const hasClaims = certificate ? ltabCertificateHasClaims(certificate) : ev.found === true;
  if (!hasClaims) {
    const status = await saveStatus(sessionId, { ...base, state: "no_claims", message: "OCTA gadījumu nav" });
    void recordSourceOutcomes([{ id: "ltab_auto", ok: true, msg: "no_claims" }]).catch(() => undefined);
    return { ok: true, status };
  }

  if (!bytes) {
    const status = await saveStatus(sessionId, { ...base, state: "error", message: "LTAB rādīja negadījumus, bet PDF nav saņemts - augšupielādē manuāli" });
    return { ok: true, status };
  }

  const draft = await readOrderDraft(sessionId);
  const csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
  const car = orderCarFromCsdd(csdd, base.plate ?? ev.plate, draft?.orderEdits?.vin ?? "");

  let pdf: LtabAutoStatus["pdf"];
  let dropboxNote = "";
  const client = getDropboxClient();
  if (!client) {
    dropboxNote = " · Dropbox nav konfigurēts, PDF nav saglabāts";
  } else {
    try {
      const saved = await saveLtabPdfToOrderFolder(client, car, bytes);
      pdf = { dropboxPath: saved.path, name: saved.name, size: saved.size, savedAt: nowIso() };
    } catch (e) {
      console.error(`${LOG} dropbox save failed`, e instanceof Error ? e.message.slice(0, 200) : "unknown");
      dropboxNote = " · PDF neizdevās saglabāt Dropbox";
    }
  }

  const mismatch = certificate ? ltabCertificateMismatch(certificate, { plate: car.plate, make: car.make, year: car.year }) : null;
  const claims = certificate?.claims.length ?? 0;
  const status = await saveStatus(sessionId, {
    ...base,
    state: "claims",
    message: `${certificate ? `Atrasti negadījumi: ${claims || certificate.accidentCount}` : "Izziņu neizdevās nolasīt - skaties PDF"}${dropboxNote}`,
    ...(pdf ? { pdf } : {}),
    ...(certificate ? { certificate } : {}),
    ...(mismatch ? { mismatch } : {}),
  });
  await sendAdminPush({
    title: "LTAB: atrasti negadījumi",
    body: `${car.plate}: ${claims || "?"} OCTA ${claims === 1 ? "gadījums" : "gadījumi"}${mismatch ? " - pārbaudi atbilstību" : ""}`,
    url: `/admin/orders/${encodeURIComponent(sessionId)}`,
    tag: `ltab-${sessionId}`,
    audience: "pro",
  });
  void recordSourceOutcomes([{ id: "ltab_auto", ok: true, msg: "claims" }]).catch(() => undefined);
  return { ok: true, status };
}

/** Pēc ievietošanas blokā (automātiski vai ar pogu) - lai neievietotu otrreiz. */
export async function markLtabAutoApplied(sessionId: string): Promise<LtabAutoStatus | null> {
  const prev = await readLtabAutoStatus(sessionId);
  if (!prev || (prev.state !== "claims" && prev.state !== "no_claims")) return prev;
  return saveStatus(sessionId, { ...prev, appliedAt: nowIso(), updatedAt: nowIso() });
}
