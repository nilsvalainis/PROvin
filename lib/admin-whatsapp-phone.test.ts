import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPhoneDigits, whatsAppChatUrl } from "@/lib/admin-whatsapp-phone";

describe("normalizeWhatsAppPhoneDigits", () => {
  it("latviešu 8 ciparus, +371 un 00371 pārvērš wa.me ciparos", () => {
    expect(normalizeWhatsAppPhoneDigits("21234567")).toBe("37121234567");
    expect(normalizeWhatsAppPhoneDigits("+371 2123 4567")).toBe("37121234567");
    expect(normalizeWhatsAppPhoneDigits("00371 21234567")).toBe("37121234567");
    expect(normalizeWhatsAppPhoneDigits("37121234567")).toBe("37121234567");
  });

  it("nepieliek 371 ārzemju numuriem", () => {
    expect(normalizeWhatsAppPhoneDigits("+37061234567")).toBe("37061234567");
    expect(normalizeWhatsAppPhoneDigits("+372 5123 4567")).toBe("37251234567");
    expect(normalizeWhatsAppPhoneDigits("+49 151 12345678")).toBe("4915112345678");
    expect(normalizeWhatsAppPhoneDigits("+48 512 345 678")).toBe("48512345678");
    expect(normalizeWhatsAppPhoneDigits("0037061234567")).toBe("37061234567");
  });

  it("tukšu vai nederīgu ievadi neatgriež kā numuru", () => {
    expect(normalizeWhatsAppPhoneDigits("")).toBeNull();
    expect(normalizeWhatsAppPhoneDigits("   ")).toBeNull();
    expect(normalizeWhatsAppPhoneDigits("abc")).toBeNull();
    expect(normalizeWhatsAppPhoneDigits("+")).toBeNull();
    expect(normalizeWhatsAppPhoneDigits("12345")).toBeNull();
  });

  it("wa.me un web URL lieto tos pašus ciparus", () => {
    const lt = normalizeWhatsAppPhoneDigits("+37061234567");
    expect(lt).toBe("37061234567");
    expect(whatsAppChatUrl(lt!, "Sveiki")).toContain("37061234567");
  });
});
