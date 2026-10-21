/**
 * Komponenšu testi pēc tā, ko tās renderē (HTML), nevis pēc avota teksta.
 * Bez jsdom: react-dom/server, tāpēc der prezentācijas komponentēm bez efektiem.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export function renderHtml(el: ReactElement): string {
  return renderToStaticMarkup(el);
}

/** Redzamais teksts bez tagiem (atstarpes saspiestas), ērtāk salīdzināt. */
export function renderText(el: ReactElement): string {
  return renderHtml(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
