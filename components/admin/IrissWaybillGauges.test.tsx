import { describe, expect, it } from "vitest";
import { IrissWaybillGauges, WaybillHomeCar } from "@/components/admin/IrissWaybillGauges";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Pavadzīmju sākuma hero (v11d-fix stikls)", () => {
  it("float + saite: bez virsraksta un bez Visas, viss ir pieskāriens, visas mašīnas redzamas", () => {
    const html = renderHtml(<IrissWaybillGauges chrome="float" allHref={null} href="/admin/iriss/pavadzimes" />);
    const text = renderText(<IrissWaybillGauges chrome="float" allHref={null} href="/admin/iriss/pavadzimes" />);
    expect(html).toContain('href="/admin/iriss/pavadzimes"');
    expect(html).toContain('aria-label="Pavadzīmes"');
    expect(html).not.toContain("Visas");
    expect(html).not.toContain("Karte");
    expect(text).not.toContain("Pavadzīmes");
    expect(html).toContain("B193");
    expect(html).toContain("B762");
    expect(html).toContain("B192");
  });

  it("kartītes režīms saglabā virsrakstu sānjoslai / lapai", () => {
    const text = renderText(<IrissWaybillGauges allHref={null} />);
    expect(text).toContain("Pavadzīmes");
    expect(text).not.toContain("Visas ›");
  });

  it("modeļa rinda rāda pilnu nosaukumu un title, bez 2 vārdu nogriešanas", () => {
    const html = renderHtml(
      <WaybillHomeCar busy status="ok" brandModel="MERCEDES-BENZ E 220 D All-Terrain" />,
    );
    const text = renderText(
      <WaybillHomeCar busy status="ok" brandModel="MERCEDES-BENZ E 220 D All-Terrain" />,
    );
    expect(text).toBe("MERCEDES-BENZ E 220 D All-Terrain");
    expect(html).toContain('title="MERCEDES-BENZ E 220 D All-Terrain"');
    expect(text.split(/\s+/)).toHaveLength(5);
  });

  it("brīvam bez modeļa nav title", () => {
    const html = renderHtml(<WaybillHomeCar busy={false} status="free" brandModel="" />);
    expect(renderText(<WaybillHomeCar busy={false} status="free" brandModel="" />)).toBe("-");
    expect(html).not.toContain("title=");
  });
});
