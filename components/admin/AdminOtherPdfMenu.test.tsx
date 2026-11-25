import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AdminOtherPdfMenu,
  orderOtherPdfEntries,
  otherPdfMenuItems,
} from "@/components/admin/AdminOtherPdfMenu";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

function setup(over: Partial<Parameters<typeof orderOtherPdfEntries>[0]> = {}) {
  const openPrintReport = vi.fn();
  const openAuctionArchivePdf = vi.fn();
  const openOemDealerReport = vi.fn();
  const entries = orderOtherPdfEntries({
    pdfBusy: false,
    familyBusy: () => null,
    inkBusy: null,
    archiveBusy: false,
    openPrintReport,
    openAuctionArchivePdf,
    openOemDealerReport,
    ...over,
  });
  return { entries, openPrintReport, openAuctionArchivePdf, openOemDealerReport };
}

const run = (items: ReturnType<typeof otherPdfMenuItems>, key: string) => {
  const item = items.find((i) => i.key === key);
  expect(item, key).toBeTruthy();
  item!.run();
  return item!;
};

describe("«Citi PDF ▾» - visas agrākās joslas pogas saglabātas (Nils 25.11)", () => {
  it("Business / Dīlera / ASV PDF: LV = galvenā darbība, EN/RU/DE = valoda", () => {
    const cases = [
      ["business", { businessBrand: true }],
      ["dealer", { dealerOnly: true }],
      ["asv", { asvOnly: true }],
    ] as const;
    for (const [id, base] of cases) {
      const { entries, openPrintReport } = setup();
      const items = otherPdfMenuItems(entries);
      run(items, `${id}:lv`);
      expect(openPrintReport).toHaveBeenLastCalledWith(base);
      for (const lang of ["en", "ru", "de"] as const) {
        run(items, `${id}:${lang}`);
        expect(openPrintReport).toHaveBeenLastCalledWith({ ...base, lang });
      }
      expect(openPrintReport).toHaveBeenCalledTimes(4);
    }
  });

  it("Izsoļu arhīva PDF: bez cenām un ar cenām", () => {
    const { entries, openAuctionArchivePdf } = setup();
    const items = otherPdfMenuItems(entries);
    run(items, "auction-archive:plain");
    expect(openAuctionArchivePdf).toHaveBeenLastCalledWith(false);
    run(items, "auction-archive:prices");
    expect(openAuctionArchivePdf).toHaveBeenLastCalledWith(true);
  });

  it("OEM dīlera PDF un Drukājamā versija", () => {
    const { entries, openOemDealerReport, openPrintReport } = setup();
    const items = otherPdfMenuItems(entries);
    run(items, "oem");
    expect(openOemDealerReport).toHaveBeenCalledTimes(1);
    run(items, "print-ink");
    expect(openPrintReport).toHaveBeenLastCalledWith({ printInk: true });
  });

  it("kamēr PDF gatavo - PDF opcijas atslēgtas, OEM paliek pieejams (kā agrāk)", () => {
    const { entries } = setup({ pdfBusy: true, archiveBusy: true });
    const items = otherPdfMenuItems(entries);
    expect(items.filter((i) => !i.disabled).map((i) => i.key)).toEqual(["oem"]);
  });

  it("partnera valodas slēdzene: pieejama tikai izvēlētā valoda", () => {
    const { entries } = setup();
    const items = otherPdfMenuItems(entries, "en");
    const business = items.filter((i) => i.entryId === "business");
    expect(business.filter((i) => !i.disabled).map((i) => i.key)).toEqual(["business:en"]);
    expect(items.find((i) => i.key === "auction-archive:plain")?.disabled).toBe(false);
  });

  it("izvēlne: aria-haspopup, role=menu, visas rindas un «Mainīt valodu» pie slēdzenes", () => {
    const { entries } = setup();
    const closed = renderToStaticMarkup(<AdminOtherPdfMenu entries={entries} toneClass="x" />);
    expect(closed).toContain('aria-haspopup="menu"');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain("Citi PDF");
    expect(closed).not.toContain('role="menu"');
    const html = renderToStaticMarkup(
      <AdminOtherPdfMenu entries={entries} toneClass="x" defaultOpen lockLang="lv" onUnlockLang={() => undefined} />,
    );
    expect(html).toContain('role="menu"');
    for (const label of ["Business PDF", "Dīlera PDF", "Izsoļu arhīva PDF", "ASV PDF", "OEM dīlera PDF", "Drukājamā versija", "Mainīt valodu"]) {
      expect(html).toContain(label);
    }
    expect((html.match(/role="menuitem"/g) ?? []).length).toBe(4 * 3 + 2 + 2 + 1);
  });

  it("gatavošanas procenti redzami uz «Citi PDF» pogas", () => {
    const { entries } = setup({ familyBusy: (p) => (p === "dealer" ? "42%" : null) });
    expect(renderToStaticMarkup(<AdminOtherPdfMenu entries={entries} toneClass="x" />)).toContain("42%");
  });

  it("josla: Pretrunas, Izvilkums, Ģenerēt PDF ▾, Citi PDF ▾ - vienā rindā", () => {
    const ws = read("components/admin/OrderDetailWorkspace.tsx");
    const bar = ws.slice(ws.indexOf("data-order-pdf-bar"), ws.indexOf("factCheckPublishItems && typeof document"));
    expect(bar).toContain("flex-nowrap");
    const order = ["<AdminSourceConsistencyBar", 'label="Izvilkums"', 'label="Ģenerēt PDF"', "<AdminOtherPdfMenu"].map((s) =>
      bar.indexOf(s),
    );
    expect(order.every((n) => n > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(bar).toContain("openOemDealerReport: () => void openOemDealerReport()");
    expect(bar).toContain("openAuctionArchivePdf: (showPrices) => void openAuctionArchivePdf(showPrices)");
  });
});
