/**
 * Telefona pasūtījumu saraksts (22.11 makets v3, variants 3): vai dati IR ielasīti, uzreiz atverot sarakstu.
 * Dīlera pasūtījumiem - pēc dīlera datu darba statusa; citiem produktiem - pēc VIN SCAN pēdējās palaišanas.
 * Tīra loģika bez server-only (lieto gan RSC, gan klients, gan testi).
 */

import {
  dealerDataJobHistoryReady,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";
import type { OrderVinScanDashboardHint } from "@/lib/order-vin-scan";

/** done - zaļš ķeksis; no_data / error - sarkans krusts; running - pelēks griežas; idle - pelēki punkti. */
export type AdminIngestState = "done" | "no_data" | "error" | "running" | "idle";

export type AdminOrderIngest = {
  state: AdminIngestState;
  /** Īss teksts rindā, piem. «Ielasīts · 14», «Datu nav», «Kļūda», «Ielasa…», «Nav palaists». */
  label: string;
  /** Ierakstu (dīlera) vai atrasto avotu (VIN SCAN) skaits. */
  count?: number;
  source: "dealer" | "vin_scan";
  /** Tikai dīlera datiem: vai klientam kaut kas nosūtīts. Nav zināms - lauka nav. */
  sent?: boolean;
};

export type AdminIngestFilter = "all" | "not_sent" | "errors" | "running";

const STATES: readonly AdminIngestState[] = ["done", "no_data", "error", "running", "idle"];

function withSent(base: AdminOrderIngest, sent: boolean | null | undefined): AdminOrderIngest {
  return typeof sent === "boolean" ? { ...base, sent } : base;
}

/** Dīlera datu darbs -> rindas indikācija. `job === null` - darbs vēl nav izveidots. */
export function adminIngestFromDealerJob(
  job: Pick<DealerDataJob, "status" | "error" | "serviceEventCount"> | null,
  sent?: boolean | null,
): AdminOrderIngest {
  if (!job) return { state: "idle", label: "Nav palaists", source: "dealer" };
  if (dealerDataJobHistoryReady(job)) {
    const count = Math.max(0, Math.round(job.serviceEventCount ?? 0));
    return withSent({ state: "done", label: `Ielasīts · ${count}`, count, source: "dealer" }, sent);
  }
  switch (job.status) {
    case "pending":
      return { state: "idle", label: "Gaida ielasi", source: "dealer" };
    case "running":
      return { state: "running", label: "Ielasa…", source: "dealer" };
    case "no_data":
      return withSent({ state: "no_data", label: "Datu nav", source: "dealer" }, sent);
    case "no_vin":
      return { state: "error", label: "Nav VIN", source: "dealer" };
    case "failed":
      // OneAuto vēl apstrādā - cron atkārtos pats.
      if (job.error === "pending" || job.error === "http_202") {
        return { state: "running", label: "Ielasa…", source: "dealer" };
      }
      return { state: "error", label: "Kļūda", source: "dealer" };
    default:
      return { state: "idle", label: "Nav palaists", source: "dealer" };
  }
}

/**
 * VIN SCAN pēdējā palaišana -> rindas indikācija (AUDITS / PRO / MINI).
 * Bez ieraksta: neizpildītam - «Nav palaists»; izpildītam - neko nerāda (null).
 */
export function adminIngestFromVinScan(
  hint: Pick<OrderVinScanDashboardHint, "status" | "found" | "none" | "error" | "blocked" | "timeout" | "configMissing"> | null | undefined,
  opts: { complete: boolean },
): AdminOrderIngest | null {
  if (!hint) return opts.complete ? null : { state: "idle", label: "Nav palaists", source: "vin_scan" };
  if (hint.status === "running") return { state: "running", label: "Ielasa…", source: "vin_scan" };
  if (hint.found > 0) {
    return { state: "done", label: `Ielasīts · ${hint.found}`, count: hint.found, source: "vin_scan" };
  }
  if (hint.error + hint.blocked + hint.timeout + hint.configMissing > 0 || hint.status === "error") {
    return { state: "error", label: "Kļūda", source: "vin_scan" };
  }
  return { state: "no_data", label: "Datu nav", source: "vin_scan" };
}

/** «Nosūtīts» / «Nav nosūtīts» blakus indikācijai (tikai dīlera datiem, kad tas zināms). */
export function adminIngestSentLabel(ingest: AdminOrderIngest | null | undefined): string | null {
  if (!ingest || ingest.source !== "dealer" || typeof ingest.sent !== "boolean") return null;
  return ingest.sent ? "Nosūtīts" : "Nav nosūtīts";
}

export function adminIngestMatchesFilter(
  ingest: AdminOrderIngest | null | undefined,
  filter: AdminIngestFilter,
): boolean {
  if (filter === "all") return true;
  if (!ingest) return false;
  if (filter === "running") return ingest.state === "running";
  if (filter === "errors") return ingest.state === "error" || ingest.state === "no_data";
  // Nav nosūtīti: dati gatavi (vai «datu nav» paziņojums), bet klientam nekas nav sūtīts.
  return ingest.source === "dealer" && ingest.sent === false && (ingest.state === "done" || ingest.state === "no_data");
}

export function countAdminIngestFilters(
  list: readonly (AdminOrderIngest | null | undefined)[],
): Record<Exclude<AdminIngestFilter, "all">, number> {
  const out = { not_sent: 0, errors: 0, running: 0 };
  for (const i of list) {
    if (adminIngestMatchesFilter(i, "not_sent")) out.not_sent++;
    if (adminIngestMatchesFilter(i, "errors")) out.errors++;
    if (adminIngestMatchesFilter(i, "running")) out.running++;
  }
  return out;
}

/** RSC -> klients: tikai derīgi lauki. */
export function parseAdminOrderIngest(raw: unknown): AdminOrderIngest | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const state = STATES.find((s) => s === o.state);
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 40) : "";
  const source = o.source === "dealer" || o.source === "vin_scan" ? o.source : null;
  if (!state || !label || !source) return undefined;
  const out: AdminOrderIngest = { state, label, source };
  if (typeof o.count === "number" && Number.isFinite(o.count) && o.count >= 0) out.count = Math.round(o.count);
  if (typeof o.sent === "boolean") out.sent = o.sent;
  return out;
}
