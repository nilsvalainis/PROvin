import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminDealerSignalsMenu,
  DealerSignalsAddMenu,
  DealerSignalsEditor,
  dealerSignalsEditorView,
} from "@/components/admin/AdminDealerSignalsMenu";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("«Signāli» admin bloks", () => {
  it("poga bez zaļā punkta, kamēr nav ieslēgts", () => {
    const off = renderToStaticMarkup(
      <AdminDealerSignalsMenu toneClass="" state={undefined} detect={() => ["incidents"]} onChange={() => {}} />,
    );
    expect(off).toContain("Signāli");
    expect(off).not.toContain('aria-label="Ir PDF"');
    const on = renderToStaticMarkup(
      <AdminDealerSignalsMenu
        toneClass=""
        state={{ enabled: true, items: [{ kind: "incidents", checked: true }] }}
        detect={() => []}
        onChange={() => {}}
      />,
    );
    expect(on).toContain('aria-label="Ir PDF"');
  });

  it("vēl nesaglabāts: atrastie signāli ķeksēti, slēdzis «Nav PDF», priekšskatā sadaļas nav", () => {
    const view = dealerSignalsEditorView(undefined, () => ["mileage_mismatch", "auction_photos"]);
    expect(view.enabled).toBe(false);
    const html = renderToStaticMarkup(<DealerSignalsEditor state={view} onChange={() => {}} onRegenerate={() => {}} />);
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Nav PDF");
    expect(html).toContain("Sadaļa nav PDF");
    expect(html).toContain("Iespējama odometra korekcija");
    expect(html).toContain("Pārģenerēt no datiem");
    expect(html.match(/data-dealer-signal-row=/g)).toHaveLength(2);
  });

  it("ieslēgts: priekšskatā sarkanā nobraukuma rinda un audita saite", () => {
    const html = renderToStaticMarkup(
      <DealerSignalsEditor
        state={{
          enabled: true,
          items: [
            { kind: "mileage_mismatch", checked: true },
            { kind: "incidents", checked: false },
          ],
        }}
        onChange={() => {}}
        onRegenerate={() => {}}
      />,
    );
    expect(html).toContain("Ir PDF");
    expect(html).toMatch(/class="bg-\[#FFF1F2\] text-\[#B91C1C\]" data-dealer-signal-preview-row="mileage_mismatch"/);
    expect(html).not.toContain('data-dealer-signal-preview-row="incidents"');
    expect(html).toContain("Pasūtīt PROVIN AUDITU");
  });

  it("bez signāliem - sarkans «Nav signālu»", () => {
    const html = renderToStaticMarkup(
      <DealerSignalsEditor state={{ enabled: false, items: [] }} onChange={() => {}} onRegenerate={() => {}} />,
    );
    expect(html).toContain("Nav signālu");
  });

  it("pasūtījuma darba zonā: bloks blakus «+ Extra», saglabā workspace laukā, e-pasta karogs", () => {
    const src = read("components/admin/OrderDetailWorkspace.tsx");
    expect(src).toMatch(/<AdminDealerExtraMenu[\s\S]{0,300}<AdminDealerSignalsMenu/);
    expect(src).toContain("updateWs({ dealerSignals: next })");
    expect(src).toContain("dealerSignalsOn: dealerSignalsSectionOn(ws.dealerSignals)");
  });

  it("priekšskats klienta valodā: labotā teksta tulkojums (saglabātais), LV lauks paliek rediģējams", () => {
    const src = "Ieraksti liecina par virsbūves remontu";
    const state = {
      enabled: true,
      items: [
        {
          kind: "incidents" as const,
          checked: true,
          text: src,
          tr: { en: { src, text: "Records indicate body repair" } },
        },
      ],
    };
    const html = renderToStaticMarkup(
      <DealerSignalsEditor state={state} previewLang="en" onChange={() => {}} onRegenerate={() => {}} />,
    );
    expect(html).toContain("Signals beyond dealer data");
    expect(html).toContain("Records indicate body repair");
    expect(html).toContain("Order PROVIN AUDITS");
    expect(html).toContain("data-dealer-signals-preview-lang");
    // Teksta lauks - latviski (admins labo LV).
    expect(html).toContain(`>${src}</textarea>`);
    // Bez tulkojuma (vēl nav pieprasīts) priekšskatā standarta teksts, nekad LV.
    const noTr = renderToStaticMarkup(
      <DealerSignalsEditor
        state={{ enabled: true, items: [{ kind: "incidents", checked: true, text: src }] }}
        previewLang="ru"
        onChange={() => {}}
        onRegenerate={() => {}}
      />,
    );
    expect(noTr).toContain("По этому автомобилю доступны записи о происшествиях");
    expect(noTr.split(src).length - 1).toBe(1);
  });

  it("darba zona padod klienta valodu un sesiju priekšskata tulkojumam (galddators un telefons)", () => {
    const src = read("components/admin/OrderDetailWorkspace.tsx");
    expect(src).toMatch(/<AdminDealerSignalsMenu[\s\S]{0,200}previewLang=\{orderClientLang\}/);
    expect(src).toContain("dealerSignalsPreviewLang={orderClientLang}");
  });
});

describe("«+ Pievienot signālu» (Nils 27.11)", () => {
  it("redaktorā poga; manuālā rinda ar atzīmi un noņemšanu, automātiskā - bez", () => {
    const html = renderToStaticMarkup(
      <DealerSignalsEditor
        state={{
          enabled: false,
          items: [
            { kind: "special_status", checked: true, manual: true },
            { kind: "incidents", checked: true },
          ],
        }}
        onChange={() => {}}
        onRegenerate={() => {}}
      />,
    );
    expect(html).toContain("+ Pievienot signālu");
    expect(html.match(/data-dealer-signal-manual/g)).toHaveLength(1);
    expect(html).toContain('data-dealer-signal-remove="special_status"');
    expect(html).not.toContain('data-dealer-signal-remove="incidents"');
  });

  it("izvēlne: visi tipi, esošie neaktīvi, sarkanie tipi sarkanā", () => {
    const html = renderToStaticMarkup(
      <DealerSignalsAddMenu state={{ enabled: false, items: [{ kind: "incidents", checked: true }] }} onAdd={() => {}} />,
    );
    expect(html.match(/data-dealer-signals-add-kind=/g)).toHaveLength(6);
    expect(html).toMatch(/disabled="" data-dealer-signals-add-kind="incidents"/);
    expect(html).not.toMatch(/disabled="" data-dealer-signals-add-kind="mileage_mismatch"/);
    expect(html).toContain("Nobraukuma nesakritība");
    expect(html).toContain("ASV vēsture");
    expect(html).toContain("Īpašs statuss");
    expect(html).toMatch(/data-dealer-signals-add-kind="special_status" class="[^"]*text-\[#b42318\]/);
  });
});
