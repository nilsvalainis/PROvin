/**
 * kfzgutachten.at (Austrijas §57a apskates) VIN SCAN rinda.
 * Serveris sarakstu nenolasa: meklēšanu sargā Google reCAPTCHA Enterprise, un to neapejam.
 * Rinda dod saiti ar aizpildītu VIN + 1. reģ. datumu; bez precīza datuma - «vajag datumu».
 */

import {
  KFZ_AT_GUTACHTEN_PRICE_EUR,
  kfzExactDateDdMmYyyy,
  kfzgutachtenSearchUrl,
} from "@/lib/kfzgutachten/kfzgutachten";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";

export function parseKfzAtProbe(vin: string, firstRegDate?: string | null): VinScanParse {
  const date = kfzExactDateDdMmYyyy(firstRegDate);
  if (!date) {
    return {
      status: "needs_input",
      summary: "kfzgutachten.at: vajag precīzu 1. reģistrācijas datumu (TT.MM.GGGG). Pasūtījumā - Citi avoti «Austrija · §57a apskates»",
      openUrl: kfzgutachtenSearchUrl(vin),
    };
  }
  return {
    status: "browser_only",
    summary: `kfzgutachten.at: saraksts bez maksas, bet tikai pārlūkā (reCAPTCHA). Saite aizpilda VIN un ${date} - nospied «Suchen». Atzinums ${KFZ_AT_GUTACHTEN_PRICE_EUR} gab.`,
    openUrl: kfzgutachtenSearchUrl(vin, date),
  };
}

export function probeKfzAt(ctx: VinScanContext): VinScanIndicator {
  return buildVinScanIndicator("kfz_at", ctx.vin, parseKfzAtProbe(ctx.vin, ctx.firstRegDate), ctx.plates);
}
