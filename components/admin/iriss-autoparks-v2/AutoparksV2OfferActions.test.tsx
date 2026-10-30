import { describe, expect, it } from "vitest";
import { AutoparksV2OfferActions } from "@/components/admin/iriss-autoparks-v2/AutoparksV2OfferActions";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Autoparks v2 piedāvājuma pogas (m09)", () => {
  it("rāda sekundāro + Piedāvājums un primāro Izveidot piedāvājumu", () => {
    const text = renderText(<AutoparksV2OfferActions carId="car-1" />);
    expect(text).toContain("+ Piedāvājums");
    expect(text).toContain("Izveidot piedāvājumu");
    expect(text).not.toContain("Peļņa");
  });

  it("abas pogas ved uz PD ieeju; auto piedāvājums ar autoparks avotu (Nils 27.10)", () => {
    const html = renderHtml(<AutoparksV2OfferActions carId="car-1" />);
    expect(html).toContain('href="/admin/iriss/piedavajumi/jauns"');
    expect(html).toContain("from=autoparks%3Acar-1");
    expect(html.match(/href="/g)?.length).toBe(2);
  });
});
