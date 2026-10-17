/**
 * Dīlera datu produkts pret kombinētiem pasūtījumiem (AUDITS, MINI, BUSINESS u.c.).
 *
 * Dīlera-only pasūtījums ir patstāvīgs pakalpojums: PDF rāda visus ierakstus
 * (t.sk. Key Read History un tukšus nobraukuma punktus), un oficiālā dīlera
 * komentāri izmanto tikai dīlera datus. Ja klients jaunina uz auditu / MINI,
 * šie ierobežojumi krīt.
 *
 * Nav jāsasaista ar audita-only ceļiem: lēmums ir tīrs no checkout līnijas
 * un summas, lai automātiskā dīlera piegāde paliktu neatkarīga.
 */
import { DEALER_DATA_MAX_AMOUNT_CENTS, DEALER_DATA_MIN_AMOUNT_CENTS } from "@/lib/dealer-data-job-types";

export type DealerProductScopeArgs = {
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
  pdfReportKind?: string | null;
  /**
   * Automātiskā dīlera piegāde vienmēr izolē komentārus (patstāvīgs serviss).
   * Admin ✨ pēc jauninājuma uz auditu padod false / neatstāj override.
   */
  isolateOverride?: boolean | null;
};

/**
 * Citas produktā līnijas, kurām dīlera PDF drīkst saīsināt Key Read / tukšos
 * nobraukuma punktus, un kurām dīlera komentārs drīkst lasīt pārējos avotus.
 */
const COMBINED_CHECKOUT_LINES = new Set([
  "mini",
  "plus",
  "listing_filter",
  "premium",
  "audit",
  "audits",
  "business",
  "provin_select",
  "consultation",
  "koreausa",
  "korea_usa",
]);

function checkoutLine(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

function amountCents(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return raw;
}

/** Klients ir nopircis tikai oficiālā dīlera datus (patstāvīgs produkts). */
export function isDealerDataOnlyProduct(args: DealerProductScopeArgs): boolean {
  const line = checkoutLine(args.checkoutLine);
  if (line === "dealer") return true;
  if (COMBINED_CHECKOUT_LINES.has(line)) return false;
  const cents = amountCents(args.amountTotalCents);
  if (cents == null) return false;
  if (cents === 3999) return false;
  return cents >= DEALER_DATA_MIN_AMOUNT_CENTS && cents <= DEALER_DATA_MAX_AMOUNT_CENTS;
}

/**
 * Vai dīlera PDF drīkst slēpt Key Read History rindas un tukšus nobraukuma
 * punktus no darbu līnijas (km paliek nobraukuma tabulā).
 *
 * true tikai tad, ja pasūtījumā ir arī cits produkts. Dīlera-only PDF rāda visus.
 */
export function shouldCondenseDealerPdfRecords(args: DealerProductScopeArgs): boolean {
  if (isDealerDataOnlyProduct(args)) return false;
  const line = checkoutLine(args.checkoutLine);
  if (COMBINED_CHECKOUT_LINES.has(line)) return true;
  const kind = (args.pdfReportKind ?? "").trim().toLowerCase();
  if (kind === "full" || kind === "business") return true;
  if (kind === "dealer") return false;
  const cents = amountCents(args.amountTotalCents);
  if (cents != null && cents >= 3999) return true;
  return false;
}

/**
 * Vai oficiālā dīlera komentāri drīkst ņemt tikai dīlera datus.
 * Pēc jauninājuma uz auditu / MINI šis paliek false, ja override nav dots.
 */
export function shouldIsolateDealerComments(args: DealerProductScopeArgs): boolean {
  if (args.isolateOverride === true) return true;
  if (args.isolateOverride === false) return false;
  return isDealerDataOnlyProduct(args);
}

/**
 * Dīlera-only ✨: tikai šī avota fakti. Nav CSDD/AutoDNA/CarVertical esejas.
 * Pēc jauninājuma uz auditu šo bloku neievieto.
 */
export const DEALER_ISOLATED_COMMENT_DIRECTIVE = `ŠIS PASŪTĪJUMS IR TIKAI OFICIĀLĀ DĪLERA DATU PRODUKTS (patstāvīgs serviss, nav AUDITS / MINI).
Raksti TIKAI no oficiālā dīlera datiem zemāk. NEIZMANTO un NEMINI CSDD, AutoDNA, CarVertical, LTAB, sludinājumu, IRISS, tehniskos riskus vai citus avotus, pat ja tie ir sesijā.
Lomu „Nobraukuma / datu saskaņa” ar CSDD/AutoDNA/CarVertical IZLAID: šajā produktā citu avotu nav.
Negadījumu sasaisti ar svešiem avotiem NERAKSTI.
Ja klients vēlāk jauninās uz auditu, šis ierobežojums šim pasūtījumam tiks noņemts.`;
