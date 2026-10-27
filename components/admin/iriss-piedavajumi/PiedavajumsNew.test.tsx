import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));

import { PiedavajumsNew } from "@/components/admin/iriss-piedavajumi/PiedavajumsNew";
import { renderHtml, renderText } from "@/lib/test-render";

const car = { id: "ap-1", title: "Volvo XC60 B4", vinTail: "123456", plate: "", search: "volvo xc60", takenBy: "" };

describe("Jauns piedāvājums - viena ieeja", () => {
  it("4 avoti: Saite, Autoparks, Loģistika, Tukšs; noklusējumā Saite", () => {
    const text = renderText(<PiedavajumsNew cars={[car]} carsError="" />);
    for (const t of ["Saite", "Autoparks", "Loģistika", "Tukšs"]) expect(text).toContain(t);
    expect(renderHtml(<PiedavajumsNew cars={[car]} carsError="" />)).toMatch(/aria-selected="true"[^>]*>Saite</);
    expect(text).toContain("Klients nav obligāts");
  });

  it("no pasūtījuma - klients piesaistīts, to var noņemt", () => {
    const client = { name: "Jānis Ozols", phone: "", email: "", orderId: "o-7" };
    const text = renderText(
      <PiedavajumsNew cars={[car]} carsError="" entry={{ tab: "autoparks", carId: "", link: "", orderId: "o-7" }} client={client} />,
    );
    expect(text).toContain("Jānis Ozols");
    expect(text).toContain("noņemt");
    expect(text).toContain("Volvo XC60 B4");
  });
});
