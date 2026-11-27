import { describe, expect, it } from "vitest";
import { AdminFlashMaxStatusChip, AdminFlashMaxStatusDetails } from "@/components/admin/AdminFlashMaxStatus";
import { summarizeFlashMaxStatus } from "@/lib/admin-flash-max";
import { renderHtml } from "@/lib/test-render";

const status = summarizeFlashMaxStatus({
  busy: false,
  results: [
    { id: "csdd", label: "CSDD", status: "ok" },
    { id: "dealer_oil", label: "Eļļas maiņas intervāli", status: "error", detail: "AI nepaguva - spied ✨ šim laukam" },
  ],
  reviewStatus: "done",
  reviewPending: 5,
})!;

describe("FLASH MAX statuss rīkjoslā", () => {
  it("čipa: viena rinda, nesaraujas citi elementi (flex-none, truncate, fiksēts augstums)", () => {
    const html = renderHtml(<AdminFlashMaxStatusChip status={status} open={false} onToggle={() => undefined} controlsId="x" />);
    expect(html).toContain("FLASH MAX: 1 · 1 kļūda · 5 ieteikumi");
    expect(html).toContain("h-7");
    expect(html).toContain("flex-none");
    expect(html).toContain("truncate");
    expect(html).toContain("max-w-[15rem]");
    expect(html).not.toContain("Eļļas maiņas intervāli");
  });

  it("detaļas: kļūda sarkanā, ieteikumiem saite «pārskatīt», novietots zem rīkjoslas absolūti", () => {
    const html = renderHtml(
      <AdminFlashMaxStatusDetails id="x" status={status} onClose={() => undefined} onOpenReview={() => undefined} />,
    );
    expect(html).toContain("absolute inset-x-0 top-full");
    expect(html).toMatch(/text-red-700[^>]*>Eļļas maiņas intervāli: AI nepaguva/);
    expect(html).toContain("pārskatīt");
    expect(html).toContain("5 ieteikumi");
  });
});
