import { describe, expect, it } from "vitest";
import { AdminWhatsAppOpenButton } from "@/components/admin/AdminWhatsAppOpenButton";
import { telHrefForPhone } from "@/lib/admin-whatsapp-phone";
import { renderHtml, renderText } from "@/lib/test-render";

describe("karte Klients: WhatsApp un Zvanīt", () => {
  it("derīgam numuram - poga ar tekstu WhatsApp un tel: saite Zvanīt (tikai telefonā)", () => {
    const html = renderHtml(<AdminWhatsAppOpenButton phone="20420539" variant="labeled" prefillMessage="Sveiki" />);
    expect(renderText(<AdminWhatsAppOpenButton phone="20420539" variant="labeled" prefillMessage="Sveiki" />)).toBe("WhatsApp Zvanīt");
    expect(html).toContain('href="tel:+37120420539"');
    expect(html).toMatch(/<a[^>]*md:hidden/);
    expect(html).toContain("<button");
  });
  it("bez numura - WhatsApp nav spiežams un Zvanīt nav", () => {
    const html = renderHtml(<AdminWhatsAppOpenButton phone="" variant="labeled" prefillMessage="Sveiki" />);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("tel:");
  });
  it("tel: saite saglabā ārvalstu kodu un noraida nederīgu numuru", () => {
    expect(telHrefForPhone("+370 612 34567")).toBe("tel:+37061234567");
    expect(telHrefForPhone("12345")).toBeNull();
  });
});
