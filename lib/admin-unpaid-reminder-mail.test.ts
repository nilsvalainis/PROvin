import { describe, expect, it } from "vitest";
import { buildUnpaidReminderMailCopy } from "@/lib/admin-unpaid-reminder-mail";
import { resolveMessageSync } from "@/lib/messages/resolve-message";
import { unpaidReminderTemplateVars, UNPAID_REMINDER_TEMPLATE_ID } from "@/lib/admin-unpaid-reminder-copy";

describe("unpaid reminder mail from /admin/teksti template", () => {
  it("renders Labdien, vin and payment url from the registry template", () => {
    const vars = unpaidReminderTemplateVars({
      vin: "WVWZZZ1KZAW000123",
      paymentUrl: "https://www.provin.lv/apmaksa/token",
    });
    const rendered = resolveMessageSync(UNPAID_REMINDER_TEMPLATE_ID, vars);
    expect(rendered?.subject).toBe("Par Jūsu auto pārbaudi (VIN WVWZZZ1KZAW000123)");
    expect(rendered?.text.startsWith("Labdien!")).toBe(true);
    expect(rendered?.text).toContain("https://www.provin.lv/apmaksa/token");
    expect(rendered?.text).not.toMatch(/[—–]/);
  });

  it("buildUnpaidReminderMailCopy matches the template", () => {
    const copy = buildUnpaidReminderMailCopy({
      vin: "WVWZZZ1KZAW000123",
      paymentUrl: "https://www.provin.lv/apmaksa/token",
    });
    const rendered = resolveMessageSync(
      UNPAID_REMINDER_TEMPLATE_ID,
      unpaidReminderTemplateVars({ vin: "WVWZZZ1KZAW000123", paymentUrl: "https://www.provin.lv/apmaksa/token" }),
    );
    expect(copy.subject).toBe(rendered?.subject);
    expect(copy.text).toBe(rendered?.text);
  });
});
