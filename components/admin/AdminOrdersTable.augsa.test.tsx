import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";
import { AdminClientLinkButton } from "@/components/admin/AdminClientLinkButton";
import { AdminBusinessLinkButton } from "@/components/admin/AdminBusinessLinkButton";
import { AdminCreateManualOrderButton } from "@/components/admin/AdminCreateManualOrderButton";
import type { SerializedAdminOrderTableRow } from "@/lib/serialize-admin-order-table";
import { renderHtml } from "@/lib/test-render";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const now = Math.floor(Date.now() / 1000);
const row = (p: Partial<SerializedAdminOrderTableRow>): SerializedAdminOrderTableRow => ({
  id: "cs_test_" + Math.random().toString(36).slice(2),
  created: now - 3600,
  amountTotal: 9999,
  currency: "eur",
  paymentStatus: "paid",
  customerName: "Testa Klients",
  customerEmail: "klients@example.com",
  customerPhone: null,
  vin: "WAUZZZF2XMN012345",
  makeModel: "Audi A4 2021",
  invoicePdfUrl: null,
  checkoutLine: "audit",
  ...p,
});

describe("Pasūtījumu saraksta augša (Nils 25.11)", () => {
  it("nav 48 h SLA joslas, termiņa kolonna paliek", () => {
    const html = renderHtml(
      <AdminOrdersTable
        orders={[
          row({ created: now - 47 * 3600 }), // ≤ 3 h
          row({ created: now - 3 * 86400 }), // kavējas
        ]}
      />,
    );
    expect(html).not.toContain("48 h SLA");
    expect(html).toContain("Termiņš (48 h)");
    expect(read("components/admin/AdminOrdersTable.tsx")).not.toMatch(/AdminAuditSlaListBanner/);
  });

  it("saraksta lapā nav VIN SCAN kartīšu bloka", () => {
    const page = read("app/admin/(dashboard)/dashboard/page.tsx");
    expect(page).not.toMatch(/AdminOrderVinScanDashboardCards/);
    expect(page).not.toMatch(/pickOrderVinScanDashboardCards/);
  });

  it("filtru rindas tumšās pogas: balts teksts (klase) un globālā melnā kārtula tās neskar", () => {
    const html = renderHtml(
      <div>
        <AdminClientLinkButton />
        <AdminBusinessLinkButton />
        <AdminCreateManualOrderButton compact />
      </div>,
    );
    for (const label of ["Jauna klienta saite", "Jauna Business saite"]) {
      const btn = html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
      expect(btn).toMatch(/bg-\[#1d1d1f\]/);
      expect(btn).toMatch(/text-white/);
    }
    const css = read("app/admin/admin-ios-theme.css");
    const blackSpanRule = css.match(/[^{}]*:is\(p, span[^{]*\{\s*color: #000000;/)?.[0] ?? "";
    expect(blackSpanRule).toContain('[class*="text-white"]');
    expect(blackSpanRule).toContain(':is(a, button, [role="button"])[class*="text-white"] *');
    // izņēmums :where() iekšā - specifiskums nemainās
    expect(blackSpanRule).toMatch(/:not\(:where\([^)]*text-white/);
  });
});
