import { describe, expect, it } from "vitest";
import {
  B2B_WALLET_REFUND_EMAIL,
  B2B_WALLET_REFUND_EMAIL_PRODUCT,
  fillB2bWalletRefundEmailTemplate,
  renderB2bWalletRefundEmail,
} from "@/lib/b2b-wallet-refund-email";
import { b2bWalletRefundEmailHtml } from "@/lib/email/html-templates";
import { getB2bMailFromAddress } from "@/lib/email/mail-config";

describe("B2B wallet refund email template", () => {
  it("fills vin, sum, balance and product without PROVIN or long dashes", () => {
    const rendered = renderB2bWalletRefundEmail({
      vin: "WVWZZZ3HZHE703058",
      summa: "19,99 €",
      atlikums: "80,01 €",
      produkts: B2B_WALLET_REFUND_EMAIL_PRODUCT.dealer_raw,
    });
    expect(rendered.subject).toBe("IRISS: dati VIN WVWZZZ3HZHE703058 nav pieejami, 19,99 € atgriezti kontā");
    expect(rendered.text).toContain("Dīlera dati RAW");
    expect(rendered.text).toContain("80,01 €");
    expect(rendered.subject + rendered.text).not.toMatch(/PROVIN/i);
    expect(rendered.subject + rendered.text).not.toMatch(/[–—]/);
    expect(B2B_WALLET_REFUND_EMAIL.subject).toContain("{{vin}}");
    expect(fillB2bWalletRefundEmailTemplate("x {{summa}}", {
      vin: "A",
      summa: "1 €",
      atlikums: "2 €",
      produkts: "P",
    })).toBe("x 1 €");
  });

  it("builds IRISS HTML without PROVIN branding", () => {
    const html = b2bWalletRefundEmailHtml({ title: "IRISS: atmaksa", paragraphs: ["Summa 19,99 €."] });
    expect(html).toContain(">IRISS<");
    expect(html).not.toMatch(/PROVIN/i);
    expect(html).toContain("#F26522");
  });

  it("uses IRISS as the From display name", () => {
    const prevUser = process.env.SMTP_USER;
    const prevFrom = process.env.SMTP_FROM;
    const prevB2b = process.env.SMTP_FROM_B2B;
    delete process.env.SMTP_FROM_B2B;
    delete process.env.SMTP_FROM;
    process.env.SMTP_USER = "desk@example.lv";
    expect(getB2bMailFromAddress()).toBe("IRISS <desk@example.lv>");
    process.env.SMTP_FROM_B2B = "IRISS <b2b@example.lv>";
    expect(getB2bMailFromAddress()).toBe("IRISS <b2b@example.lv>");
    expect(getB2bMailFromAddress()).not.toMatch(/PROVIN/i);
    if (prevUser === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = prevUser;
    if (prevFrom === undefined) delete process.env.SMTP_FROM;
    else process.env.SMTP_FROM = prevFrom;
    if (prevB2b === undefined) delete process.env.SMTP_FROM_B2B;
    else process.env.SMTP_FROM_B2B = prevB2b;
  });
});
