import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iriss order overview layout", () => {
  it("keeps overview chrome, desktop without call, and avanss only on Pārskats", () => {
    const room = readFileSync("components/admin/IrissOrderRoom.tsx", "utf8");
    const clientCard = readFileSync("components/admin/IrissOrderClientDataCard.tsx", "utf8");
    const steps = readFileSync("components/admin/IrissOrderRoomNextSteps.tsx", "utf8");
    const copy = readFileSync("lib/iriss-order-overview-view.ts", "utf8");

    expect(room).toContain("iriss-parskats-view");
    expect(room).not.toMatch(/iriss-parskats-view[^\n]*bg-\[var\(--bg-base\)\]/);
    expect(clientCard).toContain("Klienta dati");
    // Nils 28.10: Pārskats pa soļiem, klienta kontakti - 8. (pēdējais) solis.
    expect(room).toContain("IRISS_ORDER_STEPS");
    expect(room).toContain("Finansējums, avanss un depozīts");
    // Pārskats v3 (Nils 28.10): avanss un finansējums vienā blokā, klients dublēts labajā pusē.
    expect(room).toContain("IrissAdvanceSection");
    expect(room).toContain("Darījums");
    expect(room).toContain("Klienta kontakti");
    expect(room).toContain("Modeļa paplašinājums");
    expect(room).toContain("Iekšējās piezīmes · aģentam un komandai");
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
    expect(css).toContain("var(--warn-bg");
    expect(css).toContain("var(--surface-2");
    expect(css).not.toMatch(/\.iriss-internal-badge\s*\{[^}]*#(?:fdba74|fff7ed|c2410c)/);
    expect(css).not.toMatch(/\.iriss-spec-calc-note\s*\{[^}]*(?:#eff6ff|--acc|#2563eb|#3d5bd9|#1d4ed8)/);
    expect(steps).toContain("Atvērt Meklētāju");
    expect(copy).toContain("Meklējam");
    expect(copy).toContain("Avanss saņemts");
    expect(copy).toContain("pievienot");
    expect(copy).toContain("Saglabāts");
    expect(copy).toContain("Labo...");
  });
});
