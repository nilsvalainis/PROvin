import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { buildIrissOfferPrintHtml, buildIrissPasutijumsPrintHtml } from "@/lib/iriss-pasutijums-pdf-html";

describe("IRISS print HTML escaping", () => {
  it("keeps Inter via Google Fonts and escapes client fields", () => {
    const rec = emptyIrissPasutijums("xss-order", "2026-04-15T10:00:00.000Z");
    rec.clientFirstName = `<img src=x onerror=alert(1)>`;
    rec.clientLastName = `O'Brien`;
    rec.brandModel = `BMW</title><script>alert(1)</script>`;
    rec.notes = `<svg onload=alert(1)>`;
    const html = buildIrissPasutijumsPrintHtml(rec, "2026. gada 15. aprīlis", null);
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("family=Inter");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("O&#39;Brien");
    expect(html).toContain("&lt;svg onload=alert(1)&gt;");
  });

  it("escapes offer image data URLs in attributes", () => {
    const rec = emptyIrissPasutijums("xss-offer", "2026-04-15T10:00:00.000Z");
    const offer = emptyIrissOfferRecord("off-xss", "2026-04-15T10:00:00.000Z", "Piedāvājums");
    offer.attachments = [
      {
        id: "img1",
        name: "foto.jpg",
        mimeType: "image/jpeg",
        size: 12,
        dataUrl: `data:image/jpeg;base64,abc" onerror="alert(1)`,
      },
      {
        id: "doc1",
        name: `fails"><img src=x onerror=alert(1)>`,
        mimeType: "application/pdf",
        size: 8,
        dataUrl: "",
      },
    ];
    const html = buildIrissOfferPrintHtml(rec, offer, "2026. gada 15. aprīlis", null);
    expect(html).not.toContain(`onerror="alert(1)"`);
    expect(html).toContain("onerror=&quot;alert(1)");
    expect(html).toContain("fails&quot;&gt;&lt;img");
  });
});
