/** Admin bagātināto komentāru fonti (noklusējums + līdz 9 nosaukumi = max 10). */
export type AdminRichCommentFontOption = {
  id: string;
  label: string;
  /** `font-family` vērtība span stilam; tukša = lapas noklusējums (Inter). */
  css: string;
};

export const ADMIN_RICH_COMMENT_FONT_OPTIONS: readonly AdminRichCommentFontOption[] = [
  { id: "default", label: "Noklusējums", css: "" },
  { id: "arial", label: "Arial", css: "Arial, Helvetica, sans-serif" },
  { id: "times", label: "Times New Roman", css: '"Times New Roman", Times, serif' },
  { id: "verdana", label: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { id: "georgia", label: "Georgia", css: "Georgia, serif" },
  { id: "tahoma", label: "Tahoma", css: "Tahoma, Geneva, sans-serif" },
  { id: "courier", label: "Courier New", css: '"Courier New", Courier, monospace' },
  { id: "helvetica", label: "Helvetica", css: "Helvetica, Arial, sans-serif" },
  { id: "calibri", label: "Calibri", css: "Calibri, sans-serif" },
  { id: "garamond", label: "Garamond", css: "Garamond, serif" },
] as const;

export type AdminRichCommentSizeOption = {
  id: string;
  label: string;
  css: string;
};

export const ADMIN_RICH_COMMENT_SIZE_OPTIONS: readonly AdminRichCommentSizeOption[] = [
  { id: "10", label: "10", css: "10px" },
  { id: "11", label: "11", css: "11px" },
  { id: "12", label: "12", css: "12px" },
  { id: "13", label: "13", css: "13px" },
  { id: "14", label: "14", css: "14px" },
  { id: "16", label: "16", css: "16px" },
] as const;

export type AdminRichCommentColorOption = {
  id: string;
  label: string;
  css: string;
};

/** Teksta krāsas — visas hex, lai PDF sanitizers tās pieņem bez izņēmumiem. */
export const ADMIN_RICH_COMMENT_TEXT_COLOR_OPTIONS: readonly AdminRichCommentColorOption[] = [
  { id: "default", label: "Pamata (melns)", css: "#111827" },
  { id: "red", label: "Sarkans — risks", css: "#ef4444" },
  { id: "green", label: "Zaļš — kārtībā", css: "#22c55e" },
  { id: "amber", label: "Dzintara — brīdinājums", css: "#d97706" },
  { id: "blue", label: "Zils — informācija", css: "#2563eb" },
  { id: "violet", label: "Violets — piezīme", css: "#7c3aed" },
  { id: "muted", label: "Pelēks — sekundāri", css: "#64748b" },
] as const;

/** Izcēluma (marķiera) krāsas — gaišas, lai melns teksts paliek salasāms arī drukā. */
export const ADMIN_RICH_COMMENT_HIGHLIGHT_OPTIONS: readonly AdminRichCommentColorOption[] = [
  { id: "yellow", label: "Dzeltens izcēlums", css: "#fde68a" },
  { id: "green", label: "Zaļš izcēlums", css: "#bbf7d0" },
  { id: "blue", label: "Zils izcēlums", css: "#bfdbfe" },
  { id: "pink", label: "Rozā izcēlums", css: "#fbcfe8" },
  { id: "orange", label: "Oranžs izcēlums", css: "#fed7aa" },
  { id: "none", label: "Noņemt izcēlumu", css: "transparent" },
] as const;

/** PDF sanitizer — atļautie `font-family` pirmie vārdi (lowercase). */
export const ADMIN_RICH_PDF_FONT_WHITELIST = new Set(
  ADMIN_RICH_COMMENT_FONT_OPTIONS.filter((f) => f.id !== "default").flatMap((f) =>
    f.css
      .split(",")[0]!
      .replace(/['"]/g, "")
      .trim()
      .toLowerCase(),
  ),
);
