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
