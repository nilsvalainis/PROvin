import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";
import { AdminDealerSendDialog } from "@/components/admin/AdminDealerSendDialog";
import type { SerializedAdminOrderTableRow } from "@/lib/serialize-admin-order-table";
import { renderHtml, renderText } from "@/lib/test-render";

const row = (p: Partial<SerializedAdminOrderTableRow>): SerializedAdminOrderTableRow => ({
  id: "cs_test_a",
  created: 1_763_800_000,
  amountTotal: 2499,
  currency: "eur",
  paymentStatus: "paid",
  customerName: null,
  customerEmail: null,
  customerPhone: null,
  vin: "WAUZZZF2XMN012345",
  makeModel: "Audi A4 2021",
  invoicePdfUrl: null,
  checkoutLine: "dealer",
  ...p,
});

describe("Pasūtījumu saraksts telefonā - ielases indikācija (variants 3)", () => {
  const orders = [
    row({ ingest: { state: "done", label: "Ielasīts · 14", count: 14, source: "dealer", sent: false } }),
    row({ id: "cs_test_b", vin: "WVWZZZ3CZJE000002", makeModel: "VW Passat 2018", ingest: { state: "no_data", label: "Datu nav", source: "dealer", sent: false } }),
    row({ id: "cs_test_c", vin: "TMBJJ7NE0L0000003", makeModel: "Škoda Octavia 2020", ingest: { state: "running", label: "Ielasa…", source: "dealer" } }),
    row({ id: "cs_test_d", vin: "WBANJ91020CR00000", makeModel: "BMW 535", checkoutLine: "audit", amountTotal: 9999 }),
  ];

  it("ikona aplī kreisajā pusē + teksts + Nosūtīts/Nav nosūtīts", () => {
    const html = renderHtml(<AdminOrdersTable orders={orders} />);
    expect(html).toContain('class="amx-sti amx-sti--done"');
    expect(html).toContain('class="amx-sti amx-sti--no_data"');
    expect(html).toContain('class="amx-sti amx-sti--running"');
    const t = renderText(<AdminOrdersTable orders={orders} />);
    expect(t).toContain("Ielasīts · 14");
    expect(t).toContain("Datu nav");
    expect(t).toContain("Nav nosūtīts");
  });

  it("bez indikācijas datiem rindai ikonu nerāda", () => {
    const html = renderHtml(<AdminOrdersTable orders={[orders[3]]} />);
    expect(html).not.toContain("amx-sti");
  });

  it("filtri «Nav nosūtīti / Kļūdas / Ielasa» ar skaitu, ja tādi ir", () => {
    const t = renderText(<AdminOrdersTable orders={orders} />);
    expect(t).toMatch(/Nav nosūtīti 2/);
    expect(t).toMatch(/Kļūdas 1/);
    expect(t).toMatch(/Ielasa 1/);
    expect(renderText(<AdminOrdersTable orders={[orders[3]]} />)).not.toContain("Nav nosūtīti");
  });
});

describe("«Sūtīt klientam» forma telefonā - stikla stils", () => {
  const html = renderHtml(
    <AdminDealerSendDialog
      open
      onClose={() => undefined}
      sessionId="cs_test_1"
      vin="WBA5R1C0XLFH42873"
      b2b={false}
      customerEmail="klients@example.com"
      defaultSituation="ready"
      refundCents={null}
      pdfLang="lv"
      bridge={null}
      onSent={() => undefined}
    />,
  );

  it("pilnekrāna virsma, segmenti, lauki 16 px un piestiprināta zilā «Sūtīt» poga apakšā", () => {
    expect(html).toContain("amx amx-surface flex h-full max-h-[100dvh]");
    expect(html.match(/amx-seg /g)?.length).toBe(2);
    expect(html).toContain("amx-fld w-full");
    expect(html).toContain("amx-fld amx-fld--ta");
    const footer = html.slice(html.indexOf("data-dealer-send-footer"));
    expect(footer).toContain("amx-dock");
    expect(footer).toMatch(/amx-btn amx-btn--primary max-md:flex-1/);
  });

  it("WhatsApp ikona zaļa (tikai telefonā); PDF skatīšana telefonā", () => {
    expect(html).toMatch(/hidden h-\[17px\] w-\[17px\][^"]*max-md:inline-block" fill="none" stroke="#1c8a4d"/);
    expect(renderText(
      <AdminDealerSendDialog
        open
        onClose={() => undefined}
        sessionId="cs_test_1"
        vin="WBA5R1C0XLFH42873"
        b2b={false}
        customerEmail="klients@example.com"
        defaultSituation="ready"
        refundCents={null}
        pdfLang="lv"
        bridge={null}
        onSent={() => undefined}
      />,
    )).toContain("Skatīt");
  });
});
