import { describe, expect, it } from "vitest";
import { correctedSubject, dropboxReportFilename, nextClientReportVersion, versionedReportFilename } from "@/lib/client-report-sends-core";

describe("Sūtīt atskaiti: versijas", () => {
  it("pirmais sūtījums ir 1, nākamais pēc lielākā", () => {
    expect(nextClientReportVersion([])).toBe(1);
    expect(nextClientReportVersion([{ version: 1 }, { version: 3 }, { version: 2 }])).toBe(4);
  });

  it("arhīvā katra versija atsevišķi, nekas netiek pārrakstīts", () => {
    expect(versionedReportFilename(1, "PROVIN_AUDITS_WDC1671191A002835.pdf")).toBe("v1-PROVIN_AUDITS_WDC1671191A002835.pdf");
    expect(versionedReportFilename(2, "a b/c")).toBe("v2-a_b_c.pdf");
  });

  it("Dropbox: pirmā versija bez sufiksa, labotā ar _v2", () => {
    expect(dropboxReportFilename(1, "PROVIN_AUDITS_X.pdf")).toBe("PROVIN_AUDITS_X.pdf");
    expect(dropboxReportFilename(2, "PROVIN_AUDITS_X.pdf")).toBe("PROVIN_AUDITS_X_v2.pdf");
  });

  it("labotai atskaitei tēmā atzīme klienta valodā", () => {
    expect(correctedSubject("PROVIN · Atskaite gatava · WDC1671191A002835", "lv")).toBe("PROVIN · Atskaite gatava · WDC1671191A002835 · labota");
    expect(correctedSubject("PROVIN · Report ready · X", "en")).toBe("PROVIN · Report ready · X · corrected");
  });
});
