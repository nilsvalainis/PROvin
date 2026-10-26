import { describe, expect, it, vi } from "vitest";

const sent: Array<{ subject: string; text: string; html: string }> = [];
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: async (m: { subject: string; text: string; html: string }) => { sent.push(m); } }) },
}));

/** FABLE v3 F7: EN/DE/RU partneru vēstulēs bija tulkots tikai temats - HTML palika LV. */
describe("partneru e-pasti citās valodās nav LV hibrīdi", () => {
  it.each(["en", "de", "ru"])("%s: apstiprinājuma un paroles vēstulēs nav LV teksta", async (locale) => {
    process.env.SMTP_USER = "x";
    process.env.SMTP_PASS = "y";
    const m = await import("@/lib/email/send-transactional");
    sent.length = 0;
    await m.sendPartnerVerifyEmail({ to: "a@b.lv", verifyUrl: "https://www.provin.lv/x", locale });
    await m.sendPartnerVerifyEmail({ to: "a@b.lv", verifyUrl: "https://www.provin.lv/x", locale, purpose: "email_change" });
    await m.sendPartnerPasswordResetEmail({ to: "a@b.lv", resetUrl: "https://www.provin.lv/x", locale });
    expect(sent).toHaveLength(3);
    for (const mail of sent) {
      expect(`${mail.subject}\n${mail.text}\n${mail.html}`).not.toMatch(/Apstiprin|ignorējiet|Iestatīt|derīga/);
    }
  });

  it("lv paliek latviski", async () => {
    const m = await import("@/lib/email/send-transactional");
    sent.length = 0;
    await m.sendPartnerVerifyEmail({ to: "a@b.lv", verifyUrl: "https://www.provin.lv/x", locale: "lv" });
    expect(sent[0]!.html).toContain("Apstipriniet e-pastu");
  });
});
