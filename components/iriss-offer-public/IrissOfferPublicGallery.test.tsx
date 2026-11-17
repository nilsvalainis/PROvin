import { describe, expect, it } from "vitest";
import { IrissOfferPublicGallery } from "@/components/iriss-offer-public/IrissOfferPublicGallery";
import { renderHtml } from "@/lib/test-render";

const photos = [{ id: "hero-1" }, { id: "side-2" }, { id: "rear-3" }];

describe("IRISS public offer gallery", () => {
  it("loads the stored full hero first and only small thumbs in the strip", () => {
    const html = renderHtml(<IrissOfferPublicGallery token="tokA" title="Volvo XC90" photos={photos} />);
    expect(html).toContain('src="/p/tokA/photo/hero-1"');
    expect(html).toContain("/p/tokA/photo/hero-1?v=display&amp;w=480 480w, /p/tokA/photo/hero-1 1600w");
    expect(html).toContain('sizes="(min-width: 640px) 688px, 100vw"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('src="/p/tokA/photo/hero-1?v=thumb"');
    expect(html).toContain('src="/p/tokA/photo/side-2?v=thumb"');
    expect(html).not.toContain("v=display&amp;w=800");
    expect(html).not.toContain("v=display&amp;w=1280");
    expect(html).not.toContain("blur-xl");
  });
});
