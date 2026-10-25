import { describe, expect, it } from "vitest";
import { IrissOfferSectionCard } from "@/components/admin/IrissOfferSection";
import { renderHtml, renderText } from "@/lib/test-render";

describe("j61 piedāvājuma sadaļas kartīte ar zaļo sviru", () => {
  it("ieslēgta svira: role=switch, checked, 'Rāda klientam'", () => {
    const html = renderHtml(
      <IrissOfferSectionCard title="Izsole" visible onVisibleChange={() => undefined}>
        <p>saturs</p>
      </IrissOfferSectionCard>,
    );
    expect(html).toContain('role="switch"');
    expect(html).toContain("checked");
    expect(html).toContain("iriss-offer-section-switch");
    expect(html).toContain('aria-label="Rādīt klientam: Izsole"');
    // Pieskāriena zona 44 px (h-11).
    expect(html).toContain("h-11");
    expect(renderText(<IrissOfferSectionCard title="Izsole" visible onVisibleChange={() => undefined} />)).toBe("Izsole Rāda klientam");
  });

  it("izslēgta svira rāda 'Paslēpts klientam'; bez sviras - tikai virsraksts", () => {
    expect(renderText(<IrissOfferSectionCard title="Cenas" visible={false} onVisibleChange={() => undefined} />)).toBe(
      "Cenas Paslēpts klientam",
    );
    const plain = renderHtml(<IrissOfferSectionCard title="Termiņš" />);
    expect(plain).not.toContain('role="switch"');
    expect(renderText(<IrissOfferSectionCard title="Termiņš" />)).toBe("Termiņš");
  });
});
