import { describe, expect, it } from "vitest";
import { AutoparksV2List, AutoparksV2ListBody } from "@/components/admin/iriss-autoparks-v2/AutoparksV2List";
import type { AutoparksV2ListRow } from "@/lib/iriss-autoparks-v2-list";
import { renderHtml, renderText } from "@/lib/test-render";

const rows: AutoparksV2ListRow[] = [
  {
    id: "a",
    title: "Volkswagen Passat Variant",
    year: "2019",
    color: "Pelēka",
    vin: "WVWZZZ3CZKE012345",
    status: "in_service",
    owner: "IRISS",
    archived: false,
    hasPhoto: false,
    statusChangedAt: "2026-10-20",
  },
  {
    id: "b",
    title: "Audi A6 Avant",
    year: "2018",
    color: "Zila",
    vin: "WAUZZZ4G6JN445566",
    status: "for_sale",
    owner: "IRISS",
    archived: false,
    hasPhoto: false,
    statusChangedAt: "2026-10-21",
  },
];

describe("Autoparks v2 saraksts (m01 plakans)", () => {
  it("rāda kartītes bez statusa sadaļu virsrakstiem", () => {
    const html = renderHtml(<AutoparksV2ListBody rows={rows} />);
    const text = renderText(<AutoparksV2ListBody rows={rows} />);
    expect(html).not.toContain("ap2-sec");
    expect(html).not.toContain("<section");
    expect(text).toContain("Volkswagen Passat Variant");
    expect(text).toContain("Audi A6 Avant");
    expect(text).toContain("WVWZZZ3CZKE012345");
  });

  it("statuss uz kartītes nav sadaļas virsraksts (desktop kolonna paliek .cols)", () => {
    const html = renderHtml(<AutoparksV2ListBody rows={rows} />);
    expect(html).toContain("ap2-row");
    expect(html.match(/ap2-sec/g)).toBeNull();
  });
});

describe("Autoparks v2 saraksts bez Pamatdatu tiesības (j69)", () => {
  it("darbinieks tikai ar Servisu redz auto, bet ne pogu + Auto", () => {
    const text = renderText(<AutoparksV2List initialCars={rows} canAddCar={false} />);
    expect(text).toContain("Volkswagen Passat Variant");
    expect(text).not.toContain("+ Auto");
  });

  it("ar Pamatdatiem poga + Auto paliek", () => {
    expect(renderText(<AutoparksV2List initialCars={rows} canAddCar />)).toContain("+ Auto");
  });
});
