import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/vin-scan",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { AdminAtraParbaudePage } from "@/components/admin/AdminAtraParbaudePage";
import { AdminDealerCheckPage } from "@/components/admin/AdminDealerCheckPage";
import { renderHtml } from "@/lib/test-render";

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
});
