import { describe, expect, it } from "vitest";
import { IrissWaybillCarPicker, IrissWaybillMobileForm, WaybillLiveRow } from "@/components/admin/IrissWaybillMobileForm";
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

describe("pavadzīmes forma telefonā v2 (renderēta)", () => {
  it("rāda numurus, auto, sākuma adresi (Tukums, Rīgas iela 75), laiku un komentāru; galamērķa un VIN nav", () => {
    const text = renderText(form());
    for (const t of ["Numurs", "B193-7", "aizņemts", "brīvs", "Auto", "Izvēlies auto", "Sākuma adrese", "Tukums", "Cita adrese", "Rīgas iela 75", "Laiks", "12 h", "24 h", "48 h", "Derīga no šī brīža līdz", "Komentārs", "Izveidot pavadzīmi"]) {
      expect(text).toContain(t);
    }
    expect(text).not.toContain("Galamērķis");
    expect(text).not.toContain("Pievienot PDF");
    const html = renderHtml(form());
    expect(html).toContain('placeholder="193 uz BMW 330"');
    expect(html).toContain('placeholder="cits, h"');
    expect(html).not.toMatch(/placeholder="VIN|17 zīmes/);
    // 48 h ir noklusējums.
    expect(html).toMatch(/aria-pressed="true"[^>]*>48 h</);
  });

  it("'Kā tas strādā' ir liela kartīte ar numurētiem soļiem un 'Jāzina'", () => {
    const text = renderText(form());
    expect(text).toContain("Pavadzīme 4 soļos. Parasti gatava dažu minūšu laikā.");
    expect(text).toContain("Aivars ir Dzintarzeme Auto jaunais pavadzīmju rakstīšanas asistents");
    for (const t of ["Izvēlies numuru un auto", "Izvēlies laiku", 'Spied "Izveidot pavadzīmi"', "Ja numurs aizņemts", "Jāzina"]) {
      expect(text).toContain(t);
    }
    expect(text).toContain("Numuru salīdzināšana - CSDD Tukuma filiālē.");
    expect(text).toContain("Aivars to neizpilda kā komandu, citi to neredz.");
    // Tikai īsā defise: nav garās domuzīmes (kodi 8211, 8212).
    expect([...text].some((c) => c.charCodeAt(0) === 8211 || c.charCodeAt(0) === 8212)).toBe(false);
  });

  it("dzīvais statuss: josla ar soļiem, procenti un skaidrs 'Izrakstīta' ar PDF", () => {
    const working = renderHtml(
      <WaybillLiveRow
        row={{ id: "w1", title: "Audi A6 Avant", sub: "B762-7 · 48 h", label: "Izveido", tone: "wip", pdfUrl: "", canRetry: false, errorText: "", stale: false, progress: { step: 2, pct: 64, text: "Aivars raksta pavadzīmi CSDD..." } }}
      />,
    );
    expect(working).toContain('role="progressbar"');
    expect(working).toContain('aria-valuenow="64"');
    expect(working).toContain("Pavadzīmes statuss: Izveido, solis 2 no 3");
    expect(working).toContain("64 %");
    const doneText = renderText(
      <WaybillLiveRow
        row={{ id: "w2", title: "BMW 216d", sub: "26A1 · B193-7", label: "Izrakstīta", tone: "ok", pdfUrl: "/x.pdf", canRetry: false, errorText: "", stale: false, progress: { step: 3, pct: 100, text: "Nr. 26A1 · derīga līdz 25.10.2026, 12:00" } }}
      />,
    );
    expect(doneText).toContain("Izrakstīta");
    expect(doneText).toContain("PDF");
    expect(doneText).toContain("Nr. 26A1 · derīga līdz 25.10.2026, 12:00");
  });

  it("auto saraksts: 'Pieņemts' birka, VIN un pēdējā rinda 'Cits auto - ierakstīt ar roku'", () => {
    const text = renderText(
      <IrissWaybillCarPicker
        cars={[
          { id: "a", brandModel: "Volvo XC60", vin: "YV1UZA8V1M1765432", year: "2021", statusLabel: "Pārdošanā", accepted: false },
          { id: "b", brandModel: "Škoda Kodiaq", vin: "TMBJJ7NS1L8012345", year: "", statusLabel: "", accepted: true },
        ]}
        selected="YV1UZA8V1M1765432"
        onChoose={() => undefined}
      />,
    );
    expect(text).toContain("Volvo XC60");
    expect(text).toContain("YV1UZA8V1M1765432 · 2021");
    expect(text).toContain("Pārdošanā");
    expect(text).toContain("Pieņemts");
    expect(text.trim().endsWith("Cits auto - ierakstīt ar roku Marka un modelis")).toBe(true);
    expect(renderText(<IrissWaybillCarPicker cars={[]} selected="" onChoose={() => undefined} />)).toContain(
      "Nav auto ar tirdzniecības aktu.",
    );
  });
});
