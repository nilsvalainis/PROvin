/** Inter (mainīgais, 100-900) servera PDF: Google Fonts apakškopas ar unicode-range (OFL licence). */
export const REPORT_INTER_SUBSETS: ReadonlyArray<{ file: string; unicodeRange: string }> = [
  { file: "inter-latin.woff2", unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  { file: "inter-latin-ext.woff2", unicodeRange: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" },
  { file: "inter-cyrillic.woff2", unicodeRange: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" },
  { file: "inter-cyrillic-ext.woff2", unicodeRange: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F" },
];

/** `@font-face` bloki ar iegultiem fontiem (data URL), viens katrai apakškopai. */
export function reportInterFontFaceCss(subsets: ReadonlyArray<{ base64: string; unicodeRange: string }>): string {
  return subsets
    .map(
      (s) =>
        `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${s.base64}) format('woff2');unicode-range:${s.unicodeRange};}`,
    )
    .join("\n");
}

/**
 * Servera PDF: Google Fonts saites vietā iegults Inter. Vercel funkcijā Google Fonts neielādējās (17.11 prod tests:
 * PDF iznāca ar rezerves fontu Open Sans). Dizains nemainās - tas pats Inter, tikai no projekta failiem.
 */
export function embedReportInterFonts(html: string, fontFaceCss: string): string {
  const style = `<style data-provin-inter="embedded">${fontFaceCss}</style>`;
  const withoutGoogle = html
    .replace(/<link[^>]+href="https:\/\/fonts\.googleapis\.com\/css2[^"]*"[^>]*\/?>/g, "")
    .replace(/<link[^>]+rel="preconnect"[^>]+fonts\.(googleapis|gstatic)\.com[^>]*\/?>/g, "");
  return /<\/head>/i.test(withoutGoogle) ? withoutGoogle.replace(/<\/head>/i, `${style}</head>`) : `${style}${withoutGoogle}`;
}
