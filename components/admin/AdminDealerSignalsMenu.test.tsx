import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminDealerSignalsMenu,
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
});
