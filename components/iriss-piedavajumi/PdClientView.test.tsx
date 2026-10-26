import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

import { PiedavajumiList } from "@/components/admin/iriss-piedavajumi/PiedavajumiList";
import { PdClientView } from "@/components/iriss-piedavajumi/PdClientView";
import { PdStatusChip } from "@/components/iriss-piedavajumi/PdStatusChip";
import { buildIrissPdPublicView, irissPdToListRow } from "@/lib/iriss-piedavajumi";
import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import { emptyIrissPiedavajums, IRISS_PD_STATUSES, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { renderHtml, renderText } from "@/lib/test-render";

const AT = "2026-10-26T10:00:00.000Z";
const NOW = Date.parse(AT);
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const AUTO1: IrissPdAuto1Blocks = {
  paint: { zones: [{ id: "front", readings: [276], warning: true }, { id: "roof", readings: [106], warning: false }, { id: "rear", readings: [], warning: false }, { id: "left", readings: [], warning: false }, { id: "right", readings: [129], warning: true }], unassigned: [] },
  tech: [{ label: "Izlaiduma gads", value: "2010" }, { label: "Degvielas tips", value: "Diesel" }],
  equipment: [{ name: "Āķis", detail: "Detachable tow hitch" }],
  service: [{ label: "Servisa grāmata", value: "Available" }],
  inspection: [{ label: "Pēdējās TA datums", value: "12/06/2024" }],
  damage: [{ area: "exterior", damage: "Scratch", severity: "Length: <20mm", description: "Deep scratch - down to primer", quantity: "25", parts: "Hood (4)" }],
  vinData: Array.from({ length: 20 }, (_, i) => `VIN opcija ${i + 1}`),
};

function rec(over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
  const r = emptyIrissPiedavajums(ID, AT);
  return {
    ...r,
    number: 217,
    status: "sent",
    validUntil: "2026-11-02",
    vehicle: { ...r.vehicle, title: "Ford Transit Custom 2.0 L2H1", vin: "WF0YXXTTGYKA34521" },
    price: "12750",
    source: "auto1",
    sourceUrl: "https://www.auto1.com/en/app/merchant/car/DE48213",
    purchasePrice: "9980",
    internalNotes: "SLEPENA-PIEZIME",
    photos: [{ kind: "url", url: "https://img.auto1.com/photo.jpg" }],
    auto1: AUTO1,
    ...over,
  };
}

const src = (n: number, s: string) => `/p/d/TOKEN/foto/${n}${s === "full" ? "?s=full" : ""}`;

describe("Klienta skats (publiskā saite)", () => {
  it("rāda auto, cenu, termiņu un ieslēgtos Auto1 blokus; bojājumi pēc noklusējuma paslēpti", () => {
    const text = renderText(<PdClientView view={buildIrissPdPublicView(rec(), "link", NOW)} mode="link" photoSrc={src} />).replace(/ /g, " ");
    expect(text).toContain("Ford Transit Custom 2.0 L2H1");
    expect(text).toContain("12 750 €");
    expect(text).toContain("līdz 02.11.2026");
    expect(text).toContain("Ārpuses krāsas karte");
    expect(text).toContain("◐ 276 µm");
    expect(text).toContain("Izlaiduma gads");
    expect(text).toContain("Āķis");
    expect(text).toContain("Dati pēc VIN");
    expect(text).not.toContain("Bojājumu kopsavilkums");
    expect(text).not.toContain("Deep scratch");
  });

  it("nekad: avots, izsoles saite/CDN, iepirkuma cena, iekšējās piezīmes", () => {
    const html = renderHtml(<PdClientView view={buildIrissPdPublicView(rec(), "link", NOW)} mode="link" photoSrc={src} />);
    for (const secret of ["auto1.com", "DE48213", "9980", "SLEPENA", "Auto1"]) expect(html).not.toContain(secret);
    expect(html).toContain('src="/p/d/TOKEN/foto/0?s=full"');
  });

  it("PDF režīmā visi «Dati pēc VIN» bez «Rādīt vairāk»; saitē - pirmie 16 + poga", () => {
    const pdf = renderText(<PdClientView view={buildIrissPdPublicView(rec(), "pdf", NOW)} mode="pdf" photoSrc={src} />);
    expect(pdf).toContain("VIN opcija 20");
    expect(pdf).not.toContain("Rādīt vairāk");
    const link = renderText(<PdClientView view={buildIrissPdPublicView(rec(), "link", NOW)} mode="link" photoSrc={src} />);
    expect(link).not.toContain("VIN opcija 20");
    expect(link).toContain("Rādīt vairāk (+4)");
  });

  it("admina priekšskatījums nosauc paslēptos blokus", () => {
    const text = renderText(<PdClientView view={buildIrissPdPublicView(rec(), "link", NOW)} mode="link" photoSrc={src} compact showHiddenNote />);
    expect(text).toContain("Paslēpts (saite=OFF): Bojājumu kopsavilkums.");
    expect(text).toContain("Nekad: avots, saite, iepirkuma cena");
  });
});

describe("Statusu čipi un saraksts", () => {
  it("visi 6 statusi ar LV tekstu", () => {
    const text = IRISS_PD_STATUSES.map((s) => renderText(<PdStatusChip status={s} />));
    expect(text).toEqual(["Pieprasīts", "Melnraksts", "Nosūtīts", "Apstiprināts", "Noraidīts", "Beidzies termiņš"]);
  });

  it("saraksts: darbība pēc statusa un beigušais rāda «Izveidot jaunu uz šī bāzes»", () => {
    const rows = [
      irissPdToListRow(rec({ status: "requested", number: 1, id: "11111111-1111-4111-8111-111111111111" })),
      irissPdToListRow(rec({ status: "sent", number: 2, id: "22222222-2222-4222-8222-222222222222", validUntil: "2026-10-20" })),
      irissPdToListRow(rec({ status: "approved", number: 3, id: "33333333-3333-4333-8333-333333333333", approvedOrderId: "44444444-4444-4444-8444-444444444444" })),
    ];
    const html = renderHtml(<PiedavajumiList rows={rows} nowMs={NOW} storeEnabled loadError="" />);
    const text = renderText(<PiedavajumiList rows={rows} nowMs={NOW} storeEnabled loadError="" />);
    expect(text).toContain("3 piedāvājumi · 1 auto = 1 piedāvājums");
    expect(text).toContain("Aizpildīt");
    expect(text).toContain("Izveidot jaunu uz šī bāzes");
    expect(text).toContain("Beidzies termiņš");
    expect(html).toContain('href="/admin/iriss/pasutijumi/44444444-4444-4444-8444-444444444444"');
    expect(text).toContain("✓ Auto1 dati ielasīti");
  });

  it("tukšs saraksts", () => {
    expect(renderText(<PiedavajumiList rows={[]} nowMs={NOW} storeEnabled loadError="" />)).toContain("Vēl nav neviena piedāvājuma.");
  });
});
