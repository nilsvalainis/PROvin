import { describe, expect, it } from "vitest";
import { AutoparksV2Csdd } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Csdd";
import { AutoparksV2List } from "@/components/admin/iriss-autoparks-v2/AutoparksV2List";
import { RegistryStaleBanner } from "@/components/admin/iriss-autoparks-v2/AutoparksV2RegistryFresh";
import type { AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { registryFreshness } from "@/lib/iriss-autoparks-registry-freshness";
import { renderHtml, renderText } from "@/lib/test-render";

const NOW = new Date("2026-11-17T20:00:00Z");
const fresh = registryFreshness({ registryDate: "2026-11-17", importedAt: "2026-11-17T01:41:00Z" }, NOW);
const warn = registryFreshness({ registryDate: "2026-11-14", importedAt: "2026-11-14T01:41:00Z" }, NOW);
const stale = registryFreshness({ registryDate: "2026-10-28", importedAt: "2026-10-28T09:14:00Z" }, NOW);

const basics: AutoparksV2Basics = {
  id: "ap-1", title: "Audi A4", make: "Audi", model: "A4", year: "2018", color: "", vin: "WAUZZZ8K0FA036715", plate: "",
  status: "for_sale", statusLabel: "Pārdošanā", owner: "IRISS", ownerLabel: "SIA ĪRISS", clientOrder: false, location: "",
  arrivedAt: "", archived: false, mileageKm: { value: null, csdd: false }, firstRegDate: { value: "", csdd: false },
  displacementCm3: { value: null, csdd: false }, powerKw: { value: null, csdd: false }, tyreSize: { value: "", csdd: false },
  gearbox: { value: "", csdd: false }, engine: { value: "", csdd: false },
  registry: { status: "accepted", actNo: "TA-1", actDate: "2026-10-01", known: true }, hasPhoto: false,
  extras: { keysCount: null, ownersCount: null, secondWheels: "", inspectionUntil: "" },
};

describe("CSDD reģistra svaigums Autoparkā", () => {
  it("sarakstā rāda svaiguma rindu bez joslas, kad dati ir svaigi", () => {
    const html = renderHtml(<AutoparksV2List initialCars={[]} registryFresh={fresh} />);
    expect(html).toContain("CSDD reģistrs: šodien 03:41");
    expect(html).toContain("ap2-fresh ok");
    expect(html).not.toContain("ap2-stale");
  });

  it("2-7 dienas - dzeltens teksts, josla vēl nav", () => {
    const html = renderHtml(<AutoparksV2List initialCars={[]} registryFresh={warn} />);
    expect(html).toContain("CSDD reģistrs: pirms 3 d. (14.11.)");
    expect(html).toContain("ap2-fresh warn");
    expect(html).not.toContain("ap2-stale");
  });

  it("vecāks par nedēļu - sarkanā josla ar pēdējo datumu un padomu", () => {
    const text = renderText(<AutoparksV2List initialCars={[]} registryFresh={stale} />);
    expect(text).toContain("CSDD reģistra dati nav atjaunoti 20 dienas");
    expect(text).toContain("Pēdējo reizi 28.10.");
    expect(text).toContain("Kas jādara?");
  });

  it("datums bez laika - joslā viens punkts, ne divi", () => {
    const dateOnly = registryFreshness({ registryDate: "2026-11-09", importedAt: "2026-11-10T04:40:00Z" }, NOW);
    const text = renderText(<RegistryStaleBanner fresh={dateOnly} />);
    expect(text).toContain("Pēdējo reizi 09.11. Akta nr.");
    expect(text).not.toContain("09.11..");
  });

  it("bez krātuves (null) neko nerāda", () => {
    const html = renderHtml(<AutoparksV2List initialCars={[]} registryFresh={null} />);
    expect(html).not.toContain("ap2-fresh");
  });

  it("josla nerādās svaigiem datiem un datiem bez datuma", () => {
    expect(renderHtml(<RegistryStaleBanner fresh={fresh} />)).toBe("");
    expect(renderHtml(<RegistryStaleBanner fresh={registryFreshness(null, NOW)} />)).toBe("");
  });

  it("CSDD cilnē rinda «Atjaunots» ar to pašu tekstu", () => {
    const text = renderText(<AutoparksV2Csdd basics={basics} fresh={stale} />);
    expect(text).toContain("Atjaunots");
    expect(text).toContain("pirms 20 d. (28.10.)");
    expect(renderText(<AutoparksV2Csdd basics={basics} />)).not.toContain("Atjaunots");
  });
});
