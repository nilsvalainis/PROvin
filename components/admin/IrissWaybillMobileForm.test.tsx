import { describe, expect, it } from "vitest";
import {
  IrissWaybillAutoEntry,
  IrissWaybillCarPicker,
  IrissWaybillMobileForm,
  WaybillDismissDialog,
  WaybillLiveRow,
} from "@/components/admin/IrissWaybillMobileForm";
import {
  applyWaybillAutoChoice,
  initialWaybillMobileForm,
  waybillShowsManualFields,
  waybillShowsTradeList,
} from "@/lib/iriss-waybill-mobile-form";
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

function autoEntry(choice: "none" | "list" | "manual") {
  const state = applyWaybillAutoChoice(initialWaybillMobileForm("B193-7"), choice);
  return (
    <IrissWaybillAutoEntry
      choice={state.autoChoice}
      car={state.car}
      manualBrandModel={state.manualBrandModel}
      isB192={false}
      b192Empty={false}
      showManual={waybillShowsManualFields(state)}
      showList={waybillShowsTradeList(state)}
      onChoose={() => undefined}
      onOpenList={() => undefined}
      onClearCar={() => undefined}
      onManualBrandModel={() => undefined}
    />
  );
}

describe("pavadzīmes forma telefonā v2 (renderēta)", () => {
  it("rāda numurus, 2 auto izvēles (No saraksta / Ar roku), sākuma adresi, laiku un komentāru; galamērķa nav", () => {
    const text = renderText(form());
    for (const t of ["Numurs", "B193-7", "aizņemts", "brīvs", "Auto", "No saraksta", "tirdzniecībā pieņemti auto", "Cits - ieraksti marku un modeli", "Sākuma adrese", "Tukums", "Cita adrese", "Rīgas iela 75", "Laiks", "1 h", "12 h", "48 h", "Cits", "derīga līdz", "Komentārs", "Izveidot pavadzīmi"]) {
      expect(text).toContain(t);
    }
    expect(text).not.toContain("Galamērķis");
    expect(text).not.toContain("Pievienot PDF");
    // Noklusējums: nepiespiež sarakstu un nerāda manuālos laukus (teksts "Izvēlies auto" paliek "Kā tas strādā").
    const html = renderHtml(form());
    expect(html).not.toContain('placeholder="Marka, modelis"');
    expect(html).toContain('placeholder="193 uz BMW 330"');
    expect(html).not.toContain('aria-label="VIN"');
    expect(html).not.toContain('placeholder="17 zīmes"');
    expect(html).not.toContain("tirdzniecībā pieņemtie");
    // Laika izvēles TIEŠI 1 h, 12 h, 48 h, Cits (24 h vairs nav); noklusējums 12 h; brīvais lauks tikai pēc "Cits".
    const hourButtons = [...html.slice(html.indexOf(">Laiks<")).matchAll(/aria-pressed="(true|false)"[^>]*>(\d+ h|Cits)</g)].map((m) => m[2]);
    expect(hourButtons).toEqual(["1 h", "12 h", "48 h", "Cits"]);
    expect(text).not.toContain("24 h");
    expect(html).toMatch(/aria-pressed="true"[^>]*>12 h</);
    expect(html).not.toContain('aria-label="Cits derīguma ilgums stundās"');
    expect(text).toContain("Aivars izveido tikai pavadzīmes");
  });

  it("Komentārs: paskaidrojums tieši zem lauka vienmēr redzams; CSDD teikums tikai, kad auto ir pieņemts tirdzniecībā (bez maršruta)", () => {
    const text = renderText(form());
    expect(text).toContain("Tikai piezīme Aivaram šai pavadzīmei - viņš to neizpilda kā komandu un citi lietotāji to neredz.");
    // Noklusējumā nav izvēlēts pieņemts auto (sākuma adreses plūsma) - CSDD teikuma nav.
    expect(text).not.toContain("Der, lai pateiktu, kur CSDD salīdzina numuru");
    // Noklusējuma numurs nav B192-7 - auto lauka paskaidrojuma šeit nav (tas pats "Dzintarzeme Auto" vārds
    // gan parādās "Kā tas strādā" sadaļā, tāpēc pārbauda tieši paskaidrojuma teikumu, ne tikai vārdu).
    expect(text).not.toContain("SIA ĪRISS auto šim numuram netiek rādīti");
  });

  it("'Kā tas strādā' ir aizverams bloks ar 4 īsiem soļiem un 'Jāzina' punktiem (Nils 27.10)", () => {
    const html = renderHtml(form());
    const text = renderText(form());
    expect(html).toMatch(/<details[^>]*>[\s\S]*Kā tas strādā/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    for (const t of ["Numurs.", "Auto.", "Laiks.", "Izveidot."]) expect(text).toContain(t);
    expect(text).toContain("1, 12, 48 h vai Cits (līdz 48 h).");
    expect(text).toContain("Numuru salīdzināšana - CSDD Tukumā.");
    expect(text).toContain("Komentārs ir tikai piezīme Aivaram");
    // Vecie garie teksti vairs nav.
    expect(text).not.toContain("Aivars ir Dzintarzeme Auto jaunais pavadzīmju asistents");
    // Tikai īsā defise: nav garās domuzīmes (kodi 8211, 8212).
    expect([...text].some((c) => c.charCodeAt(0) === 8211 || c.charCodeAt(0) === 8212)).toBe(false);
  });

  it("dzīvais statuss: josla ar soļiem bez procentu teksta un skaidrs 'Izdota' ar PDF", () => {
    const working = renderHtml(
      <WaybillLiveRow
        row={{ id: "w1", title: "Audi A6 Avant", sub: "B762-7 · 48 h", label: "Izveido", tone: "wip", pdfUrl: "", canRetry: false, canCancel: false, errorText: "", stale: false, writtenOff: false, progress: { step: 2, pct: 62, text: "Aizpilda CSDD formu..." }, line: "Aizpilda CSDD formu... · solis 2 no 3", note: "", canDismiss: false, savePdfHref: "", pdfFileName: "", dropboxError: "" }}
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
        row={{ id: "w2", title: "BMW 216d", sub: "26A1 · B193-7", label: "Izdota", tone: "ok", pdfUrl: "/x.pdf", canRetry: false, canCancel: false, errorText: "", stale: false, writtenOff: false, progress: { step: 3, pct: 100, text: "Nr. 26A1 · derīga līdz 25.10.2026, 12:00" }, line: "Nr. 26A1 · derīga līdz 25.10.2026, 12:00 · solis 3 no 3", note: "Saglabāta Arhīvā", canDismiss: false, savePdfHref: "", pdfFileName: "", dropboxError: "" }}
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
        row={{ id: "w3", title: "Peugeot 5008", sub: "B193-7 · 1 h", label: "Gaida", tone: "wait", pdfUrl: "", canRetry: false, canCancel: true, errorText: "", stale: false, writtenOff: false, progress: { step: 1, pct: 10, text: "Termiņš beidzies - atcel un izveido jaunu" }, line: "Termiņš beidzies - atcel un izveido jaunu", note: "", canDismiss: false, savePdfHref: "", pdfFileName: "", dropboxError: "" }}
        onCancel={() => undefined}
      />,
    );
    expect(text).toContain("Atcelt");
    expect(text).toContain("Termiņš beidzies - atcel un izveido jaunu");
  });

  it("izrakstīta pavadzīme: 'Izrakstīta', kad un vai numurs brīvs, norāde uz Arhīvu, bez joslas", () => {
    const html = renderHtml(
      <WaybillLiveRow
        row={{ id: "w4", title: "BMW 216d", sub: "Izrakstīta 23.10.2026, 12:00 · numurs B193-7 atkal ir brīvs", label: "Izrakstīta", tone: "wait", pdfUrl: "/x.pdf", canRetry: false, canCancel: false, errorText: "", stale: false, writtenOff: true, progress: { step: 3, pct: 100, text: "" }, line: "Pavadzīme vairs nav derīga. Atrodama Arhīvā.", note: "", canDismiss: false, savePdfHref: "", pdfFileName: "", dropboxError: "" }}
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

  it("Auto ievade: noklusējumā abi ceļi; 'Ar roku' rāda tikai marku un modeli, bez VIN", () => {
    const none = renderText(autoEntry("none"));
    expect(none).toContain("No saraksta");
    expect(none).toContain("Cits - ieraksti marku un modeli");
    expect(none).not.toContain("Marka, modelis");
    expect(none).not.toContain("Izvēlies auto");
    expect(renderHtml(autoEntry("none"))).not.toContain('aria-label="VIN"');

    const manualHtml = renderHtml(autoEntry("manual"));
    const manualText = renderText(autoEntry("manual"));
    expect(manualText).toContain("Cits - ieraksti marku un modeli");
    expect(manualText).toContain("ieraksti marku un modeli");
    expect(manualText).not.toContain("marka, modelis, VIN");
    expect(manualHtml).toContain('aria-label="Marka, modelis"');
    expect(manualHtml).toContain('placeholder="Marka, modelis"');
    expect(manualHtml).not.toContain('aria-label="VIN"');
    expect(manualHtml).not.toContain('placeholder="17 zīmes"');
    expect(manualText).not.toContain("Izvēlies auto");
    expect(manualHtml).toMatch(/aria-pressed="true"[^>]*>Cits/);

    const list = renderText(autoEntry("list"));
    expect(list).toContain("Izvēlies auto");
    expect(list).toContain("tirdzniecībā pieņemtie");
    expect(renderHtml(autoEntry("list"))).not.toContain('aria-label="VIN"');
    expect(renderHtml(autoEntry("list"))).toMatch(/aria-pressed="true"[^>]*>No saraksta/);
  });

  it("B192-7 (Dzintarzeme Auto) saraksts: ownerBadge pārraksta 'Pieņemts' ar 'DZA' visām rindām", () => {
    const text = renderText(
      <IrissWaybillCarPicker
        cars={[
          { id: "a", brandModel: "VW Touran", vin: "WV1ZZZ7NZ7H123456", year: "2019", statusLabel: "", accepted: true, owner: "DZA" as const },
          { id: "b", brandModel: "Audi A4 Avant", vin: "WAUZZZ8K9BA000112", year: "2020", statusLabel: "Pārdošanā", accepted: false, owner: "DZA" as const },
        ]}
        selected=""
        onChoose={() => undefined}
        ownerBadge="DZA"
      />,
    );
    expect(text).toContain("VW Touran");
    expect(text).toContain("DZA");
    // ownerBadge pārraksta pat neuzņemta auto statusa birku ("Pārdošanā" neparādās).
    expect(text).not.toContain("Pārdošanā");
    expect(text).not.toContain("Pieņemts");
    expect(text.trim().endsWith("Cits auto - ierakstīt ar roku Marka un modelis")).toBe(true);
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

  it("'Dzēst' tikai vecam ierakstam un tikai, ja lapa prot noņemt; aktīvam nav", () => {
    const old = { id: "w5", title: "AUDI A6 AVANT", sub: "Izrakstīta 23.10.2026, 20:13", label: "Izrakstīta", tone: "wait" as const, pdfUrl: "", canRetry: false, canCancel: false, errorText: "", stale: false, writtenOff: true, progress: { step: 3 as const, pct: 100, text: "" }, line: "Pavadzīme vairs nav derīga. Atrodama Arhīvā.", note: "", canDismiss: true, savePdfHref: "", pdfFileName: "", dropboxError: "" };
    expect(renderText(<WaybillLiveRow row={old} onDismiss={() => undefined} />)).toContain("Dzēst");
    expect(renderText(<WaybillLiveRow row={old} />)).not.toContain("Dzēst");
    const active = { ...old, id: "w6", label: "Izdota", tone: "ok" as const, writtenOff: false, canDismiss: false };
    expect(renderText(<WaybillLiveRow row={active} onDismiss={() => undefined} />)).not.toContain("Dzēst");
  });

  it("apstiprinājuma logs: jautājums, ka dati paliek, pogas 'Jā' un 'Nē'", () => {
    const html = renderHtml(<WaybillDismissDialog title="AUDI A6 AVANT" onYes={() => undefined} onNo={() => undefined} />);
    expect(html).toContain('role="dialog"');
    const text = renderText(<WaybillDismissDialog title="AUDI A6 AVANT" onYes={() => undefined} onNo={() => undefined} />);
    expect(text).toContain("Noņemt no saraksta - AUDI A6 AVANT?");
    expect(text).toContain("Pavadzīme, PDF un Arhīvs paliek nemainīti.");
    expect([...html.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1])).toEqual(["Jā", "Nē"]);
  });
});
