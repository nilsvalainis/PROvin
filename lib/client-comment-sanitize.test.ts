import { describe, expect, it } from "vitest";
import { b2bPartnerAiContextLine, clientVisibleComment } from "@/lib/client-comment-sanitize";
import { buildPdfAboutReportBlock, buildPdfAdminMirrorNotesBlock } from "@/lib/client-report-pdf-layout-draft";

/** 27.11 gadījums (anonimizēti ID): B2B manuāls Business pasūtījums. */
const B2B_NOTES =
  "B2B business · partner_id=ptr_0123456789abcdef · partner_company=SIA Demo Partneris · audit_purpose=client · lot=wtx_1_1_abc · checkout_line=business · wallet_txn=wtx_1_1_abc · wallet_product=business · wallet_cents=6999 · report_lang=lv";

describe("clientVisibleComment", () => {
  it("tikai tehniskās atzīmes -> nekā nav", () => {
    expect(clientVisibleComment(B2B_NOTES)).toBeNull();
    expect(clientVisibleComment("B2B dealer · partner_id=ptr_1 · wallet_product=dealer_raw")).toBeNull();
    expect(clientVisibleComment("partner_id=ptr_0123456789abcdef checkout_line=dealer")).toBeNull();
    expect(clientVisibleComment("<p>" + B2B_NOTES + "</p>")).toBeNull();
    expect(clientVisibleComment("utm_source=fb · utm_campaign=x")).toBeNull();
  });

  it("patiesu klienta tekstu atstāj", () => {
    expect(clientVisibleComment("Lūdzu pārbaudīt rūsu, auto ir Vācijā.")).toBe("Lūdzu pārbaudīt rūsu, auto ir Vācijā.");
    expect(clientVisibleComment(`${B2B_NOTES}\nLūdzu pārbaudīt nobraukumu`)).toBe("Lūdzu pārbaudīt nobraukumu");
    expect(clientVisibleComment(`${B2B_NOTES} · Interesē servisa vēsture`)).toBe("Interesē servisa vēsture");
    expect(clientVisibleComment("Cena 5 000 € · lūdzu ātri")).toBe("Cena 5 000 € · lūdzu ātri");
    expect(clientVisibleComment("B2B klients grib zināt par kārbu")).toBe("B2B klients grib zināt par kārbu");
  });

  it("HTML piezīmēs atstāj tagus ap klienta tekstu", () => {
    expect(clientVisibleComment(`<p>${B2B_NOTES}</p><p>Vai bija avārija?</p>`)).toBe("<p></p><p>Vai bija avārija?</p>");
  });

  it("tukšs", () => {
    expect(clientVisibleComment(null)).toBeNull();
    expect(clientVisibleComment("  ")).toBeNull();
  });
});

describe("PDF «Pasūtījuma dati»", () => {
  const base = {
    created: 1_764_000_000,
    paymentStatus: "paid",
    amountTotal: null,
    currency: null,
    vin: "SALRA2BK6KA083972",
    listingUrl: null,
    customerName: "Kaspars",
    customerEmail: "klients@example.com",
    customerPhone: "+37120000000",
  };
  const args = (notes: string) => ({
    order: { ...base, notes },
    money: "-",
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    show: { payment: true, vehicle: true, client: true, notes: true },
  });

  it("tehniskā rinda nedrukājas un komentāra sadaļas nav", () => {
    const html = buildPdfAboutReportBlock(args(B2B_NOTES));
    expect(html).not.toContain("Klienta komentārs");
    for (const bad of ["partner_id", "partner_company", "wallet", "ptr_", "wtx_", "B2B business", "6999", "Demo Partneris"]) {
      expect(html).not.toContain(bad);
    }
    expect(html).toContain("Kaspars");
    expect(html).not.toContain("klients@example.com");
    expect(html).not.toContain("+37120000000");
  });

  it("klienta teksts paliek", () => {
    const html = buildPdfAboutReportBlock(args(`${B2B_NOTES}\nLūdzu pārbaudīt kārbu`));
    expect(html).toContain("Klienta komentārs");
    expect(html).toContain("Lūdzu pārbaudīt kārbu");
    expect(html).not.toContain("partner_id");
  });

  it("admin mirror bloks arī tīrs", () => {
    expect(buildPdfAdminMirrorNotesBlock(B2B_NOTES)).toBe("");
  });
});

describe("b2bPartnerAiContextLine", () => {
  it("partneris kā iekšējs konteksts bez ID un summām", () => {
    const line = b2bPartnerAiContextLine(B2B_NOTES);
    expect(line).toContain("iekšējs konteksts");
    expect(line).toContain("SIA Demo Partneris");
    expect(line).not.toMatch(/ptr_|wtx_|6999/);
  });
  it("parastam pasūtījumam tukšs", () => {
    expect(b2bPartnerAiContextLine("Lūdzu pārbaudīt")).toBe("");
  });
});
