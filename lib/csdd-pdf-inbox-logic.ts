import { isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

/**
 * Ienākošie e.csdd izziņu PDF (info@provin.lv -> Apps Script -> /api/ecsdd/pdf-inbox): atpazīšana un pasūtījuma
 * atrašana pēc numura / VIN (tīrā loģika).
 */

export const CSDD_PDF_INBOX_WINDOW_MS = 7 * 24 * 60 * 60_000;
export const CSDD_PDF_INBOX_MAX_BYTES = 8 * 1024 * 1024;

/** e.csdd izziņas PDF (TCPDF) teksta slānī ir kājene "Informācija sagatavota elektroniski". */
export function looksLikeCsddReportText(text: string): boolean {
  const t = text.slice(0, 200_000);
  return /inform[aā]cija\s+sagatavota\s+elektroniski/i.test(t) && /(re[gģ]istr[aā]cijas|transportl[iī]dzek|VIN)/i.test(t);
}

export function csddPdfIdentity(fields: { registrationNumber?: string; vin?: string; registry?: { data?: { registrationNumber?: string; vin?: string } } }): {
  plate: string;
  vin: string;
} {
  const plate = normalizePlateNumber(fields.registrationNumber || fields.registry?.data?.registrationNumber || "");
  const vin = normalizeVin(fields.vin || fields.registry?.data?.vin || "");
  return { plate: /^[A-Z0-9]{2,10}$/.test(plate) ? plate : "", vin: isValidVin(vin) ? vin : "" };
}

export type CsddPdfOrderCandidate = {
  id: string;
  createdMs: number;
  /** Pasūtījuma numuri / VIN (jebkurā formā). */
  keys: Array<string | null | undefined>;
  /** Šim pasūtījumam ir automātiskā maksas izziņa ar šo numuru. */
  autoJobPlate?: string | null;
};

function norm(k: string | null | undefined): string {
  return String(k ?? "").toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Pasūtījums pēdējās 7 dienās ar to pašu numuru vai VIN. Priekšroka: automātiskās izziņas darbs ar šo numuru,
 * tad jaunākais. null - nav.
 */
export function matchCsddPdfOrder(candidates: CsddPdfOrderCandidate[], id: { plate: string; vin: string }, nowMs: number): string | null {
  const plate = norm(id.plate);
  const vin = norm(id.vin);
  if (!plate && !vin) return null;
  const recent = candidates.filter((c) => nowMs - c.createdMs <= CSDD_PDF_INBOX_WINDOW_MS && c.createdMs <= nowMs + 60_000);
  const withJob = recent.filter((c) => plate && norm(c.autoJobPlate) === plate).sort((a, b) => b.createdMs - a.createdMs);
  if (withJob[0]) return withJob[0].id;
  const hits = recent
    .filter((c) => c.keys.some((k) => {
      const n = norm(k);
      return Boolean(n) && (n === plate || n === vin);
    }))
    .sort((a, b) => b.createdMs - a.createdMs);
  return hits[0]?.id ?? null;
}

/** Faila nosaukums pasūtījuma mapē (tas pats PDF otrreiz -> tas pats nosaukums -> nedublējas). */
export function csddPdfFileName(plateOrVin: string, md5: string): string {
  const id = norm(plateOrVin).replace(/[^A-Z0-9]/g, "") || "CSDD";
  return `CSDD izzina ${id} ${md5.slice(0, 8)}.pdf`;
}
