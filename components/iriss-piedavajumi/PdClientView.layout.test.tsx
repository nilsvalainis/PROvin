import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
vi.mock("next/image", () => ({
  default: (props: { alt?: string; src?: unknown }) =>
    createElement("img", { alt: props.alt ?? "", src: typeof props.src === "string" ? props.src : "" }),
}));

import { PdClientView } from "@/components/iriss-piedavajumi/PdClientView";
import { PdPaintMap } from "@/components/iriss-piedavajumi/PdPaintMap";
import { buildIrissPdPublicView } from "@/lib/iriss-piedavajumi";
import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import { irissPdDisplayValue } from "@/lib/iriss-piedavajumi-display";
import { emptyIrissPiedavajums, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { renderHtml, renderText } from "@/lib/test-render";

const AT = "2026-11-17T10:00:00.000Z";
const NOW = Date.parse(AT);
const ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const AUTO1: IrissPdAuto1Blocks = {
  paint: {
    zones: [
      { id: "front", readings: [112, 118, 276, 121, 130], warning: true },
      { id: "roof", readings: [106], warning: false },
      { id: "rear", readings: [], warning: false },
      { id: "left", readings: [101, 99, 104, 108, 251, 97], warning: false },
      { id: "right", readings: [129], warning: true },
    ],
    unassigned: [88],
  },
  tech: [{ label: "Izlaiduma gads", value: "2016" }],
  equipment: [{ name: "Āķis", detail: "Detachable tow hitch" }],
  service: [
    { label: "Servisa grāmata", value: "Available" },
    { label: "Servisa apmeklējumi", value: "Some" },
    { label: "Pēdējais serviss", value: "12/21/2020" },
    { label: "Pēdējā servisa km", value: "130,129 km" },
  ],
  inspection: [{ label: "Pēdējās TA datums", value: "12/06/2024" }],
  damage: [],
  vinData: ["VIN opcija 1", "VIN opcija 2"],
};

function rec(): IrissPiedavajums {
  const r = emptyIrissPiedavajums(ID, AT);
  return {
    ...r,
    number: 301,
    status: "sent",
    validUntil: "2026-11-30",
    vehicle: { ...r.vehicle, title: "BMW 320d Touring", vin: "WBA8E1105GK000001" },
    price: "18900",
    source: "auto1",
    auto1: AUTO1,
  };
}

const src = (n: number) => `/p/d/T/foto/${n}`;

describe("Auto1 vērtības latviski", () => {
  it("tulko vārdus, ASV datumu un tūkstošus", () => {
    expect(irissPdDisplayValue("Available")).toBe("Ir");
    expect(irissPdDisplayValue("Some")).toBe("Daļēji");
    expect(irissPdDisplayValue("not available")).toBe("Nav");
    expect(irissPdDisplayValue("12/21/2020")).toBe("21.12.2020");
    expect(irissPdDisplayValue("130,129 km")).toBe("130 129 km");
    expect(irissPdDisplayValue("-")).toBe("-");
    expect(irissPdDisplayValue("Diesel")).toBe("Diesel");
    expect(irissPdDisplayValue("13/45/2020")).toBe("13/45/2020");
  });
});

describe("Krāsas karte", () => {
  it("tabulā rāda visus mērījumus katrai zonai un bez zonas", () => {
    const text = renderText(<PdPaintMap paint={AUTO1.paint!} />).replace(/ /g, " ");
    for (const n of [112, 118, 276, 121, 130, 101, 99, 104, 108, 251, 97, 88]) {
      expect(text).toContain(`${n} µm`);
    }
    expect(text).toContain("Bez zonas");
    expect(text).toContain("▲ zonā atrasti bojājumi (buktes, skrāpējumi u.c.)");
    expect(text).not.toContain("Vēl:");
  });

  it("karte ir audita atskaites auto bilde, ne zīmējums; plastmasas zona - «nav mērāms»", () => {
    const paint = { zones: [...AUTO1.paint!.zones.filter((z) => z.id !== "rear"), { id: "rear" as const, readings: [], warning: false, notMeasurable: true }], unassigned: [] };
    const html = renderHtml(<PdPaintMap paint={paint} />);
    expect(html).toContain('src="/brand/damage-car-top-east.jpg"');
    expect(html).not.toContain("<svg");
    const text = renderText(<PdPaintMap paint={paint} />);
    expect(text).toContain("nav mērāms");
    expect(text).toContain("nav mērāms (materiāls)");
    // Izvēlēta pirmā zona ar ▲ (priekšpuse): tās laukums iezīmēts.
    expect(html).toMatch(/pd-pm-area sel/);
  });
});

describe("Bojājumu tabula", () => {
  it("grupē pa ārpusi/salonu, saskaita pa veidiem un tulko detaļas", () => {
    const blocks: IrissPdAuto1Blocks = {
      ...AUTO1,
      damage: [
        { area: "exterior", damage: "Scratch", severity: "", description: "", quantity: "25", parts: "Hood (4), Front bumper (21)" },
        { area: "exterior", damage: "Scratch", severity: "", description: "", quantity: "3", parts: "Roof (3)" },
        { area: "exterior", damage: "Dent", severity: "", description: "", quantity: "1", parts: "Front right door (1)" },
        { area: "interior", damage: "Dirty", severity: "", description: "", quantity: "2", parts: "Driver seat (2)" },
      ],
    };
    const base = rec();
    const r: IrissPiedavajums = {
      ...base,
      auto1: blocks,
      visibility: { ...base.visibility, blocks: { ...base.visibility.blocks, damage: { pdf: true, link: true } } },
    };
    const html = renderHtml(<PdClientView view={buildIrissPdPublicView(r, "link", NOW)} mode="link" photoSrc={src} />);
    const text = renderText(<PdClientView view={buildIrissPdPublicView(r, "link", NOW)} mode="link" photoSrc={src} />);
    expect(html).toContain("data-damage-table");
    expect(text).toContain("Skrāpējumi");
    expect(text).toContain("28");
    expect(text).toContain("Motora pārsegs (4)");
    expect(text).toContain("Priekšējās labās durvis (1)");
    expect(text).toContain("Salons");
    expect(text).not.toContain("Scratch");
  });
});

describe("Klienta skata secība (Nils 17.11)", () => {
  const html = renderHtml(<PdClientView view={buildIrissPdPublicView(rec(), "link", NOW)} mode="link" photoSrc={src} />);
  const at = (block: string) => html.indexOf(`data-block="${block}"`);

  it("Servisa dati ir atsevišķa kartīte ar latviskām vērtībām", () => {
    expect(at("service")).toBeGreaterThan(-1);
    const text = renderText(<PdClientView view={buildIrissPdPublicView(rec(), "link", NOW)} mode="link" photoSrc={src} />);
    expect(text).toContain("21.12.2020");
    expect(text).not.toContain("Available");
    expect(text).not.toContain("12/21/2020");
  });

  it("aprīkojums un Dati pēc VIN ir pašā apakšā un izvēršami (saitē aizvērti)", () => {
    expect(at("paint")).toBeGreaterThan(-1);
    expect(at("equipment")).toBeGreaterThan(at("service"));
    expect(at("vin")).toBeGreaterThan(at("equipment"));
    expect(at("equipment")).toBeGreaterThan(at("paint"));
    expect(html).toMatch(/<details[^>]*data-block="equipment"/);
    expect(html).not.toMatch(/<details[^>]*data-block="equipment"[^>]*open/);
  });

  it("PDF režīmā izvēršamās sadaļas ir atvērtas", () => {
    const pdf = renderHtml(<PdClientView view={buildIrissPdPublicView(rec(), "pdf", NOW)} mode="pdf" photoSrc={src} />);
    expect(pdf).toMatch(/<details[^>]*open[^>]*data-block="equipment"|<details[^>]*data-block="equipment"[^>]*open/);
  });
});
