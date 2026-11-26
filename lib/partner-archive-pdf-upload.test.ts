import { describe, expect, it } from "vitest";

import { formatPdfMb, partnerArchiveErrorMessage } from "@/lib/partner-archive-pdf-upload";

describe("partnerArchiveErrorMessage", () => {
  it("413 (Vercel HTML, nav JSON) -> skaidrs izmērs", () => {
    expect(partnerArchiveErrorMessage(413, null, 12.4 * 1024 * 1024)).toBe("PDF ir par lielu (12,4 MB). Maksimums 20,0 MB.");
  });
  it("servera teksts paliek; citādi statuss", () => {
    expect(partnerArchiveErrorMessage(400, { error: "x", message: "Atļauts tikai PDF." }, 1)).toBe("Atļauts tikai PDF.");
    expect(partnerArchiveErrorMessage(502, null, 1)).toBe("Serveris neatbildēja (502). Mēģini vēlreiz.");
    expect(partnerArchiveErrorMessage(401, {}, 1)).toMatch(/pieslēdzies/);
  });
  it("MB formāts ar komatu", () => {
    expect(formatPdfMb(5 * 1024 * 1024)).toBe("5,0 MB");
  });
});
