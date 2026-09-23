import { describe, expect, it } from "vitest";

import {
  applyClientReportStaticTranslations,
  translateClientReportStatic,
} from "@/lib/client-report-i18n";

describe("translateClientReportStatic", () => {
  it("returns the Latvian original untouched for lang lv", () => {
    expect(translateClientReportStatic("Tehnisko risku analīze", "lv")).toBe("Tehnisko risku analīze");
  });

  it("translates a known label to English", () => {
    expect(translateClientReportStatic("3. Kopsavilkums", "en")).toBe("3. Summary");
  });

  it("translates a known label to Russian", () => {
    expect(translateClientReportStatic("3. Kopsavilkums", "ru")).toBe("3. Итоги");
  });

  it("falls back to the Latvian text for an unknown phrase instead of throwing or returning empty", () => {
    expect(translateClientReportStatic("Kāds vēl nezināms teksts", "en")).toBe("Kāds vēl nezināms teksts");
  });
});

describe("applyClientReportStaticTranslations", () => {
  it("leaves the html untouched for lang lv", () => {
    const html = '<html lang="lv"><body>1. Tehnisko risku analīze</body></html>';
    expect(applyClientReportStaticTranslations(html, "lv")).toBe(html);
  });

  it("swaps the html lang attribute and known section headings for en", () => {
    const html = '<html lang="lv"><body><h2>1. Tehnisko risku analīze</h2><h2>3. Kopsavilkums</h2></body></html>';
    const out = applyClientReportStaticTranslations(html, "en");
    expect(out).toContain('<html lang="en"');
    expect(out).toContain("1. Technical Risk Analysis");
    expect(out).toContain("3. Summary");
    expect(out).not.toContain("Tehnisko risku analīze");
  });

  it("swaps known table headers for ru without touching surrounding markup", () => {
    const html = "<tr><th>Datums</th><th>Odometrs (km)</th><th>Avots</th><th>Valsts</th></tr>";
    const out = applyClientReportStaticTranslations(html, "ru");
    expect(out).toBe("<tr><th>Дата</th><th>Одометр (км)</th><th>Источник</th><th>Страна</th></tr>");
  });

  it("does not corrupt dynamic (already-translated) text that happens to contain a short static word", () => {
    // "Kopā" ir statiska atslēga, bet dinamiskais AI teksts šeit jau ir angliski —
    // sweep drīkst aizvietot pat šo, jo tas notiek TIKAI pēc AI tulkojuma; svarīgi, ka nenolūzt un paliek konsekvents.
    const html = "<p>Kopā notes: everything looks fine</p>";
    const out = applyClientReportStaticTranslations(html, "en");
    expect(out).toContain("Total notes: everything looks fine");
  });

  it("never leaves a literal empty translation - unknown static text stays as-is", () => {
    const html = "<p>Šis teksts vārdnīcā nav</p>";
    const out = applyClientReportStaticTranslations(html, "en");
    expect(out).toBe(html);
  });
});
