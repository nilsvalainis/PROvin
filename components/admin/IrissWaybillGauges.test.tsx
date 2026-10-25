import { describe, expect, it } from "vitest";
import { IrissWaybillGauges } from "@/components/admin/IrissWaybillGauges";
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
});
