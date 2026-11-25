import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuctionArchivePdfSplitButton } from "@/components/admin/AdminAuctionArchiveReport";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("«Izsoļu arhīvs» atsevišķais PDF - pogas (Nils 23.11)", () => {
  it("poga ar ▾ kā «Ģenerēt dīlera PDF ▾»", () => {
    const html = renderToStaticMarkup(
      <AuctionArchivePdfSplitButton label="Ģenerēt izsoļu arhīva PDF" toneClass="x" onGenerate={() => undefined} />,
    );
    expect(html).toContain("Ģenerēt izsoļu arhīva PDF");
    expect(html).toContain('aria-label="Ģenerēt izsoļu arhīva PDF: ar vai bez cenām"');
  });

  it("datora apakšējā PDF joslā «Citi PDF ▾» aiz dīlera PDF, telefonā «Vairāk», izsoļu blokā josla", () => {
    const ws = read("components/admin/OrderDetailWorkspace.tsx");
    const bar = ws.slice(ws.indexOf("data-order-pdf-bar"));
    expect(bar).toContain("orderOtherPdfEntries(");
    const menu = read("components/admin/AdminOtherPdfMenu.tsx");
    const dealer = menu.indexOf('label: "Dīlera PDF"');
    const archive = menu.indexOf('label: "Izsoļu arhīva PDF"');
    expect(dealer).toBeGreaterThan(0);
    expect(archive).toBeGreaterThan(dealer);
    expect(ws).toContain('label: "Izsoļu arhīva PDF"');
    expect(read("components/admin/AdminCcVinSourceBlock.tsx")).toContain("<AdminAuctionArchiveReportStrip");
  });
});
