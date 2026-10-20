import { describe, expect, it } from "vitest";
import nodemailer from "nodemailer";

describe("nodemailer transport", () => {
  it("sends through jsonTransport without SMTP (nodemailer 10 API)", async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const info = await transport.sendMail({
      from: "info@provin.lv",
      to: "klients@example.com",
      subject: "PROVIN tests",
      text: "Sveiki",
      html: "<p>Sveiki</p>",
    });
    expect(info.accepted).toContain("klients@example.com");
    const parsed = JSON.parse(String(info.message)) as { subject?: string; html?: string };
    expect(parsed.subject).toBe("PROVIN tests");
    expect(parsed.html).toContain("Sveiki");
  });
});
