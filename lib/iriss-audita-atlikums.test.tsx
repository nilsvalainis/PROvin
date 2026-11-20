/**
 * 20.11 pabeigtības audita atlikums: PD auto izvēle (rezervēts/pārdots), cenu lapa pārdotam auto,
 * vecās /p/<token> saites pārdotam auto, atmaksāta pasūtījuma termiņa šūna.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminAuditSlaOrderBanner } from "@/components/admin/AdminAuditSlaWarningBanner";
import { toAdminOrderDetailClientModel } from "@/lib/admin-order-detail-client-model";
import { priceSheetSold } from "@/lib/iriss-autoparks-v2-cenu-lapa";
import { irissPdCarPicks } from "@/lib/iriss-piedavajumi";
import { irissOfferLinkPublicNotCurrent, irissOfferSourceCar } from "@/lib/iriss-public-availability";

const base = { make: "Volvo", model: "XC60", plate: "", archivedAt: "" };

describe("1. Jauna PD auto izvēle", () => {
  it("rezervētais - neaktīvs (busy); pārdotais un arhīvā pārdotais - nerādās", () => {
    const picks = irissPdCarPicks(
      [
        { ...base, id: "a", vin: "YV1AAAAAAAA000001", status: "for_sale" },
        { ...base, id: "r", vin: "YV1AAAAAAAA000002", status: "reserved" },
        { ...base, id: "s", vin: "YV1AAAAAAAA000003", status: "sold" },
        { ...base, id: "x", vin: "YV1AAAAAAAA000004", status: "for_sale", archivedAt: "2026-11-20T10:00:00Z", archiveReason: "sold" },
        { ...base, id: "y", vin: "YV1AAAAAAAA000005", status: "for_sale", archiveReason: "sold" },
      ],
      [],
    );
    expect(picks.map((p) => [p.id, Boolean(p.busy)])).toEqual([
      ["a", false],
      ["r", true],
    ]);
  });
});

describe("2. Cenu lapa pārdotam auto", () => {
  it("arhīvs ar iemeslu «sold» = pārdots; manuāla izvēle atļauj drukāt", () => {
    expect(priceSheetSold({ status: "for_sale", archivedAt: "2026-11-20", archiveReason: "sold" }, { sheetState: null })).toBe(true);
    expect(priceSheetSold({ status: "for_sale", archivedAt: "2026-11-20", archiveReason: "sold" }, { sheetState: "normal" })).toBe(false);
    expect(priceSheetSold({ status: "reserved" }, { sheetState: null })).toBe(false);
  });
});

describe("3. Vecās /p/<token> saites", () => {
  const cars = [
    { id: "ap-1", orderId: "lo-1", status: "sold", archivedAt: "x", archiveReason: "sold" },
    { id: "ap-2", orderId: "", status: "for_sale" },
  ];
  it("avota auto pēc autoparks:/logistics:", () => {
    expect(irissOfferSourceCar("autoparks:ap-1", cars)?.id).toBe("ap-1");
    expect(irissOfferSourceCar("logistics:lo-1", cars)?.id).toBe("ap-1");
    expect(irissOfferSourceCar("listing:abc", cars)).toBeNull();
    expect(irissOfferSourceCar("", cars)).toBeNull();
  });
  it("pārdots citam -> nav aktuāls; klients, kas apstiprināja, redz kā agrāk", () => {
    expect(irissOfferLinkPublicNotCurrent(false, true)).toBe(true);
    expect(irissOfferLinkPublicNotCurrent(true, true)).toBe(false);
    expect(irissOfferLinkPublicNotCurrent(false, false)).toBe(false);
  });
});

describe("4. PRO pasūtījuma detaļas - termiņa šūna atmaksātam", () => {
  it("modelis nes fullyReversed; banera vietā statuss, nevis termiņš", () => {
    const m = toAdminOrderDetailClientModel({ id: "cs_1", created: 1_700_000_000, paymentAdjustment: { label: "Strīds zaudēts", fullyReversed: true } });
    expect(m).toMatchObject({ paymentAdjustmentLabel: "Strīds zaudēts", fullyReversed: true });
    const html = renderToStaticMarkup(<AdminAuditSlaOrderBanner createdUnixSec={1_700_000_000} inactiveLabel="Strīds zaudēts" />);
    expect(html).toContain("Strīds zaudēts");
    expect(html).not.toContain("termiņš");
    expect(renderToStaticMarkup(<AdminAuditSlaOrderBanner createdUnixSec={1_700_000_000} />)).toContain("termiņš");
  });
});
