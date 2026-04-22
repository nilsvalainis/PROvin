import "server-only";

/**
 * **Tikai** SIA IRISS piedāvājuma PDF un drukas HTML (`iriss-pasutijums-pdf*`).
 *
 * Publiskajai PROVIN vietnei, kājenei un Stripe saskarei — `getCompanyLegal()` / `NEXT_PUBLIC_COMPANY_*`.
 * IRISS piegādātāja kājenes teksts nedrīkst būt publiskos komponentos; pilnas rindiņas tikai no
 * servera env `IRISS_PDF_SUPPLIER_LINES_JSON` (necommitēt .env.local / Vercel).
 */
export const IRISS_BRAND_ORANGE_HEX = "#F26522";

const FOOTER_BRAND_ONLY = ["SIA IRISS"] as const;

/**
 * IRISS PDF kājenes rindiņas — **tikai** no `IRISS_PDF_SUPPLIER_LINES_JSON` (JSON masīvs ar virknēm).
 * Bez env: tikai zīmols, lai repozitorijā nebūtu iekšējās adreses; pilnai kājenei iestati env lokāli / Vercel.
 */
export function getIrissPdfSupplierFooterLines(): string[] {
  const raw = process.env.IRISS_PDF_SUPPLIER_LINES_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const lines = parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        if (lines.length > 0) return lines;
      }
    } catch {
      /* ignore invalid JSON */
    }
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[iriss-brand] Trūkst IRISS_PDF_SUPPLIER_LINES_JSON — PDF kājene tikai ar zīmolu. Pilnai kājenei pievieno .env.local (sk. .env.example).",
    );
  }
  return [...FOOTER_BRAND_ONLY];
}
