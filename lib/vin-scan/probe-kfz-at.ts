import "server-only";
/**
 * kfzgutachten.at (Austrijas §57a apskates) VIN SCAN rinda.
 *
 * 26.11 (Nils): pārbaude VISIEM auto, kam ir VIN + precīzs 1. reģ. datums (CSDD) - Austrijas pazīmes negaida.
 * Meklēšanu veic releja Chrome (`/listings/vinsource` `kfz_at`): atver lapu, ievada VIN + datumu, nospiež «Suchen»
 * un nolasa sarakstu (skaits, datumi). reCAPTCHA Enterprise neapiet: ja lapa atsaka - «nav pārbaudīts» + pārlūka
 * josla; relejs ieslēdz atdzišanu (20 min -> 3 h) un rindu (≤1 vaicājums / 2 min), kešs 7 d uz VIN + datums.
 * Atzinumus (1,19 €) sistēma NEKAD nepērk - tos pērk Nils pats.
 */

import { kfzAtFoundSummary, kfzAtNoneSummary, kfzAtUncheckedSummary } from "@/lib/kfzgutachten/kfz-at-result";
import { kfzExactDateDdMmYyyy, kfzgutachtenSearchUrl } from "@/lib/kfzgutachten/kfzgutachten";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";
import {
  fetchVinSourceViaRelay,
  vinSourceRelayConfigured,
  type VinSourceRelayResult,
} from "@/lib/vin-scan/vinsource-relay";

/** Bez precīza datuma meklēt nevar - datumu neizdomājam. */
export function parseKfzAtNoDate(vin: string): VinScanParse {
  return {
    status: "needs_input",
    summary: kfzAtUncheckedSummary("nav precīza 1. reģ. datuma"),
    openUrl: kfzgutachtenSearchUrl(vin),
  };
}

/** Releja atbilde -> VIN SCAN rinda. Nepārbaudīts = `browser_only` (nav avota kļūda, nebremzē circuit breaker). */
export function parseKfzAtRelay(vin: string, date: string, got: VinSourceRelayResult): VinScanParse {
  const openUrl = kfzgutachtenSearchUrl(vin, date);
  if (!got.ok) {
    return { status: "browser_only", summary: kfzAtUncheckedSummary(got.reason.replace(/^kfzgutachten\.at:\s*/i, "")), openUrl };
  }
  const rows = got.kind === "found" ? (got.rows ?? []) : [];
  if (rows.length === 0) return { status: "none", summary: kfzAtNoneSummary(date), openUrl };
  return {
    status: "found",
    summary: kfzAtFoundSummary(rows.map((r) => r.date)),
    openUrl,
    flags: { countries: ["AT"] },
    inspections: rows.map((r) => ({
      date: r.date,
      ...(r.model || r.plate ? { result: [r.model, r.plate].filter(Boolean).join(" · ") } : {}),
      ...(r.km ? { odometer: `${r.km} km` } : {}),
      ...(r.plate ? { plate: r.plate } : {}),
      ...(r.model ? { model: r.model } : {}),
    })),
  };
}

/** Datums: konteksts (pasūtījums / CSDD sēkla) vai tā paša skenējuma CSDD rinda. */
async function kfzDateFor(ctx: VinScanContext): Promise<string> {
  const own = kfzExactDateDdMmYyyy(ctx.firstRegDate);
  if (own) return own;
  const hinted = ctx.firstRegHint ? await ctx.firstRegHint().catch(() => "") : "";
  return kfzExactDateDdMmYyyy(hinted);
}

export async function probeKfzAt(ctx: VinScanContext): Promise<VinScanIndicator> {
  const date = await kfzDateFor(ctx);
  if (!date) return buildVinScanIndicator("kfz_at", ctx.vin, parseKfzAtNoDate(ctx.vin), ctx.plates);
  if (!vinSourceRelayConfigured()) {
    return buildVinScanIndicator(
      "kfz_at",
      ctx.vin,
      { status: "browser_only", summary: kfzAtUncheckedSummary("relejs nav konfigurēts"), openUrl: kfzgutachtenSearchUrl(ctx.vin, date) },
      ctx.plates,
    );
  }
  const got = await fetchVinSourceViaRelay("kfz_at", ctx.vin, { date });
  return buildVinScanIndicator("kfz_at", ctx.vin, parseKfzAtRelay(ctx.vin, date, got), ctx.plates);
}
