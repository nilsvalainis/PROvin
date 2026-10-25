/**
 * FABLE 25.10: Select konsultācijas WhatsApp PDF krita ar `WinAnsi cannot encode "≈"` (arī →, ✓, karogi),
 * un lielie burti ar garumzīmēm kļuva mazi ("Ārija" -> "arija").
 */
import { describe, expect, it } from "vitest";
import { buildWinAnsiQuickPdfFile, toWinAnsiSafeText } from "@/lib/admin-whatsapp-quick-pdf";

describe("WinAnsi WhatsApp PDF", () => {
  it("simboli ārpus WinAnsi netiek padoti pdf-lib", () => {
    expect(toWinAnsiSafeText("≈ 120 000 km → ✓ ok")).toBe("~ 120 000 km -> + ok");
    expect(toWinAnsiSafeText("Vācija 🇩🇪")).toBe("Vacija ");
    expect(toWinAnsiSafeText("Łódź, Győr")).toBe("Lódz, Gyor");
  });

  it("lielie burti paliek lieli; Š/Ž (ir WinAnsi) paliek", () => {
    expect(toWinAnsiSafeText("Ārija Ēvalds Šķirne Žagata")).toBe("Arija Evalds Škirne Žagata");
  });

  it("PDF tiek izveidots ar teksta simboliem, kas agrāk krita", async () => {
    const file = await buildWinAnsiQuickPdfFile({
      docHeading: "PROVIN SELECT KONSULTACIJA",
      metaLines: ["Klients: Jānis"],
      sections: [{ title: "Nr. 1", text: "Cena ≈ 21 500 € → atbilst ✓\nVācija 🇩🇪 ⚠ 2019 ≥ 2018" }],
      filename: "test.pdf",
    });
    expect(file.size).toBeGreaterThan(500);
  });
});
