import { describe, expect, it } from "vitest";
import {
  sendReportAttachmentDisplay,
  sendReportAttachmentKind,
  sendReportAttachmentName,
  sendReportAttachmentSizeLabel,
} from "@/lib/admin-send-report-attachments";

describe("Sūtīt atskaiti: pielikuma rindas teksts", () => {
  it("ņem nosaukumu no name, citādi filename, citādi veidu", () => {
    expect(sendReportAttachmentName({ id: "1", name: "  CV.pdf  " })).toBe("CV.pdf");
    expect(sendReportAttachmentName({ id: "2", name: " ", filename: "AutoDNA.bin.pdf" })).toBe("AutoDNA.bin.pdf");
    expect(sendReportAttachmentName({ id: "3", mime: "image/jpeg" })).toBe("foto");
    expect(sendReportAttachmentName({ id: "4" })).toBe("Pielikums");
  });

  it("pazīst avotu/veidu no nosaukuma un MIME", () => {
    expect(sendReportAttachmentKind({ id: "a", name: "CarVertical_WBA.pdf" })).toBe("CarVertical");
    expect(sendReportAttachmentKind({ id: "b", filename: "autodna-atskaite.pdf" })).toBe("AutoDNA");
    expect(sendReportAttachmentKind({ id: "c", name: "bamperis.jpg", mime: "image/jpeg" })).toBe("foto");
    expect(sendReportAttachmentKind({ id: "d", name: "PROVIN_AUDITS_VIN.pdf", mime: "application/pdf" })).toBe(
      "PDF atskaite",
    );
    expect(sendReportAttachmentKind({ id: "e", name: "skenējums.pdf" })).toBe("PDF");
    expect(sendReportAttachmentKind({ id: "f", name: "piezimes.txt" })).toBeNull();
  });

  it("izmēru rāda arī pie 0 baitiem; bez derīga skaitļa - tukšs", () => {
    expect(sendReportAttachmentSizeLabel(0)).toBe("0,0 MB");
    expect(sendReportAttachmentSizeLabel(1.7 * 1024 * 1024)).toBe("1,7 MB");
    expect(sendReportAttachmentSizeLabel(undefined)).toBeNull();
    expect(sendReportAttachmentSizeLabel(Number.NaN)).toBeNull();
  });

  it("rinda bez izmēra un bez nosaukuma joprojām ir salasāma", () => {
    const row = sendReportAttachmentDisplay({ id: "x", mime: "application/pdf" });
    expect(row.name).toBe("PDF");
    expect(row.sizeLabel).toBeNull();
    expect(row.title).toBe("PDF");
  });
});
