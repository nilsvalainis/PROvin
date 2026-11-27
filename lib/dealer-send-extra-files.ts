/**
 * Dīlera «Sūtīt klientam» (Nils 27.11): papildu faili/bildes e-pastā blakus dīlera PDF.
 * Tīrā loģika (klients + serveris): tipi, skaits, kopējais apjoms, nosaukumi.
 *
 * Limits: e-pastu sūta caur Google Workspace SMTP (smtp.gmail.com) - ziņojums ≤ 25 MB pēc base64
 * (~4/3 no failu apjoma). Tāpēc dīlera PDF + papildu faili kopā ≤ 18 MB.
 */

export const DEALER_EXTRA_MAX_FILES = 50;
/** PDF + papildu faili kopā (neapstrādāti baiti). */
export const DEALER_SEND_MAX_TOTAL_BYTES = 18 * 1024 * 1024;

export const DEALER_EXTRA_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** `<input accept>`: MIME + paplašinājumi (iPhone Safari / Mac Finder). */
export const DEALER_EXTRA_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Faila MIME pēc deklarētā tipa vai paplašinājuma; `null` = neatbalstīts. */
export function dealerExtraFileMime(name: string, declared?: string | null): string | null {
  const t = (declared ?? "").trim().toLowerCase();
  if ((DEALER_EXTRA_ALLOWED_MIME as readonly string[]).includes(t)) return t;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return EXT_MIME[ext] ?? null;
}

export function isHeicMime(mime: string | null | undefined): boolean {
  return mime === "image/heic" || mime === "image/heif";
}

/** «IMG_1234.HEIC» -> «IMG_1234.jpg» (pēc pārvēršanas uz JPEG). */
export function heicToJpegName(name: string): string {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name}.jpg`;
}

/**
 * Pielikuma nosaukums e-pastā: saglabā oriģinālo (arī garumzīmes un atstarpes),
 * noņem tikai ceļu, vadības rakstzīmes un failu sistēmai bīstamās zīmes.
 */
export function dealerAttachmentFilename(raw: string, fallback = "pielikums"): string {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export type DealerExtraFileLike = { name: string; size: number; type?: string | null };

/**
 * Pārbaude pirms sūtīšanas (logā) un serverī. `pdfBytes` - dīlera PDF izmērs, ja zināms.
 * Atgriež kļūdas tekstu latviski vai `null`.
 */
export function dealerExtraFilesError(files: readonly DealerExtraFileLike[], pdfBytes = 0): string | null {
  if (files.length > DEALER_EXTRA_MAX_FILES) return `Var pievienot līdz ${DEALER_EXTRA_MAX_FILES} failiem.`;
  for (const f of files) {
    if (!dealerExtraFileMime(f.name, f.type)) return `Neatbalstīts faila veids: «${f.name}». Atļauti PDF, JPG, PNG, HEIC, WEBP.`;
    if (!(f.size > 0)) return `Fails «${f.name}» ir tukšs.`;
  }
  const extra = files.reduce((s, f) => s + f.size, 0);
  const total = extra + Math.max(0, pdfBytes);
  if (total > DEALER_SEND_MAX_TOTAL_BYTES) {
    const lim = formatFileSize(DEALER_SEND_MAX_TOTAL_BYTES);
    if (files.length === 0) {
      return `PDF par lielu e-pastam: ${formatFileSize(pdfBytes)} (līdz ${lim}). Noņem kādu bildi no «Sūtīt klientam».`;
    }
    return pdfBytes > 0
      ? `Par lielu e-pastam: PDF ${formatFileSize(pdfBytes)} + faili ${formatFileSize(extra)} (kopā līdz ${lim}). Noņem kādu failu.`
      : `Faili kopā ${formatFileSize(extra)} - e-pastam līdz ${lim} kopā ar PDF. Noņem kādu failu.`;
  }
  return null;
}

/** Ieraksts klienta saziņas žurnālā (bez satura). */
export type DealerSentFile = { name: string; bytes: number };

export function dealerSentFilesFromAttachments(list: readonly { filename: string; content: { length: number } }[]): DealerSentFile[] {
  return list.slice(0, DEALER_EXTRA_MAX_FILES).map((a) => ({ name: a.filename.slice(0, 150), bytes: a.content.length }));
}
