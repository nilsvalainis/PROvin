import { describe, expect, it } from "vitest";

import type { ClientManualVendorBlockPdf } from "@/lib/admin-source-blocks";
import { translateClientReportLvTerms } from "@/lib/client-report-lv-terms-i18n";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";

/** Anonimizēts paraugs pēc WDD2122931A366915 (26.11): DK reģistrā 357 628 km, pēc tam CSDD 287 469 km. */
function vendor(title: string, rows: { date: string; odometer: string; country: string }[]): ClientManualVendorBlockPdf {
  return { title, mileageRows: rows, incidentRows: [], comments: "" } as unknown as ClientManualVendorBlockPdf;
}

const input = () => ({
  manualVendorBlocks: [
    vendor("DĀNIJAS REĢISTRI", [
      { date: "06.09.2024", odometer: "340332", country: "Dānija" },
      { date: "13.08.2026", odometer: "357628", country: "Dānija" },
    ]),
    vendor("Latvijas reģistrs", [{ date: "26.11.2026", odometer: "287469", country: "Latvija" }]),
  ],
});

describe("26.11: nobraukuma baneris - agrāk augstāks rādījums", () => {
  it("rāda pēdējo un agrāko augstāko rādījumu ar kritumu, sarkanā tonī, bez verdikta", () => {
    const tile = buildPdfReportSummaryTiles(input()).find((t) => t.id === "mileage")!;
    expect(tile.value.replace(/\s/g, " ")).toBe("287 469 km");
    expect(tile.tone).toBe("alert");
    const note = tile.note.replace(/ /g, " ");
    expect(note).toContain("Pēdējais rādījums 287 469 km (LV)");
    expect(note).toContain("iepriekš 357 628 km (DK 13.08.2026)");
    expect(note).toContain("kritums 70 159 km");
    expect(note).not.toMatch(/manipul|sagroz|krāpn|nepirkt/i);
  });

  it("teksts tulkojas EN / DE / RU", () => {
    const line = "Pēdējais rādījums 287 469 km (CSDD) · iepriekš 357 628 km (DK 13.08.2026) · kritums 70 159 km";
    expect(translateClientReportLvTerms(line, "en")).toBe(
      "Latest reading 287 469 km (CSDD) · earlier 357 628 km (DK 13.08.2026) · decrease 70 159 km",
    );
    expect(translateClientReportLvTerms(line, "de")).toContain("zuvor 357 628 km (DK 13.08.2026)");
    expect(translateClientReportLvTerms(line, "ru")).toContain("снижение 70 159 km");
  });
});
