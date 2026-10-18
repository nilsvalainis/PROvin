import { describe, expect, it } from "vitest";
import {
  buildPartnerPackArchiveRow,
  buildPartnerVinArchiveRow,
  buildSubmittedPartnerArchiveRow,
  formatPartnerVinDuplicateDate,
  isPartnerVinOrderMatch,
  mergePartnerArchiveRows,
  parsePendingPartnerArchiveRows,
  partnerArchiveInvoiceHref,
  partnerOwnsArchiveItem,
  partnerVinReorderLockKey,
  partnerVinSpendKey,
  pickLatestPartnerVinHit,
  resolvePartnerArchiveStatus,
} from "@/lib/b2b-partner-archive-rows";
import { PARTNER_VIN_DEDUP_WINDOW_MS } from "@/lib/b2b-partner-orders";

describe("partner VIN spend locks", () => {
  it("time-buckets the spend key so the same VIN can be ordered again after the window", () => {
    const vin = "WVWZZZ1JZXW000001";
    const t0 = Date.parse("2026-09-02T10:00:00.000Z");
    const sameWindow = partnerVinSpendKey(vin, "business", t0 + PARTNER_VIN_DEDUP_WINDOW_MS - 1);
    const nextWindow = partnerVinSpendKey(vin, "business", t0 + PARTNER_VIN_DEDUP_WINDOW_MS);
    expect(partnerVinSpendKey(vin, "business", t0)).toBe(sameWindow);
    expect(nextWindow).not.toBe(sameWindow);
    expect(sameWindow.startsWith("spend:WVWZZZ1JZXW000001:business:")).toBe(true);
    expect(sameWindow.length).toBeLessThanOrEqual(80);
  });

  it("uses a short reorder lock that is separate from the unbounded spend:VIN:plan key", () => {
    const vin = "WVWZZZ1JZXW000001";
    const now = Date.parse("2026-09-02T10:00:00.000Z");
    expect(partnerVinReorderLockKey(vin, "dealer", now)).not.toBe(partnerVinSpendKey(vin, "dealer", now));
    expect(partnerVinReorderLockKey(vin, "dealer", now)).not.toBe(`spend:${vin}:dealer`);
  });
});

describe("partner archive rows", () => {
  it("formats duplicate dates as DD.MM in Latvia", () => {
    expect(formatPartnerVinDuplicateDate("2026-09-02T10:14:00+03:00")).toBe("02.09");
    expect(formatPartnerVinDuplicateDate(Date.parse("2026-03-15T12:00:00+02:00") / 1000)).toBe("15.03");
  });

  it("maps VIN order status to received / processing / ready / credit restored", () => {
    expect(resolvePartnerArchiveStatus({ reportReady: false, creditRestored: false, processing: false })).toBe(
      "received",
    );
    expect(resolvePartnerArchiveStatus({ reportReady: false, creditRestored: false, processing: true })).toBe(
      "processing",
    );
    expect(resolvePartnerArchiveStatus({ reportReady: true, creditRestored: false, processing: true })).toBe("ready");
    expect(resolvePartnerArchiveStatus({ reportReady: true, creditRestored: true, processing: true })).toBe(
      "credit_restored",
    );
  });

  it("builds a VIN row that is visible before the PDF exists", () => {
    const row = buildPartnerVinArchiveRow({
      id: "manual_order_1",
      createdAt: "2026-09-02T07:14:00.000Z",
      vin: "WVWZZZ1JZXW000001",
      plan: "business",
      reportReady: false,
      creditRestored: false,
      processing: false,
    });
    expect(row.status).toBe("received");
    expect(row.reportHref).toBeNull();
    expect(row.kind).toBe("order");
    expect(row.amountKind).toBe("credit");
  });

  it("builds a pack row with invoice download when a PDF exists", () => {
    const row = buildPartnerPackArchiveRow({
      id: "cs_test_pack",
      createdAt: "2026-09-02T07:14:00.000Z",
      invoiceNumber: "PRV-2026-0012",
      invoicePdfUrl: "/api/admin/invoice/cs_test_pack/pdf",
      amountTotal: 69990,
      currency: "eur",
      plan: "business",
      packQty: 10,
    });
    expect(row.kind).toBe("pack");
    expect(row.invoiceNumber).toBe("PRV-2026-0012");
    expect(row.invoiceHref).toBe("/api/partner/invoice/cs_test_pack");
    expect(row.amountLabel).toBe("699,90 €");
    expect(partnerArchiveInvoiceHref("cs_test_pack", null)).toBeNull();
  });

  it("shows a submitted VIN immediately as received", () => {
    const row = buildSubmittedPartnerArchiveRow({
      id: "manual_order_2",
      vin: " wvWzzz1jzxw000001 ",
      plan: "dealer",
      createdAt: "2026-09-02T07:14:00.000Z",
    });
    expect(row.vin).toBe("WVWZZZ1JZXW000001");
    expect(row.status).toBe("received");
    expect(row.amountKind).toBe("credit");
  });

  it("merges a pending submit row until the server archive contains it", () => {
    const pending = buildSubmittedPartnerArchiveRow({
      id: "manual_order_new",
      vin: "WVWZZZ1JZXW000001",
      plan: "business",
      createdAt: "2026-10-18T08:00:00.000Z",
    });
    const older = buildPartnerVinArchiveRow({
      id: "manual_order_old",
      createdAt: "2026-09-02T07:14:00.000Z",
      vin: "WVWZZZ3CZPE000002",
      plan: "business",
      reportReady: true,
      creditRestored: false,
      processing: false,
    });
    const merged = mergePartnerArchiveRows([older], [pending]);
    expect(merged.map((row) => row.id)).toEqual(["manual_order_new", "manual_order_old"]);
    const serverReady = { ...pending, status: "processing" as const };
    expect(mergePartnerArchiveRows([serverReady], [pending])[0]?.status).toBe("processing");
  });

  it("parses pending archive JSON without throwing", () => {
    expect(parsePendingPartnerArchiveRows("not-json")).toEqual([]);
    expect(parsePendingPartnerArchiveRows('[{"id":"x","createdAt":"2026-01-01"}]')).toEqual([
      { id: "x", createdAt: "2026-01-01" },
    ]);
  });

  it("matches only this partner VIN, not a legacy B2B mark without partner_id", () => {
    expect(
      isPartnerVinOrderMatch({
        partnerId: "ptr_0123456789abcdef",
        vin: "WVWZZZ1JZXW000001",
        notes: "B2B business · partner_id=ptr_0123456789abcdef",
        draftVin: "WVWZZZ1JZXW000001",
      }),
    ).toBe(true);
    expect(
      isPartnerVinOrderMatch({
        partnerId: "ptr_0123456789abcdef",
        vin: "WVWZZZ1JZXW000001",
        notes: "B2B IRISS pasūtījums",
        draftVin: "WVWZZZ1JZXW000001",
      }),
    ).toBe(false);
  });

  it("picks the latest VIN hit", () => {
    expect(pickLatestPartnerVinHit([{ created: 10 }, { created: 40 }, { created: 20 }])?.created).toBe(40);
    expect(pickLatestPartnerVinHit([])).toBeNull();
  });

  it("owns archive items by partner id or email", () => {
    expect(
      partnerOwnsArchiveItem({
        partnerId: "ptr_0123456789abcdef",
        partnerEmail: "b2b@example.com",
        orderPartnerId: "ptr_0123456789abcdef",
      }),
    ).toBe(true);
    expect(
      partnerOwnsArchiveItem({
        partnerId: "ptr_0123456789abcdef",
        partnerEmail: "b2b@example.com",
        draftEmail: "b2b@example.com",
      }),
    ).toBe(true);
    expect(
      partnerOwnsArchiveItem({
        partnerId: "ptr_0123456789abcdef",
        partnerEmail: "b2b@example.com",
        orderEmail: "other@example.com",
      }),
    ).toBe(false);
  });
});
