import { describe, expect, it } from "vitest";
import {
  DEALER_EXTRA_MAX_FILES,
  DEALER_SEND_MAX_TOTAL_BYTES,
  dealerAttachmentFilename,
  dealerExtraFileMime,
  dealerExtraFilesError,
  dealerSentFilesFromAttachments,
  formatFileSize,
  heicToJpegName,
} from "@/lib/dealer-send-extra-files";
import { dealerSendRecordFromInput, dealerSendStatusLine, parseOrderClientMarks } from "@/lib/order-client-marks";

const MB = 1024 * 1024;

describe("dīlera papildu faili: tipi", () => {
  it("atļauj PDF/JPG/PNG/HEIC/WEBP pēc MIME vai paplašinājuma", () => {
    expect(dealerExtraFileMime("a.pdf", "application/pdf")).toBe("application/pdf");
    expect(dealerExtraFileMime("IMG_1.HEIC", "")).toBe("image/heic");
    expect(dealerExtraFileMime("bilde.jpeg", null)).toBe("image/jpeg");
    expect(dealerExtraFileMime("x.webp", "image/webp")).toBe("image/webp");
    expect(dealerExtraFileMime("x.png", "")).toBe("image/png");
  });
  it("noraida citus tipus", () => {
    expect(dealerExtraFileMime("x.exe", "application/octet-stream")).toBeNull();
    expect(dealerExtraFileMime("x.docx", "")).toBeNull();
    expect(dealerExtraFilesError([{ name: "x.zip", size: 10, type: "application/zip" }])).toMatch(/Neatbalstīts/);
  });
  it("HEIC nosaukums pēc pārvēršanas", () => {
    expect(heicToJpegName("IMG_1234.HEIC")).toBe("IMG_1234.jpg");
  });
});

describe("dīlera papildu faili: skaits un izmērs", () => {
  it("līdz 50 failiem", () => {
    const ten = Array.from({ length: DEALER_EXTRA_MAX_FILES }, (_, i) => ({ name: `${i}.jpg`, size: 100, type: "image/jpeg" }));
    expect(dealerExtraFilesError(ten)).toBeNull();
    expect(dealerExtraFilesError([...ten, { name: "11.jpg", size: 100, type: "image/jpeg" }])).toMatch(/līdz 50/);
  });
  it("tukšs fails nav derīgs", () => {
    expect(dealerExtraFilesError([{ name: "a.pdf", size: 0, type: "application/pdf" }])).toMatch(/tukšs/);
  });
  it("PDF + faili kopā ≤ 18 MB (Gmail SMTP 25 MB pēc base64)", () => {
    expect(DEALER_SEND_MAX_TOTAL_BYTES).toBe(18 * MB);
    expect(DEALER_SEND_MAX_TOTAL_BYTES * (4 / 3)).toBeLessThan(25 * MB);
    const files = [{ name: "a.jpg", size: 10 * MB, type: "image/jpeg" }];
    expect(dealerExtraFilesError(files, 7 * MB)).toBeNull();
    const err = dealerExtraFilesError(files, 9 * MB);
    expect(err).toMatch(/Par lielu e-pastam/);
    expect(err).toContain("PDF 9,0 MB");
    expect(dealerExtraFilesError([{ name: "b.jpg", size: 19 * MB, type: "image/jpeg" }])).toMatch(/Noņem/);
  });
  it("izmēra formāts", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1.5 * MB)).toBe("1,5 MB");
  });
});

describe("pielikumu nosaukumi un žurnāls", () => {
  it("nosaukums saglabā garumzīmes un atstarpes, noņem ceļu un bīstamās zīmes", () => {
    expect(dealerAttachmentFilename("Servisa grāmatiņa 1.jpg")).toBe("Servisa grāmatiņa 1.jpg");
    expect(dealerAttachmentFilename("C:\\Users\\x\\rēķins.pdf")).toBe("rēķins.pdf");
    expect(dealerAttachmentFilename('a<b>:"c".pdf')).toBe("a_b_c_.pdf");
    expect(dealerAttachmentFilename("..")).toBe("pielikums");
  });
  it("sūtījuma ierakstā faili (nosaukums, izmērs) un statusa rindā skaits", () => {
    const files = dealerSentFilesFromAttachments([
      { filename: "bilde.jpg", content: Buffer.alloc(1234) },
      { filename: "rēķins.pdf", content: Buffer.alloc(10) },
    ]);
    const rec = dealerSendRecordFromInput({ situation: "ready" }, "email", "2026-11-27T10:00:00.000Z", "ready", files);
    expect(rec.files).toEqual([
      { name: "bilde.jpg", bytes: 1234 },
      { name: "rēķins.pdf", bytes: 10 },
    ]);
    const parsed = parseOrderClientMarks({ dealerSends: [rec] });
    expect(parsed.dealerSends?.[0]?.files).toEqual(rec.files);
    expect(dealerSendStatusLine(rec)).toContain("+2 faili");
  });
  it("bez failiem ieraksts nemainās (vecie pasūtījumi)", () => {
    const rec = dealerSendRecordFromInput({ situation: "ready" }, "email", "2026-11-27T10:00:00.000Z", "ready");
    expect(rec).not.toHaveProperty("files");
    expect(dealerSendStatusLine(rec)).not.toContain("fail");
    const parsed = parseOrderClientMarks({ dealerSends: [{ ...rec }] });
    expect(parsed.dealerSends?.[0]).not.toHaveProperty("files");
  });
});
