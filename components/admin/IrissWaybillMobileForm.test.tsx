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
    for (const t of ["Numurs", "B193-7", "aizņemts", "brīvs", "Auto", "Izvēlies auto", "Sākuma adrese", "Tukums", "Cita adrese", "Rīgas iela 75", "Laiks", "1 h", "12 h", "48 h", "Cits", "derīga līdz", "Komentārs", "Izveidot pavadzīmi"]) {
      expect(text).toContain(t);
    }
    expect(text).not.toContain("Galamērķis");
    expect(text).not.toContain("Pievienot PDF");
    const html = renderHtml(form());
    expect(html).toContain('placeholder="193 uz BMW 330"');
    expect(html).not.toMatch(/placeholder="VIN|17 zīmes/);
    // Laika izvēles TIEŠI 1 h, 12 h, 48 h, Cits (24 h vairs nav); noklusējums 12 h; brīvais lauks tikai pēc "Cits".
    const hourButtons = [...html.matchAll(/aria-pressed="(true|false)"[^>]*>(\d+ h|Cits)</g)].map((m) => m[2]);
    expect(hourButtons).toEqual(["1 h", "12 h", "48 h", "Cits"]);
    expect(text).not.toContain("24 h");
    expect(html).toMatch(/aria-pressed="true"[^>]*>12 h</);
    expect(html).not.toContain('aria-label="Cits derīguma ilgums stundās"');
    expect(text).toContain("Aivars izveido tikai pavadzīmes");
  });

  it("'Kā tas strādā' ir liela kartīte ar numurētiem soļiem un 'Jāzina'", () => {
    const text = renderText(form());
    expect(text).toContain("Pavadzīme 5 soļos. Parasti gatava dažu minūšu laikā.");
    expect(text).toContain("Aivars ir Dzintarzeme Auto jaunais pavadzīmju asistents");
    for (const t of ["Izvēlies numuru un auto", "Izvēlies laiku", 'Spied "Izveidot pavadzīmi"', "Ja numurs aizņemts", "Jāzina"]) {
      expect(text).toContain(t);
    }
    expect(text).toContain("Numuru salīdzināšana - CSDD Tukuma filiālē.");
    expect(text).toContain("Aivars to neizpilda kā komandu, citi to neredz.");
    expect(text).toContain("tad jānorāda tikai laiks un komersanta pārstāvis.");
    expect(text).toContain('Izvēlies 1, 12 vai 48 h, vai "Cits" un ieraksti stundas (1-48).');
    // Tikai īsā defise: nav garās domuzīmes (kodi 8211, 8212).
    expect([...text].some((c) => c.charCodeAt(0) === 8211 || c.charCodeAt(0) === 8212)).toBe(false);
  });

  it("dzīvais statuss: josla ar soļiem bez procentu teksta un skaidrs 'Izdota' ar PDF", () => {
    const working = renderHtml(
      <WaybillLiveRow
        row={{ id: "w1", title: "Audi A6 Avant", sub: "B762-7 · 48 h", label: "Izveido", tone: "wip", pdfUrl: "", canRetry: false, canCancel: false, errorText: "", stale: false, writtenOff: false, progress: { step: 2, pct: 62, text: "Aizpilda CSDD formu..." }, line: "Aizpilda CSDD formu... · solis 2 no 3", note: "" }}
        onCancel={() => undefined}
      />,
    );
    expect(working).toContain('role="progressbar"');
    expect(working).toContain("Pavadzīmes statuss: Izveido, solis 2 no 3");
    expect(working).toContain("Aizpilda CSDD formu... · solis 2 no 3");
    expect(working).not.toContain("62 %");
    // Darbā esošu atcelt nevar.
    expect(working).not.toContain("Atcelt");
    const doneText = renderText(
      <WaybillLiveRow
        row={{ id: "w2", title: "BMW 216d", sub: "26A1 · B193-7", label: "Izdota", tone: "ok", pdfUrl: "/x.pdf", canRetry: false, canCancel: false, errorText: "", stale: false, writtenOff: false, progress: { step: 3, pct: 100, text: "Nr. 26A1 · derīga līdz 25.10.2026, 12:00" }, line: "Nr. 26A1 · derīga līdz 25.10.2026, 12:00 · solis 3 no 3", note: "Saglabāta Arhīvā" }}
      />,
    );
    expect(doneText).toContain("Izdota");
    expect(doneText).toContain("PDF");
    expect(doneText).toContain("Nr. 26A1 · derīga līdz 25.10.2026, 12:00 · solis 3 no 3");
    expect(doneText).toContain("Saglabāta Arhīvā");
  });

  it("gaidošam, vēl nepaņemtam pieprasījumam ir 'Atcelt'", () => {
    const text = renderText(
      <WaybillLiveRow
        row={{ id: "w3", title: "Peugeot 5008", sub: "B193-7 · 1 h", label: "Gaida", tone: "wait", pdfUrl: "", canRetry: false, canCancel: true, errorText: "", stale: false, writtenOff: false, progress: { step: 1, pct: 10, text: "Termiņš beidzies - atcel un izveido jaunu" }, line: "Termiņš beidzies - atcel un izveido jaunu", note: "" }}
        onCancel={() => undefined}
      />,
    );
    expect(text).toContain("Atcelt");
    expect(text).toContain("Termiņš beidzies - atcel un izveido jaunu");
  });

  it("izrakstīta pavadzīme: 'Izrakstīta', kad un vai numurs brīvs, norāde uz Arhīvu, bez joslas", () => {
    const html = renderHtml(
      <WaybillLiveRow
        row={{ id: "w4", title: "BMW 216d", sub: "Izrakstīta 23.10.2026, 12:00 · numurs B193-7 atkal ir brīvs", label: "Izrakstīta", tone: "wait", pdfUrl: "/x.pdf", canRetry: false, canCancel: false, errorText: "", stale: false, writtenOff: true, progress: { step: 3, pct: 100, text: "" }, line: "Pavadzīme vairs nav derīga. Atrodama Arhīvā.", note: "" }}
      />,
    );
    expect(html).toContain("Izrakstīta 23.10.2026, 12:00 · numurs B193-7 atkal ir brīvs");
    expect(html).toContain("Pavadzīme vairs nav derīga. Atrodama Arhīvā.");
    expect(html).not.toContain('role="progressbar"');
  });

  it("saite 'Visas pavadzīmes Arhīvā ›' ir tikai, ja lapa prot atvērt Arhīvu", () => {
    expect(renderText(form())).not.toContain("Visas pavadzīmes Arhīvā");
    const withArchive = renderText(
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
        onOpenArchive={() => undefined}
      />,
    );
    expect(withArchive).toContain("Visas pavadzīmes Arhīvā ›");
  });

  it("auto saraksts: 'Pieņemts' birka, VIN un pēdējā rinda 'Cits auto - ierakstīt ar roku'", () => {
    const text = renderText(
      <IrissWaybillCarPicker
        cars={[
          { id: "a", brandModel: "Volvo XC60", vin: "YV1UZA8V1M1765432", year: "2021", statusLabel: "Pārdošanā", accepted: false, owner: "IRISS" as const },
          { id: "b", brandModel: "Škoda Kodiaq", vin: "TMBJJ7NS1L8012345", year: "", statusLabel: "", accepted: true, owner: "IRISS" as const },
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
      "Nav tirdzniecībā pieņemto auto.",
    );
  });
});
