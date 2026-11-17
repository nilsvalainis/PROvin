import { describe, expect, it } from "vitest";
import { IrissButton, IrissChip, IrissDisclosure, IrissStatusPill, irissButtonClass } from "@/components/admin/iriss-ui/IrissUi";
import { renderHtml, renderText } from "@/lib/test-render";

describe("IRISS kopīgās komponentes (dizains v0.3)", () => {
  it("galvenā poga ir oranžā varianta poga ar type=button", () => {
    const html = renderHtml(<IrissButton variant="primary">Izveidot pavadzīmi</IrissButton>);
    expect(html).toContain('type="button"');
    expect(html).toContain("iriss-btn--primary");
    expect(irissButtonClass("secondary", "sm")).toBe("iriss-btn iriss-btn--secondary iriss-btn--sm");
  });

  it("statusa žetons nes toni un tekstu", () => {
    const html = renderHtml(<IrissStatusPill tone="warn">Rezervēts</IrissStatusPill>);
    expect(html).toContain("iriss-pill--warn");
    expect(renderText(<IrissStatusPill tone="ok">Pārdošanā</IrissStatusPill>)).toBe("Pārdošanā");
  });

  it("čips atzīmē atlasīto ar aria-pressed un rāda skaitu", () => {
    const html = renderHtml(
      <IrissChip pressed count={55}>
        Jauni
      </IrissChip>,
    );
    expect(html).toContain('aria-pressed="true"');
    expect(renderText(<IrissChip pressed={false} count={3}>Cenas</IrissChip>)).toContain("3");
  });

  it("aizveramais bloks pēc noklusējuma aizvērts, ar skaitu virsrakstā", () => {
    const closed = renderHtml(
      <IrissDisclosure title="Lietotāju darbības" count="212 ieraksti">
        x
      </IrissDisclosure>,
    );
    expect(closed).not.toContain(" open");
    expect(renderText(<IrissDisclosure title="Statusu vēsture" count="14">x</IrissDisclosure>)).toContain("14");
    expect(renderHtml(<IrissDisclosure title="Klients" defaultOpen>x</IrissDisclosure>)).toContain("open");
  });
});
