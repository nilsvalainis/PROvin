import { describe, expect, it } from "vitest";

import {
  SOURCE_PDF_DIRECT_UPLOAD_MAX_BYTES,
  isSafeAdminOrderId,
  isVercelBlobHostname,
  parseSourcePdfBlobRefs,
  sourcePdfBlobPathPrefix,
} from "@/lib/admin-source-pdf-blob-constants";

describe("avotu PDF Blob pārsūtīšana", () => {
  it("slieksnis ir zem Vercel funkcijas ~4,5 MB ķermeņa limita", () => {
    expect(SOURCE_PDF_DIRECT_UPLOAD_MAX_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });

  it("pieņem Stripe, demo un manuālos pasūtījumu id", () => {
    expect(isSafeAdminOrderId("cs_test_a1b2c3d4e5")).toBe(true);
    expect(isSafeAdminOrderId("demo_order_exp_1")).toBe(true);
    expect(isSafeAdminOrderId("manual_order_123_abc")).toBe(true);
    expect(isSafeAdminOrderId("../../etc/passwd")).toBe(false);
    expect(isSafeAdminOrderId("cs_a")).toBe(false);
  });

  it("ceļš satur pasūtījuma id", () => {
    expect(sourcePdfBlobPathPrefix(" cs_123456 ")).toBe("admin-source-pdf/cs_123456");
  });

  it("atļauj tikai Vercel Blob hostus", () => {
    expect(isVercelBlobHostname("abc123.public.blob.vercel-storage.com")).toBe(true);
    expect(isVercelBlobHostname("evil.example.com")).toBe(false);
  });

  it("nolasa `fileUrls` JSON un ignorē blēņas", () => {
    const refs = parseSourcePdfBlobRefs(
      JSON.stringify([
        { url: "https://x.public.blob.vercel-storage.com/a.pdf", name: "BMW.pdf" },
        { url: "" },
        "nope",
        { url: "https://x.public.blob.vercel-storage.com/b.pdf" },
      ]),
      5,
    );
    expect(refs).toEqual([
      { url: "https://x.public.blob.vercel-storage.com/a.pdf", name: "BMW.pdf" },
      { url: "https://x.public.blob.vercel-storage.com/b.pdf" },
    ]);
    expect(parseSourcePdfBlobRefs("", 5)).toEqual([]);
    expect(parseSourcePdfBlobRefs("{not json", 5)).toEqual([]);
  });

  it("ievēro maksimālo failu skaitu", () => {
    const many = JSON.stringify(
      Array.from({ length: 6 }, (_, i) => ({ url: `https://x.blob.vercel-storage.com/${i}.pdf` })),
    );
    expect(parseSourcePdfBlobRefs(many, 2)).toHaveLength(2);
  });
});
