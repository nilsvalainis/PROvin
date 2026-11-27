import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/use-admin-is-phone", () => ({ useAdminIsPhone: () => false }));

import { AdminOrderVinScanCard } from "@/components/admin/AdminOrderVinScanCard";
import { adminUiOpenKey, clearAdminUiOpenMemoryForTests, writeAdminUiOpen } from "@/lib/admin-ui-open-memory";
import { buildOrderVinScanSummary, orderVinScanCollapsedDots, type OrderVinScanRecord } from "@/lib/order-vin-scan";
import { renderHtml } from "@/lib/test-render";

const VIN = "VXEVFAHKKM7805359";

function ind(id: string, status: string, summary = "") {
  return { id, label: id, country: "LV", status, summary, detail: "", openUrl: `https://example.test/${id}` };
}

const record = {
  at: "2026-11-27T13:44:00.000Z",
  vin: VIN,
  status: "done",
  indicators: [
    ind("csdd", "found", "Ir dati"),
    ind("listing_history", "found", "3 sludinājumi"),
    ind("carfax_eu", "found", "no pārlūka (from browser) · 2 ieraksti"),
    ind("ltab", "none", "Nav ierakstu"),
    ind("mnt_ee", "none", "Nav atrasts"),
    ind("car_info", "blocked", "Cloudflare 403"),
    ind("autodna_precheck", "browser_only", "atver pārlūkā"),
    ind("outvin", "error", "fetch failed"),
  ],
} as unknown as OrderVinScanRecord;

function card(props: Partial<ComponentProps<typeof AdminOrderVinScanCard>> = {}) {
  return renderHtml(
    <AdminOrderVinScanCard
      sessionId="s1"
      vin={VIN}
      listingUrl=""
      initial={record}
      onImportAuction={() => undefined}
      onImportCsdd={() => undefined}
      onImportListing={() => undefined}
      {...props}
    />,
  );
}

function dotCount(html: string): number {
  const m = /aria-label="Avoti ar datiem">([\s\S]*?)<\/span><button/.exec(html);
  if (!m) return -1;
  return (m[1]!.match(/rounded-full/g) ?? []).length;
}

describe("VIN SCAN josla (Nils 27.11)", () => {
  beforeEach(() => clearAdminUiOpenMemoryForTests());

  it("sakļautajā joslā punkti tikai avotiem ar datiem (arī pārlūka avotam ar datiem)", () => {
    const dots = orderVinScanCollapsedDots(buildOrderVinScanSummary(record));
    expect(dots.map((d) => d.id).sort()).toEqual(["carfax_eu", "csdd", "listing_history"]);
    expect(orderVinScanCollapsedDots(null)).toEqual([]);
  });

  it("sakļautā josla: 3 punkti, nav-datu / bloķē / kļūda nav punkti; «Rādīt sarakstu» paliek", () => {
    const html = card();
    expect(html).toContain("Rādīt sarakstu");
    expect(dotCount(html)).toBe(3);
    expect(html).toContain('title="csdd: atrasta info"');
    expect(html).not.toContain('title="ltab:');
    expect(html).not.toContain('title="car_info:');
    // Kopskaita čipi paliek.
    expect(html).toMatch(/<b class="tabular-nums">3<\/b>atrasta info/);
    expect(html).toMatch(/<b class="tabular-nums">2<\/b>nav datu/);
  });

  it("sakļautā josla: nulles čipi nav (kompakti)", () => {
    const onlyFound = { ...record, indicators: [ind("csdd", "found", "Ir dati")] } as unknown as OrderVinScanRecord;
    const html = card({ initial: onlyFound });
    expect(html).not.toContain("nav datu");
    expect(html).not.toContain("kļūda");
  });

  it("izklāts saraksts rāda visus avotus kā līdz šim", () => {
    writeAdminUiOpen(adminUiOpenKey("s1", "vin-scan-list"), true);
    const html = card();
    expect(html).toContain("Sakļaut");
    expect(html).toMatch(/<b class="tabular-nums">1<\/b>kļūda/);
  });

  it("dīlera sadaļas josla: savs bloka id, saraksts pēc noklusējuma sakļauts, atsevišķa atmiņa", () => {
    writeAdminUiOpen(adminUiOpenKey("s1", "vin-scan-list"), true);
    const html = card({ placement: "dealer", sideEffects: false });
    expect(html).toContain('data-admin-block="vin-scan-avoti-dileris"');
    expect(html).toContain("VIN SCAN avoti");
    expect(html).toContain("Rādīt sarakstu");
    expect(dotCount(html)).toBe(3);
    writeAdminUiOpen(adminUiOpenKey("s1", "vin-scan-list-dileris"), true);
    expect(card({ placement: "dealer", sideEffects: false })).toContain("Sakļaut");
  });

  it("dīlera josla bez blakusefektiem nedublē userscript tiltu; Pārskata kartīte to atstāj", () => {
    expect(card()).toContain('data-provin-order-session="s1"');
    const dealer = card({ placement: "dealer", sideEffects: false });
    expect(dealer).not.toContain("data-provin-order-session");
  });
});
