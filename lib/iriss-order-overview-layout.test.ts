import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iriss order overview layout", () => {
  it("keeps overview chrome, desktop without call, and avanss only on Pārskats", () => {
    const room = readFileSync("components/admin/IrissOrderRoom.tsx", "utf8");
    const steps = readFileSync("components/admin/IrissOrderRoomNextSteps.tsx", "utf8");
    const copy = readFileSync("lib/iriss-order-overview-view.ts", "utf8");

    expect(room).toContain("iriss-parskats-view");
    expect(room).not.toMatch(/iriss-parskats-view[^\n]*bg-\[var\(--bg-base\)\]/);
    expect(room).toContain("Klienta dati");
    expect(room).not.toContain("Klienta kontakti");
    expect(room).toContain("Avanss un darījums");
    expect(room).toContain("Atzīmēt avansu saņemtu");
    expect(room).toContain("Darījuma statuss");
    expect(room).toContain("IrissOrderClientDataCard");
    expect(room).toContain("Modeļa paplašinājums");
    expect(room).toContain("Piezīmes aģentam");
    expect(room).toContain("Piezīmes (iekšējās)");
    expect(room).toContain("Degviela");
    expect(room).not.toContain("VIN (ja zināms)");
    expect(room).not.toContain("InlineField");
    expect(room).toContain("Šis pasūtījums ir miskastē.");
    expect(room).toContain("Atjaunot");
    expect(room).toContain("initialTab");
    expect(room).toContain("Zvanīt");
    expect(room).toContain("WhatsApp");
    expect(room).toContain("md:hidden");
    expect(room).not.toMatch(/sticky top-0/);
    expect(room).not.toMatch(/\u2014|\u2013/);
    const editor = readFileSync("components/admin/IrissPasutijumsEditor.tsx", "utf8");
    expect(editor).toContain("Modeļa paplašinājums");
    expect(editor).toContain("Piezīmes aģentam");
    expect(editor).toContain("Piezīmes (iekšējās)");
    expect(editor).toContain('label="Modeļa paplašinājums"');
    expect(editor).not.toContain("VIN (ja zināms)");

    const css = readFileSync("app/admin/iriss/iriss-admin.css", "utf8");
    expect(css).toContain(".iriss-parskats-view .iriss-order-tabs");
    expect(css).toContain(".iriss-order-tabs [role=\"tab\"]");
    expect(css).toContain("minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr)");
    expect(css).toContain(".iriss-spec-calc-note");
    expect(css).toContain(".iriss-internal-badge");
    expect(steps).toContain("Atvērt Meklētāju");
    expect(copy).toContain("Meklējam");
    expect(copy).toContain("Avanss saņemts");
    expect(copy).toContain("pievienot");
    expect(copy).toContain("Saglabāts");
    expect(copy).toContain("Labo...");
  });
});
