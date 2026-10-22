import { describe, expect, it } from "vitest";
import { IrissWaybillCarPicker, IrissWaybillMobileForm } from "@/components/admin/IrissWaybillMobileForm";
import { renderHtml, renderText } from "@/lib/test-render";

const plates = [
  { plate: "B193-7" as const, busy: true },
  { plate: "B762-7" as const, busy: false },
  { plate: "B192-7" as const, busy: false },
];

function form() {
  return (
    <IrissWaybillMobileForm
      plates={plates}
      tradeCars={[]}
      requests={[]}
      replies={[]}
      busy={false}
      error={null}
      draft={null}
      onSubmit={async () => true}
      onRetry={() => undefined}
    />
  );
}

describe("pavadzīmes forma telefonā (renderēta)", () => {
  it("rāda numurus, auto izvēli, stundas, maršrutu un komentāru bez VIN lauka", () => {
    const text = renderText(form());
    for (const t of ["Numurs", "B193-7", "aizņemts", "brīvs", "Auto", "Izvēlies auto", "Derīgums", "12 h", "24 h", "48 h", "Sākums", "Galamērķis", "Tukums", "Cits", "Komentārs", "Izveidot pavadzīmi"]) {
      expect(text).toContain(t);
    }
    const html = renderHtml(form());
    expect(html).toContain('placeholder="193 uz BMW 330"');
    expect(html).toContain('placeholder="cits, h"');
    expect(html).not.toMatch(/placeholder="VIN|17 zīmes/);
    expect(html).not.toContain("Ja ievadīts VIN");
    // 48 h ir noklusējums.
    expect(html).toMatch(/aria-pressed="true"[^>]*>48 h</);
  });

  it("īsi paskaidrojumi: plūsma, tikai komentārs uz 48 h, Tukuma CSDD, neuzticams komentārs", () => {
    const text = renderText(form());
    expect(text).toContain("Izvēlies auto no saraksta vai uzraksti pavadzīmi transportlīdzekļa pārvietošanai uz tirdzniecības vietu.");
    expect(text).toContain('Pietiek ar komentāru, piem., "193 uz BMW 330". Pavadzīmi izdod uz 48 h.');
    expect(text).toContain("Numuru salīdzināšana: CSDD Tukuma filiāle. Ja vajag citu vietu, raksti komentārā.");
    expect(text).toContain("Aivars to neizpilda kā komandu, citi aģenti to neredz.");
    expect(text).toContain("Aivars izveido tikai pavadzīmes");
    // Tikai īsā defise: nav garās domuzīmes (kodi 8211, 8212).
    expect([...text].some((c) => c.charCodeAt(0) === 8211 || c.charCodeAt(0) === 8212)).toBe(false);
  });

  it("auto saraksts: statusa birka, VIN un pēdējā rinda 'Cits auto - ierakstīt ar roku'", () => {
    const text = renderText(
      <IrissWaybillCarPicker
        cars={[{ id: "a", brandModel: "Volvo XC60", vin: "YV1UZA8V1M1765432", year: "2021", statusLabel: "Pārdošanā" }]}
        selected="YV1UZA8V1M1765432"
        onChoose={() => undefined}
      />,
    );
    expect(text).toContain("Volvo XC60");
    expect(text).toContain("YV1UZA8V1M1765432 · 2021");
    expect(text).toContain("Pārdošanā");
    expect(text.trim().endsWith("Cits auto - ierakstīt ar roku Marka un modelis")).toBe(true);
    expect(renderText(<IrissWaybillCarPicker cars={[]} selected="" onChoose={() => undefined} />)).toContain(
      "Nav auto ar tirdzniecības aktu.",
    );
  });
});
