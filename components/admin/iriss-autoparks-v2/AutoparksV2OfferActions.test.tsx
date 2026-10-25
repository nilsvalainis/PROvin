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

  it("tukšais piedāvājums iet bez from, auto piedāvājums ar autoparks avotu", () => {
    const html = renderHtml(<AutoparksV2OfferActions carId="car-1" />);
    expect(html).toContain("newOffer=1");
    expect(html).toContain("from=autoparks%3Acar-1");
    expect(html.match(/href="/g)?.length).toBe(2);
  });
});
