import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";
import type { SerializedAdminOrderTableRow } from "@/lib/serialize-admin-order-table";
import { renderHtml } from "@/lib/test-render";

const row = (p: Partial<SerializedAdminOrderTableRow>): SerializedAdminOrderTableRow => ({
  id: "cs_test_a",
  created: 1_763_800_000,
  amountTotal: 9999,
  currency: "eur",
  paymentStatus: "paid",
  customerName: "Testa Klients",
  customerEmail: null,
  customerPhone: null,
  vin: "WAUZZZF2XMN012345",
  makeModel: "Audi A4 2021",
  invoicePdfUrl: null,
  checkoutLine: "audit",
  ...p,
});

/** Desktop tabulas daļa (telefona saraksts ir pirms tās). */
const desktop = (html: string) => html.slice(html.indexOf("<table"));
const headers = (html: string) =>
  [...desktop(html).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);

describe("Pasūtījumu saraksts datorā - kolonnas", () => {
  it("secība: Termiņš · Marka, modelis, VIN · Rez. · Summa · Klients · Datums", () => {
    const html = renderHtml(<AdminOrdersTable orders={[row({})]} />);
    expect(headers(html)).toEqual(["Termiņš (48 h)", "Marka, modelis, VIN", "Rez.", "Summa", "Klients", "Datums"]);
    expect(desktop(html)).toContain(`colSpan="6"`);
  });

  it("VIN ir tajā pašā šūnā kā marka/modelis; summa pirms klienta", () => {
    const d = desktop(renderHtml(<AdminOrdersTable orders={[row({})]} />));
    const cells = d.split("<td").slice(1);
    // 0 dienas virsraksts, 1 termiņš, 2 auto+VIN, 3 rez., 4 summa, 5 klients, 6 datums
    expect(cells[2]).toContain("Audi A4 2021");
    expect(cells[2]).toContain("WAUZZZF2XMN012345");
    expect(cells[4]).toContain("99,99");
    expect(cells[5]).toContain("Testa Klients");
  });

  it("manuālā pasūtījuma dzēšana ir summas šūnā", () => {
    const d = desktop(renderHtml(<AdminOrdersTable orders={[row({ id: "manual_order_x", isManual: true, paymentStatus: "paid" })]} />));
    const cells = d.split("<td").slice(1);
    expect(cells[4]).toContain("Dzēst manuālo pasūtījumu");
    expect(cells[4]).toContain("Labot summu");
  });
});

describe("Manuāls, vēl neapmaksāts pasūtījums", () => {
  const unpaid = row({ id: "manual_order_u", isManual: true, paymentStatus: "unpaid" });

  it("datorā un telefonā klusināts + «nav apmaksāts» zem summas", () => {
    const html = renderHtml(<AdminOrdersTable orders={[unpaid]} />);
    expect(html.match(/data-manual-unpaid=""/g)?.length).toBe(2);
    expect(html.match(/data-manual-unpaid-label/g)?.length).toBe(2);
    expect(html).not.toContain("Manuāls · nav apmaksāts");
    const cells = desktop(html).split("<td").slice(1);
    expect(cells[4]).toContain("nav apmaksāts");
    expect(cells[4]).not.toContain("Pirms apmaksas");
  });

  it("«Manuāls» tikai pie klienta, ne summas šūnā", () => {
    const cells = desktop(renderHtml(<AdminOrdersTable orders={[unpaid]} />)).split("<td").slice(1);
    expect(cells[4]).not.toContain("Manuāls");
    expect(cells[5]).toContain(">Manuāls<");
  });

  it("pēc apmaksas izskatās kā pārējie", () => {
    const html = renderHtml(<AdminOrdersTable orders={[{ ...unpaid, paymentStatus: "paid" }]} />);
    expect(html).not.toContain("data-manual-unpaid");
    expect(html).not.toContain("nav apmaksāts");
  });

  it("summas šūnās rezervēta vieta divām ikonām (summas vienā kolonnā)", () => {
    const html = renderHtml(<AdminOrdersTable orders={[row({}), { ...unpaid, paymentStatus: "paid" }]} />);
    const amountCells = desktop(html).split("<td").slice(1).filter((c) => c.includes("data-admin-order-amount"));
    expect(amountCells).toHaveLength(2);
    // Stripe rinda: 2 tukšas vietas; manuālā: zīmulis + dzēst.
    expect(amountCells[0].match(/h-\[26px\] w-\[26px\] shrink-0"/g)?.length).toBe(2);
    expect(amountCells[1]).toContain("Labot summu");
    expect(amountCells[1]).toContain("Dzēst manuālo pasūtījumu");
  });

  it("partnera maka darbs netiek iezīmēts kā neapmaksāts", () => {
    const html = renderHtml(
      <AdminOrdersTable orders={[{ ...unpaid, partnerId: "ptr_0123456789abcdef", partnerCompanyName: "Testa Auto" }]} />,
    );
    expect(html).not.toContain("data-manual-unpaid");
    expect(html).not.toContain("nav apmaksāts");
    const cells = desktop(html).split("<td").slice(1);
    expect(cells[4]).toContain("Kredīts");
    expect(cells[4]).toContain("Ielikt PDF arhīvā");
  });
});
