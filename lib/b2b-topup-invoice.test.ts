import { describe, expect, it } from "vitest";
import { applyB2bWalletTopup, attachB2bWalletTopupInvoice, emptyB2bWallet } from "@/lib/b2b-wallet";
import {
  B2B_TOPUP_INVOICE,
  buildB2bTopupInvoiceHtml,
  fallbackB2bTopupInvoiceNumber,
  fillB2bTopupInvoiceEmailTemplate,
  formatIrsInvoiceNumber,
  getB2bTopupInvoicePvnNote,
  parseIrsInvoiceSequence,
  renderB2bTopupInvoiceEmail,
} from "@/lib/b2b-topup-invoice";
import { toInvoiceOrderPayload } from "@/lib/generate-invoice-html";
import { getB2bMailFromAddress } from "@/lib/email/mail-config";
import { b2bIrissEmailHtml } from "@/lib/email/html-templates";
import { buildPartnerPackArchiveRow } from "@/lib/b2b-partner-archive-rows";

describe("B2B top-up invoice", () => {
  it("fills email placeholders without PROVIN, VIN or long dashes", () => {
    const rendered = renderB2bTopupInvoiceEmail({
      summa: "100,00 €",
      atlikums: "250,00 €",
      rekins: "IRS-2026-0003",
      uznemums: "SIA Salons",
    });
    expect(rendered.subject).toBe("IRISS: rēķins par konta papildināšanu 100,00 €");
    expect(rendered.text).toContain("250,00 €");
    expect(rendered.text).toContain("IRS-2026-0003");
    expect(rendered.subject + rendered.text).not.toMatch(/PROVIN/i);
    expect(rendered.subject + rendered.text).not.toMatch(/VIN/i);
    expect(rendered.subject + rendered.text).not.toMatch(/Paldies par pasūtījumu/);
    expect(rendered.subject + rendered.text).not.toMatch(/[–—]/);
    expect(B2B_TOPUP_INVOICE.email.subject).toContain("{{summa}}");
    expect(
      fillB2bTopupInvoiceEmailTemplate("x {{rekins}}", {
        summa: "1",
        atlikums: "2",
        rekins: "IRS-1",
        uznemums: "U",
      }),
    ).toBe("x IRS-1");
  });

  it("prints both parties, service line and nav-PVN note without VAT rows", () => {
    const html = buildB2bTopupInvoiceHtml(
      toInvoiceOrderPayload(
        {
          id: "cs_topup_1",
          created: 1_700_000_000,
          amountTotal: 10000,
          currency: "EUR",
          customerEmail: "salons@example.lv",
          customerDetailsEmail: "salons@example.lv",
          vin: "WVWZZZ3HZHE703058",
          customerName: "Jānis",
          companyName: "SIA Salons",
          companyReg: "40000000000",
          companyAddress: "Rīga",
        },
        "IRS-2026-0001",
        "b2b_topup",
      ),
    );
    expect(html).toContain("IRISS");
    expect(html).toContain("SIA Salons");
    expect(html).toContain("40000000000");
    expect(html).toContain("Konta papildināšana");
    expect(html).toContain(getB2bTopupInvoicePvnNote());
    expect(html).not.toMatch(/PROVIN/i);
    expect(html).not.toContain("PVN likme");
    expect(html).not.toContain("Transportlīdzekļa VIN");
    expect(html).not.toContain("WVWZZZ3HZHE703058");
    expect(html).not.toMatch(/[–—]/);
  });

  it("uses IRISS From and IRS sequential format", () => {
    expect(formatIrsInvoiceNumber(2026, 3)).toBe("IRS-2026-0003");
    expect(parseIrsInvoiceSequence("IRS-2026-0003", 2026)).toBe(3);
    expect(fallbackB2bTopupInvoiceNumber("cs_abc", 1_700_000_000)).toMatch(/^IRS-\d{4}-\d{4}$/);
    const prevUser = process.env.SMTP_USER;
    const prevFrom = process.env.SMTP_FROM;
    const prevB2b = process.env.SMTP_FROM_B2B;
    delete process.env.SMTP_FROM_B2B;
    delete process.env.SMTP_FROM;
    process.env.SMTP_USER = "desk@example.lv";
    expect(getB2bMailFromAddress()).toBe("IRISS <desk@example.lv>");
    expect(b2bIrissEmailHtml({ title: "IRISS: rēķins", paragraphs: ["Summa 100,00 €."] })).not.toMatch(/PROVIN/i);
    if (prevUser === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = prevUser;
    if (prevFrom === undefined) delete process.env.SMTP_FROM;
    else process.env.SMTP_FROM = prevFrom;
    if (prevB2b === undefined) delete process.env.SMTP_FROM_B2B;
    else process.env.SMTP_FROM_B2B = prevB2b;
  });

  it("stores the invoice number on the top-up txn and always offers a download", () => {
    const bought = applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 10000, sessionId: "cs_top_1" });
    const next = attachB2bWalletTopupInvoice(bought.wallet, {
      sessionId: "cs_top_1",
      invoiceNumber: "IRS-2026-0004",
    });
    expect(next.txns[0]?.invoiceNumber).toBe("IRS-2026-0004");
    expect(
      attachB2bWalletTopupInvoice(next, { sessionId: "cs_top_1", invoiceNumber: "IRS-2026-0004" }).txns[0]
        ?.invoiceNumber,
    ).toBe("IRS-2026-0004");
    const row = buildPartnerPackArchiveRow({
      id: "cs_top_1",
      createdAt: "2026-10-18T10:00:00.000Z",
      invoiceNumber: "IRS-2026-0004",
      amountTotal: 10000,
      currency: "eur",
      plan: "business",
      topup: true,
    });
    expect(row.kind).toBe("topup");
    expect(row.invoiceHref).toBe("/api/partner/invoice/cs_top_1");
  });
});
