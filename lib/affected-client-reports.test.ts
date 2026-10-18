import { describe, expect, it } from "vitest";
import {
  PR277_CLIENT_REPORT_CUTOFF_ISO,
  clientReportScanIsAffected,
  isClientReportAtOrAfterPr277Cutoff,
  scanClientReportText,
} from "@/lib/affected-client-reports";

describe("affected client reports since PR #277", () => {
  it("cutoff is 18.10.2026 00:29 Riga", () => {
    expect(PR277_CLIENT_REPORT_CUTOFF_ISO).toBe("2026-10-17T21:29:00.000Z");
    expect(isClientReportAtOrAfterPr277Cutoff("2026-10-17T21:28:59.000Z")).toBe(false);
    expect(isClientReportAtOrAfterPr277Cutoff("2026-10-17T21:29:00.000Z")).toBe(true);
    expect(isClientReportAtOrAfterPr277Cutoff("2026-10-18T09:00:00.000Z")).toBe(true);
    expect(isClientReportAtOrAfterPr277Cutoff(null)).toBe(false);
  });

  it("flags Grandland-style averaged amounts and false total loss", () => {
    const scan = scanClientReportText(
      "NEGADĪJUMU VĒSTURE AutoDNA 3 950 € kopā ~2 850 € Pilnīgs zaudējums",
    );
    expect(scan.hasIncidentSection).toBe(true);
    expect(scan.hasTildeApprox).toBe(true);
    expect(scan.hasBannedAveragedAmounts).toBe(true);
    expect(scan.hasPilnigsZaudejums).toBe(true);
    expect(clientReportScanIsAffected(scan)).toBe(true);
  });

  it("does not flag the corrected Grandland range", () => {
    const scan = scanClientReportText(
      "NEGADĪJUMU VĒSTURE Bojājumu ieraksts 07.2026 AutoDNA 1 600 - 1 700 €; 6 000 - 6 500 € CarVertical 1 501 - 2 000 € 1 501 - 6 500 €",
    );
    expect(scan.hasIncidentSection).toBe(true);
    expect(scan.hasTildeApprox).toBe(false);
    expect(scan.hasBannedAveragedAmounts).toBe(false);
    expect(scan.hasPilnigsZaudejums).toBe(false);
    expect(clientReportScanIsAffected(scan)).toBe(false);
  });
});
