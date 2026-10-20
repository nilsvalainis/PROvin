import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iriss order communication layout", () => {
  it("keeps Visi, type segments, notes and desktop without call", () => {
    const room = readFileSync("components/admin/IrissOrderRoom.tsx", "utf8");
    const timeline = readFileSync("components/admin/IrissCommunicationTimeline.tsx", "utf8");
    expect(room).toContain("iriss-komunikacija-view");
    expect(room).toContain("Nosūtīts WhatsApp");
    expect(room).toContain("Neatzīmēts zvans");
    expect(room).toContain("Klientu atbilžu vēl nav.");
    expect(room).toContain("Rakstīt piezīmi vai WhatsApp melnrakstu");
    expect(room).toContain("Ātrā saziņa");
    expect(room).toContain("Zvanīt");
    expect(room).toContain("md:hidden");
    expect(timeline).toContain("Visi");
    expect(timeline).toContain("Viss");
    expect(timeline).toContain("Klienta atbilde");
    expect(timeline).toContain("Neatzīmēts zvans");
    expect(room).not.toMatch(/sticky top-0/);
    expect(room).not.toMatch(/\u2014|\u2013/);
    expect(timeline).not.toMatch(/\u2014|\u2013/);
  });
});
