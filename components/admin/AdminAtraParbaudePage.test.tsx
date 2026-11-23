import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/vin-scan",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { AdminAtraParbaudePage } from "@/components/admin/AdminAtraParbaudePage";
import { AdminDealerCheckPage } from "@/components/admin/AdminDealerCheckPage";
import { renderHtml } from "@/lib/test-render";
import { AdminAtraFactCards, AdminAtraPotential } from "@/components/admin/AdminAtraParbaudeFacts";
import { atraStoryScore, buildAtraFacts } from "@/lib/atra-parbaude-facts";

const VIN = "WBANP71040CY09201";

describe("Ātrā pārbaude (dators)", () => {
  it("admins: viens lauks, bezmaksas ieslēgti, maksas izslēgti, summa 0,00 €, dīlera daļa iegulta", () => {
    const html = renderHtml(
      <AdminAtraParbaudePage
        initialVin={VIN}
        isAdmin
        thecarapiEnabled
        dealer={{
          initialVin: VIN,
          initialPlate: "",
          initialCsdd: null,
          initialCsddMessage: "",
          fromAutoparks: false,
          initialRecord: null,
          initialEntries: [],
        }}
      />,
    );
    expect(html).toContain("VIN vai numurs");
    expect(html).toContain("Bezmaksas avoti");
    expect(html).toContain("EU izsoles (TheCarApi)");
    expect(html).toContain("Maksas avoti");
    expect(html).toContain("izslēgti");
    expect(html).toContain("Šī pārbaude maksās");
    expect(html).toContain("0,00 €");
    expect(html).toContain("Copart / IAAI (JoJ)");
    expect(html).toContain("Dzintarzeme Auto");
    expect(html).toContain("Pēdējās pārbaudes");
    expect(html).toContain("data-dealer-check-embedded");
    // e.csdd.lv saite paliek zemāk (liegumu kartīte augšā tikai ar meklēšanu).
    expect(html).toContain("Liegumi - pārbaudīt e.csdd.lv");
    // Iegultajā dīlera daļā nav otras meklēšanas un šablona.
    expect(html).not.toContain("Valsts numurzīme (v/n)");
    expect(html).not.toContain("Šablons - kam paredzēts");
  });

  it("darbinieks: tikai bezmaksas, bez maksas avotiem un dīlera datiem", () => {
    const html = renderHtml(<AdminAtraParbaudePage initialVin={VIN} isAdmin={false} thecarapiEnabled={false} dealer={null} />);
    expect(html).toContain("Bezmaksas avoti");
    expect(html).not.toContain("Maksas avoti");
    expect(html).not.toContain("EU izsoles (TheCarApi)");
    expect(html).not.toContain("data-dealer-check-embedded");
    expect(html).toContain(">Pārbaudīt<");
  });

  it("dīlera lapa bez embed - nemainīta (meklēšana, šablons, saraksts)", () => {
    const html = renderHtml(<AdminDealerCheckPage initialVin="" />);
    expect(html).toContain("Šablons - kam paredzēts");
    expect(html).toContain("Valsts numurzīme (v/n)");
    expect(html).toContain("Saglabātās pārbaudes");
  });

  it("faktu kartītes: liegumi ar e.csdd.lv saiti, potenciāls ar iemesliem; telefonā stikla krāsas", () => {
    const facts = buildAtraFacts({
      vin: VIN,
      plate: "",
      title: "BMW 530",
      year: "2006",
      rows: [
        {
          id: "csdd",
          label: "CSDD",
          country: "LV",
          status: "found",
          summary: "",
          mileage: [
            { date: "2015-04-29", odometer: "362320" },
            { date: "2017-05-13", odometer: "254471" },
          ],
        },
      ],
      dealer: null,
      csdd: null,
      hasListing: false,
    });
    const score = atraStoryScore(facts);
    const desk = renderHtml(
      <>
        <AdminAtraPotential score={score} />
        <AdminAtraFactCards facts={facts} vin={VIN} />
      </>,
    );
    expect(desk).toContain("Stāsta potenciāls");
    expect(desk).toContain("Notīts nobraukums ≥ 107 849 km");
    expect(desk).toContain("Kritums ≥ 107 849 km");
    // Tukšās kartītes («Jāpārbauda», «Nav datu», «Nav sludinājuma») augšā nav.
    expect(desk).not.toContain('data-atra-fact="Liegumi"');
    expect(desk).not.toContain("Nav datu");
    expect(desk).not.toContain("Nav sludinājuma");
    expect(desk).toContain('data-atra-facts-count="2"');
    const phone = renderHtml(<AdminAtraFactCards facts={facts} vin={VIN} glass />);
    expect(phone).toContain("var(--am-s1)");
    // Ar meklēšanu - liegumu kartīte ar e.csdd.lv saiti.
    const wanted = renderHtml(<AdminAtraFactCards facts={{ ...facts, wanted: ["LT policija"] }} vin={VIN} />);
    expect(wanted).toContain('href="https://e.csdd.lv/"');
    expect(wanted).toContain("Meklēšanā: 1");
  });
});
