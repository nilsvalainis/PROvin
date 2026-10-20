import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iriss order overview layout", () => {
  it("keeps overview chrome, desktop without call, and avanss only on Pārskats", () => {
    const room = readFileSync("components/admin/IrissOrderRoom.tsx", "utf8");
    const steps = readFileSync("components/admin/IrissOrderRoomNextSteps.tsx", "utf8");
    const copy = readFileSync("lib/iriss-order-overview-view.ts", "utf8");

    expect(room).toContain("iriss-parskats-view");
    expect(room).toContain("bg-[var(--bg-base)]");
    expect(room).toContain("Klienta dati");
    expect(room).toContain("Klienta kontakti");
    expect(room).toContain("Avanss un darījums");
    expect(room).toContain("Atzīmēt avansu saņemtu");
    expect(room).toContain("Darījuma statuss");
    expect(room).toContain("InlineField");
    expect(room).toContain("Šis pasūtījums ir miskastē.");
    expect(room).toContain("Atjaunot");
    expect(room).toContain("initialTab");
    expect(room).toContain("Zvanīt");
    expect(room).toContain("WhatsApp");
    expect(room).toContain("md:hidden");
    expect(room).not.toMatch(/sticky top-0/);
    expect(room).not.toMatch(/\u2014|\u2013/);
    const css = readFileSync("app/admin/iriss/iriss-admin.css", "utf8");
    expect(css).toContain(".iriss-parskats-view .iriss-order-tabs");
    expect(css).toContain(".iriss-order-tabs [role=\"tab\"]");
    expect(steps).toContain("Atvērt Meklētāju");
    expect(copy).toContain("Meklējam");
    expect(copy).toContain("Avanss saņemts");
    expect(copy).toContain("pievienot");
    expect(copy).toContain("Saglabāts");
    expect(copy).toContain("Labo...");
  });
});
