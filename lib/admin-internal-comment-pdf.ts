import { sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";

/**
 * Iekšējā komentāra HTML → tīrs teksts PDF drukai (bez HTML tagiem; drošs pret injekciju).
 */
export function internalCommentHtmlToPdfPlain(html: string): string {
  const s = sanitizeDraftTextForStorage(html);
  if (!s.trim()) return "";
  let t = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  return t
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
