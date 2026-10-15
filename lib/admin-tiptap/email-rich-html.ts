import { isAdminTiptapRichStorage } from "@/lib/admin-tiptap/storage-format";
import { stripPlaceholderChipMarkup } from "@/lib/admin-tiptap/placeholders";

const P_STYLE = 'margin:0 0 12px;font-size:15px;color:#1d1d1f;line-height:1.6;';
const H2_STYLE = 'margin:20px 0 10px;font-size:18px;font-weight:600;color:#1d1d1f;line-height:1.35;';
const H3_STYLE = 'margin:16px 0 8px;font-size:16px;font-weight:600;color:#1d1d1f;line-height:1.35;';
const UL_STYLE = 'margin:0 0 12px;padding-left:22px;font-size:15px;color:#1d1d1f;line-height:1.6;';
const OL_STYLE = UL_STYLE;
const LI_STYLE = "margin:0 0 6px;";

function addInlineStyles(fragment: string): string {
  let s = stripPlaceholderChipMarkup(fragment);
  s = s.replace(/<p(\s[^>]*)?>/gi, `<p style="${P_STYLE}">`);
  s = s.replace(/<h2(\s[^>]*)?>/gi, `<h2 style="${H2_STYLE}">`);
  s = s.replace(/<h3(\s[^>]*)?>/gi, `<h3 style="${H3_STYLE}">`);
  s = s.replace(/<ul(\s[^>]*)?>/gi, `<ul style="${UL_STYLE}">`);
  s = s.replace(/<ol(\s[^>]*)?>/gi, `<ol style="${OL_STYLE}">`);
  s = s.replace(/<li(\s[^>]*)?>/gi, `<li style="${LI_STYLE}">`);
  s = s.replace(/<a\s+([^>]*?)href=/gi, (match, pre) => {
    if (/style=/i.test(pre)) return match;
    return `<a ${pre}style="color:#0a66d8;text-decoration:underline;" href=`;
  });
  return s;
}

export function adminRichHtmlToEmailBodyInner(renderedHtmlFragment: string): string {
  return addInlineStyles(renderedHtmlFragment);
}

export function wrapAdminRichEmailDocument(inner: string): string {
  return `<!DOCTYPE html><html lang="lv"><body>${inner}</body></html>`;
}

export function shouldUseRichEmailHtml(bodyAfterRender: string): boolean {
  return isAdminTiptapRichStorage(bodyAfterRender);
}
