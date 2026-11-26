import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminDealerExtraMenu, DealerExtraList, dealerExtraSelectedLabel } from "@/components/admin/AdminDealerExtraMenu";
import { AdminReportPreviewDialog } from "@/components/admin/AdminReportPreviewDialog";
import {
  ADMIN_ORDERS_LIST_HREF,
  dealerSentFlashText,
  takeOrdersListFlash,
  writeOrdersListFlash,
} from "@/lib/admin-orders-list-flash";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("«+ Extra» izvēlne", () => {
  it("poga ar izvēlēto skaitu", () => {
    const html = renderToStaticMarkup(
      <AdminDealerExtraMenu toneClass="" getItems={() => []} selected={["csdd", "ltab"]} onChange={() => {}} />,
    );
    expect(html).toContain("+ Extra");
    expect(html).toContain(">2<");
  });

  it("bez izvēles - bez skaitļa", () => {
    const html = renderToStaticMarkup(
      <AdminDealerExtraMenu toneClass="" getItems={() => []} selected={[]} onChange={() => {}} />,
    );
    expect(html).not.toMatch(/>\d+</);
  });

  it("saraksts: tikai padotās sadaļas ar ierakstu skaitu", () => {
    const html = renderToStaticMarkup(
      <DealerExtraList
        items={[
          { key: "csdd", label: "CSDD", count: 6 },
          { key: "cc_vin", label: "Izsoļu arhīvs", count: 1 },
        ]}
        selected={["csdd"]}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain("6 ieraksti");
    expect(html).toContain("1 ieraksts");
    expect(html).not.toMatch(/AutoDNA|carVertical|CARFAX/i);
    expect(html.match(/checked=""/g)?.length).toBe(1);
  });

  it("tukšs saraksts - «Nav datu»", () => {
    expect(renderToStaticMarkup(<DealerExtraList items={[]} selected={[]} onToggle={() => {}} />)).toContain("Nav datu");
    expect(dealerExtraSelectedLabel(1)).toBe("1 izvēlēta");
    expect(dealerExtraSelectedLabel(3)).toBe("3 izvēlētas");
  });

  it("izvēle netiek saglabāta pasūtījumā (tikai lapas stāvoklis)", () => {
    const ws = read("components/admin/OrderDetailWorkspace.tsx");
    expect(ws).toContain("useState<DealerExtraKey[]>([])");
    expect(read("lib/admin-order-workspace-persist.ts")).not.toContain("dealerExtra");
  });

  it("dators un telefons: poga + priekšskats abās vietās", () => {
    const ws = read("components/admin/OrderDetailWorkspace.tsx");
    expect(ws).toContain("<AdminDealerExtraMenu");
    expect(ws).toContain("data-report-preview-button");
    const dock = read("components/admin/AdminOrderMobileDock.tsx");
    expect(dock).toContain("data-mobile-dealer-extra");
    expect(dock).toContain("data-mobile-report-preview");
  });
});

describe("priekšskata logs", () => {
  it("aizvērts - nekas", () => {
    expect(
      renderToStaticMarkup(
        <AdminReportPreviewDialog open={false} vin="X" html={null} busy={false} error={null} onClose={() => {}} />,
      ),
    ).toBe("");
  });
});

describe("pēc «Sūtīt klientam» - atpakaļ uz sarakstu", () => {
  it("apstiprinājuma teksts ar VIN beigām", () => {
    expect(dealerSentFlashText("WBAJL71000BX48215")).toBe("Nosūtīts klientam · VIN …8215");
    expect(dealerSentFlashText(null)).toBe("Nosūtīts klientam");
  });

  it("flash nolasās vienreiz un noveco", () => {
    const store = new Map<string, string>();
    const s = {
      setItem: (k: string, v: string) => void store.set(k, v),
      getItem: (k: string) => store.get(k) ?? null,
      removeItem: (k: string) => void store.delete(k),
    };
    writeOrdersListFlash("Nosūtīts klientam · VIN …8215", s);
    expect(takeOrdersListFlash(s)).toBe("Nosūtīts klientam · VIN …8215");
    expect(takeOrdersListFlash(s)).toBeNull();
    writeOrdersListFlash("vecs", s);
    expect(takeOrdersListFlash(s, Date.now() + 120_000)).toBeNull();
  });

  it("vispirms saglabā melnrakstu, tad pāriet; neveiksmē paliek", () => {
    const ws = read("components/admin/OrderDetailWorkspace.tsx");
    const fn = ws.slice(ws.indexOf("const returnToOrdersAfterDealerSend"), ws.indexOf("const dealerSendBridge"));
    expect(fn.indexOf("flushWorkspaceServerPatch")).toBeGreaterThan(-1);
    expect(fn.indexOf("flushWorkspaceServerPatch")).toBeLessThan(fn.indexOf("router.push(ADMIN_ORDERS_LIST_HREF)"));
    expect(fn).toMatch(/if \(!saved\) return "/);
    expect(ws).toContain("onDealerDataSent: () => returnToOrdersAfterDealerSend()");
    expect(ADMIN_ORDERS_LIST_HREF).toBe("/admin/dashboard");
  });

  it("dialogs pāriet tikai pēc veiksmīgas sūtīšanas (kļūdā - paliek un rāda kļūdu)", () => {
    const d = read("components/admin/AdminDealerSendDialog.tsx");
    const ok = d.indexOf("await finish(`E-pasts ar PDF nosūtīts");
    const nav = d.indexOf("bridge.onDealerDataSent({ sentTo: r.sentTo })");
    const catchAt = d.indexOf("} catch (e) {", ok);
    expect(ok).toBeGreaterThan(-1);
    expect(nav).toBeGreaterThan(ok);
    expect(nav).toBeLessThan(catchAt);
  });

  it("sarakstā ir apstiprinājuma komponents", () => {
    expect(read("app/admin/(dashboard)/dashboard/page.tsx")).toContain("<AdminOrdersListFlash />");
  });
});
