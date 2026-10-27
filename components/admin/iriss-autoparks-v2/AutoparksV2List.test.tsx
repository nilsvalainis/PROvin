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
    make: "Volkswagen",
    purchaseDate: "",
    purchasePriceEur: null, vatMode: "", clientOrder: false, inTrade: false,
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
    make: "Audi",
    purchaseDate: "",
    purchasePriceEur: null, vatMode: "", clientOrder: false, inTrade: false,
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

  it("telefona kartītē statuss vārdos, bez krāsas (makets B, 28.10)", () => {
    const text = renderText(<AutoparksV2ListBody rows={rows} onStatus={() => {}} />);
    expect(text).toContain("Servisā");
    expect(text).toContain("Pārdošanā");
    const html = renderHtml(<AutoparksV2ListBody rows={rows} onStatus={() => {}} />);
    expect(html).toMatch(/class="ap2-mst">Servisā</);
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

  it("ar Loģistikas tiesību rāda pāreju uz Loģistiku ar aktīvo auto skaitu", () => {
    const html = renderHtml(<AutoparksV2List initialCars={rows} logisticsCount={6} />);
    expect(html).toContain('href="/admin/iriss/logistika?view=map"');
    expect(renderText(<AutoparksV2List initialCars={rows} logisticsCount={6} />)).toMatch(/6\s*Loģistika →/);
  });

  it("bez Loģistikas tiesības pārejas nav", () => {
    expect(renderHtml(<AutoparksV2List initialCars={rows} />)).not.toContain("/admin/iriss/logistika");
  });
});

describe("Autoparks saraksts (Nils 27.10 makets)", () => {
  const withData = rows.map((r, i) => ({ ...r, vatMode: i === 0 ? ("margin" as const) : ("" as const), purchaseDate: i === 0 ? "2026-10-20" : "" }));

  it("kolonnas PVN un Iegāde; nav zināms - «-»", () => {
    const text = renderText(<AutoparksV2List initialCars={withData} showVat />);
    expect(text).toContain("PVN");
    expect(text).toContain("Margin");
    expect(text).toContain("20.10.2026");
  });

  it("ar Pamatdatu tiesību statusu maina sarakstā (izvēle ar visiem statusiem), bez tās - tikai žetons", () => {
    const html = renderHtml(<AutoparksV2List initialCars={withData} canChangeStatus />);
    expect(html).toContain("Mainīt statusu");
    expect(html).toContain("Noliktavā");
    expect(html).not.toContain("Pasūtījums");
    expect(renderHtml(<AutoparksV2List initialCars={withData} />)).not.toContain("Mainīt statusu");
  });

  it("katrs auto - sava kartīte ar saiti uz kabinetu", () => {
    const html = renderHtml(<AutoparksV2ListBody rows={withData} />);
    expect(html.match(/class="ap2-row"/g)).toHaveLength(2);
    expect(html).toContain('href="/admin/iriss/autoparks-v2/a"');
  });
});

describe("Pasūtījums (Nils 27.10)", () => {
  it("atzīme rindā, nevis atsevišķs statuss", () => {
    const text = renderText(<AutoparksV2ListBody rows={[{ ...rows[0]!, clientOrder: true }]} />);
    expect(text).toContain("Pasūtījums");
    expect(renderText(<AutoparksV2ListBody rows={rows} />)).not.toContain("Pasūtījums");
  });
});
