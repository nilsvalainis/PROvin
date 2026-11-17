import { describe, expect, it } from "vitest";
import { AdminFlashMaxPanel, flashMaxDraftToSelection, flashMaxRunnableCount, type FlashMaxDraft } from "@/components/admin/AdminFlashMaxPanel";
import { defaultFlashMaxSelection } from "@/lib/admin-flash-max";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { renderHtml } from "@/lib/test-render";

const draft = (notes = ""): FlashMaxDraft => ({
  selection: defaultFlashMaxSelection(),
  setSelection: () => undefined,
  notes,
  setNotes: () => undefined,
});

/** Rindas HTML pēc sadaļas id. */
function row(html: string, id: string): string {
  const start = html.indexOf(`data-flash-job="${id}"`);
  expect(start).toBeGreaterThan(-1);
  const next = html.indexOf("data-flash-job=", start + 10);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("FLASH MAX izvēles panelis (dators un telefons)", () => {
  it("sadaļa bez datiem: izķeksēta, nav spiežama, ar iemeslu; sadaļa bez avota prasības - ieķeksēta", () => {
    const html = renderHtml(<AdminFlashMaxPanel draft={draft()} sourceBlocks={createDefaultSourceBlocks()} size="touch" />);
    const csdd = row(html, "csdd");
    expect(csdd).toContain("data-unavailable");
    expect(csdd).toContain("nav avota datu");
    expect(csdd).toMatch(/<input[^>]*disabled/);
    expect(csdd).not.toMatch(/<input[^>]*checked/);
    expect(row(html, "seller")).toContain("nav sludinājuma datu");
    const summary = row(html, "summary");
    expect(summary).not.toContain("data-unavailable");
    expect(summary).toMatch(/<input[^>]*checked/);
  });

  it("sadaļa ar datiem ir ieķeksēta un spiežama; telefonā ir arī platuma un modeļa izvēle", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.listing_analysis.listingPasteRaw = "BMW 320d, 2012";
    const seller = row(renderHtml(<AdminFlashMaxPanel draft={draft()} sourceBlocks={blocks} size="touch" />), "seller");
    expect(seller).not.toContain("data-unavailable");
    expect(seller).toMatch(/<input[^>]*checked/);
    expect(seller.match(/<select/g)?.length).toBe(2);
  });

  it("ģenerēšanai aiziet tikai sadaļas ar datiem, piezīmes apgrieztas", () => {
    const empty = createDefaultSourceBlocks();
    expect(flashMaxRunnableCount(draft(), empty)).toBe(5);
    const sel = flashMaxDraftToSelection(draft("  jauns fakts  "), empty);
    expect([...sel.selectedIds].sort()).toEqual(["incidents", "inspection", "photo", "summary", "technical_risks"]);
    expect(sel.operatorNotes).toBe("jauns fakts");
  });

  it("logs atvērts pirms datiem, dati ielikti vēlāk: tā pati izvēle atkal ieķeksē sadaļu un to ģenerē", () => {
    const d = draft();
    const empty = createDefaultSourceBlocks();
    expect(row(renderHtml(<AdminFlashMaxPanel draft={d} sourceBlocks={empty} />), "seller")).not.toMatch(/<input[^>]*checked/);
    expect(flashMaxDraftToSelection(d, empty).selectedIds).not.toContain("seller");
    const filled = createDefaultSourceBlocks();
    filled.listing_analysis.listingPasteRaw = "BMW 320d, 2012";
    expect(row(renderHtml(<AdminFlashMaxPanel draft={d} sourceBlocks={filled} />), "seller")).toMatch(/<input[^>]*checked/);
    expect(flashMaxDraftToSelection(d, filled).selectedIds).toContain("seller");
  });
});
