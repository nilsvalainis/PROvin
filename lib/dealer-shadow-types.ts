/**
 * Dīlera datu «ēnu režīms» (Nils 22.11.2026): kvalitātes pārbaudes spriedums un admina atsauksme.
 * Glabājas dīlera darba ierakstā (`shadowGate`, `shadowFeedback`). Klientam nekas netiek sūtīts.
 * Tīri tipi + normalizācija bez atkarībām (lieto gan serveris, gan klients, gan testi).
 */

export const DEALER_SHADOW_GATE_VERSION = 1;

export type DealerGateVerdict = "would_send" | "would_hold";
export type DealerGateSeverity = "block" | "warn";
export type DealerGateState = "ok" | "fail" | "skip";

export const DEALER_GATE_CHECK_IDS = [
  "job_status",
  "raw_dates",
  "oil_facts",
  "translation",
  "forbidden",
  "contradictions",
  "pdf",
  "ai_fields",
] as const;
export type DealerGateCheckId = (typeof DEALER_GATE_CHECK_IDS)[number];

/** Kur adminā labot (UI ritina līdz šai vietai). */
export type DealerGatePlace = "service_table" | "oil_notes" | "comments" | "pdf" | "job";

export type DealerGateCheck = {
  id: DealerGateCheckId;
  /** Nosaukums latviski. */
  title: string;
  state: DealerGateState;
  severity: DealerGateSeverity;
  /** Iemesls ar konkrētu piemēru (tukšs, ja ok). */
  reason: string;
  place?: DealerGatePlace;
};

export type DealerShadowGatePdf = { filename: string; at: string };

export type DealerShadowGate = {
  verdict: DealerGateVerdict;
  checks: DealerGateCheck[];
  at: string;
  version: number;
  /** Kas palaida: darba beigas, «Pārbaudīt vēlreiz», sūtīšanas forma, PDF. */
  trigger?: "job" | "manual" | "send_dialog" | "pdf";
  /** Pēdējais servera PDF (no sūtīšanas formas); atkārtotā pārbaude to izmanto. */
  pdf?: DealerShadowGatePdf;
};

export type DealerShadowFeedback = {
  correct: boolean;
  note: string;
  at: string;
  /** Kuru spriedumu admins vērtēja. */
  verdict?: DealerGateVerdict;
  gateAt?: string;
};

export const DEALER_SHADOW_NOTE_MAX = 500;

const PLACES: readonly DealerGatePlace[] = ["service_table", "oil_notes", "comments", "pdf", "job"];
const TRIGGERS = ["job", "manual", "send_dialog", "pdf"] as const;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Spriedumam svarīgās (neizturētās) pārbaudes. */
export function failedDealerGateChecks(gate: Pick<DealerShadowGate, "checks"> | null | undefined): DealerGateCheck[] {
  return (gate?.checks ?? []).filter((c) => c.state === "fail");
}

export function dealerGateVerdictFromChecks(checks: readonly DealerGateCheck[]): DealerGateVerdict {
  return checks.some((c) => c.state === "fail" && c.severity === "block") ? "would_hold" : "would_send";
}

export function normalizeDealerShadowGate(raw: unknown): DealerShadowGate | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.checks)) return undefined;
  const checks: DealerGateCheck[] = [];
  for (const item of o.checks.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const id = DEALER_GATE_CHECK_IDS.find((x) => x === c.id);
    if (!id) continue;
    const state: DealerGateState = c.state === "fail" || c.state === "skip" ? c.state : "ok";
    const severity: DealerGateSeverity = c.severity === "warn" ? "warn" : "block";
    const place = PLACES.find((p) => p === c.place);
    checks.push({
      id,
      title: str(c.title, 80),
      state,
      severity,
      reason: str(c.reason, 400),
      ...(place ? { place } : {}),
    });
  }
  const at = str(o.at, 40);
  if (!at) return undefined;
  const trigger = TRIGGERS.find((t) => t === o.trigger);
  const pdfRaw = o.pdf && typeof o.pdf === "object" ? (o.pdf as Record<string, unknown>) : null;
  const pdf = pdfRaw && str(pdfRaw.filename, 160) ? { filename: str(pdfRaw.filename, 160), at: str(pdfRaw.at, 40) } : null;
  return {
    // Spriedums vienmēr no pārbaudēm (nevar «sūtītu» ar bloķējošu kļūdu).
    verdict: dealerGateVerdictFromChecks(checks),
    checks,
    at,
    version: typeof o.version === "number" && Number.isFinite(o.version) ? Math.floor(o.version) : DEALER_SHADOW_GATE_VERSION,
    ...(trigger ? { trigger } : {}),
    ...(pdf ? { pdf } : {}),
  };
}

export function normalizeDealerShadowFeedback(raw: unknown): DealerShadowFeedback | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.correct !== "boolean") return undefined;
  const at = str(o.at, 40);
  if (!at) return undefined;
  const verdict = o.verdict === "would_send" || o.verdict === "would_hold" ? o.verdict : undefined;
  const gateAt = str(o.gateAt, 40);
  return {
    correct: o.correct,
    note: str(o.note, DEALER_SHADOW_NOTE_MAX),
    at,
    ...(verdict ? { verdict } : {}),
    ...(gateAt ? { gateAt } : {}),
  };
}

/** Īss teksts UI: «Sistēma sūtītu» / «Sistēma aizturētu · 3 iemesli». */
export function dealerShadowGateLabel(gate: DealerShadowGate | null | undefined): string {
  if (!gate) return "Pārbaude nav palaista";
  if (gate.verdict === "would_send") return "Sistēma sūtītu";
  const n = failedDealerGateChecks(gate).filter((c) => c.severity === "block").length;
  return `Sistēma aizturētu · ${n} ${n === 1 ? "iemesls" : "iemesli"}`;
}
