import { describe, expect, it } from "vitest";
import { IrissSearchSwitch } from "@/components/admin/IrissSearchSwitch";
import { serializeIrissOrderDraft } from "@/lib/admin-iriss-pasutijumi-backup-payload";
import { adminChangeFieldValue, applyIrissOrderSnapshot, diffAdminChangeFields, snapshotIrissOrder } from "@/lib/admin-change-history";
import { discoverListingOrderMatches } from "@/lib/iriss-listing-match";
import { buildIrissListingSources } from "@/lib/iriss-listings-sources";
import { applyIrissOrderStage } from "@/lib/iriss-order-stage";
import { appendIrissStatusHistory, setIrissSearchOn } from "@/lib/iriss-pasutijumi-audit-fields";
import { parseIrissPasutijumsPatchBody } from "@/lib/iriss-pasutijumi-body";
import { countIrissListSearchOn, irissListRowVisible, irissPasutijumsToListRow } from "@/lib/iriss-pasutijumi-list-row";
import { mergeIrissPasutijumsRecords } from "@/lib/iriss-pasutijumi-save-safety";
import { IRISS_LIST_STATUS_DEFAULT_FILTER } from "@/lib/iriss-pasutijumi-status-filter";
import {
  IRISS_ORDER_STAGES,
  IRISS_PASUTIJUMS_LIST_STATUSES,
  emptyIrissPasutijums,
  irissSearchOverrideFor,
  isIrissPasutijumsSearchOn,
  isIrissPasutijumsSearchingStatus,
  type IrissPasutijumsRecord,
  type IrissSearchOverride,
} from "@/lib/iriss-pasutijumi-types";
import { mergeServerOwnedIrissFields } from "@/lib/iriss-server-owned-fields";
import { isMarketplaceAutoOrderActive } from "@/lib/marketplace/auto-load";
import { renderHtml, renderText } from "@/lib/test-render";

const ID = "11111111-1111-4111-8111-111111111111";
const AT = "2026-11-24T10:00:00.000Z";
const LATER = "2026-11-24T11:00:00.000Z";

function rec(over: Partial<IrissPasutijumsRecord> = {}): IrissPasutijumsRecord {
  return { ...emptyIrissPasutijums(ID, AT), brandModel: "BMW 530e", ...over };
}

describe("faktiskā meklēšana (statuss x slēdzis)", () => {
  it("visas kombinācijas: slēdzis uzvar, citādi statusa noklusējums", () => {
    const overrides: Array<IrissSearchOverride | undefined> = [undefined, "on", "off"];
    for (const listStatus of IRISS_PASUTIJUMS_LIST_STATUSES) {
      for (const searchOverride of overrides) {
        const want = searchOverride ? searchOverride === "on" : isIrissPasutijumsSearchingStatus(listStatus);
        expect(`${listStatus}/${searchOverride ?? "-"}:${isIrissPasutijumsSearchOn({ listStatus, searchOverride })}`).toBe(
          `${listStatus}/${searchOverride ?? "-"}:${want}`,
        );
        // Izdzēsts pasūtījums nemeklē nekad.
        expect(isIrissPasutijumsSearchOn({ listStatus, searchOverride, deletedAt: AT })).toBe(false);
      }
    }
    expect(isIrissPasutijumsSearchOn({ listStatus: "reserved" })).toBe(false);
    expect(isIrissPasutijumsSearchOn({ listStatus: "completed", searchOverride: "on" })).toBe(true);
    expect(isIrissPasutijumsSearchOn({ listStatus: "active", searchOverride: "off" })).toBe(false);
    // Nezināma vērtība = nav slēdža.
    expect(isIrissPasutijumsSearchOn({ listStatus: "active", searchOverride: "maybe" })).toBe(true);
  });

  it("glabā tikai atšķirību no statusa noklusējuma", () => {
    expect(irissSearchOverrideFor("active", true)).toBeUndefined();
    expect(irissSearchOverrideFor("active", false)).toBe("off");
    expect(irissSearchOverrideFor("reserved", false)).toBeUndefined();
    expect(irissSearchOverrideFor("reserved", true)).toBe("on");
    const off = setIrissSearchOn(rec(), false, { at: LATER });
    expect(off.searchOverride).toBe("off");
    expect(off.statusChangedAt).toBe(LATER);
    const back = setIrissSearchOn(off, true, { at: LATER });
    expect(back.searchOverride).toBeUndefined();
    expect("searchOverride" in JSON.parse(JSON.stringify(back))).toBe(false);
    const same = rec();
    expect(setIrissSearchOn(same, true, { at: LATER })).toBe(same);
  });
});

describe("statusa maiņa notīra slēdzi", () => {
  it("ar roku (posms) un automātiski (vēsture)", () => {
    for (const stage of IRISS_ORDER_STAGES) {
      const next = applyIrissOrderStage(rec({ searchOverride: "on" }), stage, { at: LATER });
      expect(`${stage}:${next.searchOverride ?? "-"}`).toBe(`${stage}:-`);
    }
    const sold = appendIrissStatusHistory(rec({ listStatus: "reserved", searchOverride: "on" }), "completed", { at: LATER });
    expect(sold.searchOverride).toBeUndefined();
    expect(isIrissPasutijumsSearchOn(sold)).toBe(false);
    // Tas pats statuss = nav maiņas, slēdzis paliek.
    expect(appendIrissStatusHistory(rec({ listStatus: "reserved", searchOverride: "on" }), "reserved", { at: LATER }).searchOverride).toBe("on");
  });
});

describe("avoti un automātika ievēro slēdzi", () => {
  const link = { listingLinkAutobid: ["https://autobid.de/en/search-results?q=1"] };
  const row = (id: string, over: Partial<IrissPasutijumsRecord>) => ({ id, brandModel: "BMW 530e", listStatus: "active" as const, ...link, ...over });

  it("izsoļu avotu saraksts", () => {
    const sources = buildIrissListingSources([
      row("a", {}),
      row("a-off", { searchOverride: "off" }),
      row("r", { listStatus: "reserved" }),
      row("r-on", { listStatus: "reserved", searchOverride: "on" }),
      row("c-on", { listStatus: "completed", searchOverride: "on" }),
      row("del-on", { listStatus: "active", searchOverride: "on", deletedAt: AT }),
    ]);
    expect(sources.map((s) => s.orderId)).toEqual(["a", "r-on", "c-on"]);
  });

  it("mobile.de / AutoScout24 automātiskā ielāde", () => {
    const brief = (over: Partial<Parameters<typeof isMarketplaceAutoOrderActive>[0]>) => ({ id: "o", createdAt: AT, updatedAt: AT, listStatus: "active" as const, ...over });
    expect(isMarketplaceAutoOrderActive(brief({}))).toBe(true);
    expect(isMarketplaceAutoOrderActive(brief({ searchOverride: "off" }))).toBe(false);
    expect(isMarketplaceAutoOrderActive(brief({ listStatus: "reserved" }))).toBe(false);
    expect(isMarketplaceAutoOrderActive(brief({ listStatus: "reserved", searchOverride: "on" }))).toBe(true);
    expect(isMarketplaceAutoOrderActive(brief({ listStatus: "inactive", searchOverride: "on", deletedAt: AT }))).toBe(false);
  });

  it("jaunu sludinājumu piesaiste", () => {
    const vehicle = { id: "v1", platform: "autobid" as const, title: "BMW 530e", manufacturer: "BMW", orderIds: ["o1"], change: "new" as const };
    const order = (over: object) => ({ id: "o1", brandModel: "BMW 530e", listStatus: "active", ...link, ...over });
    expect(discoverListingOrderMatches([vehicle], [order({})])).toHaveLength(1);
    expect(discoverListingOrderMatches([vehicle], [order({ searchOverride: "off" })])).toEqual([]);
    expect(discoverListingOrderMatches([vehicle], [order({ listStatus: "reserved" })])).toEqual([]);
    expect(discoverListingOrderMatches([vehicle], [order({ listStatus: "reserved", searchOverride: "on" })])).toHaveLength(1);
  });
});

describe("slēdzis nepazūd saglabājot", () => {
  it("PATCH ķermenis, saraksta rinda, rezerves kopija", () => {
    const parsed = parseIrissPasutijumsPatchBody(ID, { ...rec({ searchOverride: "off" }) });
    expect(parsed?.searchOverride).toBe("off");
    expect(parseIrissPasutijumsPatchBody(ID, { ...rec(), searchOverride: "x" })?.searchOverride).toBeUndefined();
    expect(irissPasutijumsToListRow(rec({ searchOverride: "off" })).searchOverride).toBe("off");
    expect("searchOverride" in irissPasutijumsToListRow(rec())).toBe(false);
    expect(JSON.parse(serializeIrissOrderDraft(rec({ listStatus: "reserved", searchOverride: "on" }))).searchOverride).toBe("on");
  });

  it("sapludināšana: slēdzis ceļo kopā ar jaunāko statusu", () => {
    const server = rec({ searchOverride: "off", statusChangedAt: LATER });
    const staleTab = rec({ notes: "labots citā cilnē" });
    expect(mergeIrissPasutijumsRecords(server, staleTab).searchOverride).toBe("off");
    expect(mergeServerOwnedIrissFields(staleTab, server).searchOverride).toBe("off");
    // Serverī statuss mainīts vēlāk (slēdzis notīrīts) - vecās cilnes «on» neatdzīvojas.
    const serverSold = rec({ listStatus: "completed", statusChangedAt: LATER });
    const tabOn = rec({ listStatus: "reserved", searchOverride: "on", statusChangedAt: AT });
    expect(mergeIrissPasutijumsRecords(serverSold, tabOn).searchOverride).toBeUndefined();
    expect(mergeServerOwnedIrissFields(tabOn, serverSold).searchOverride).toBeUndefined();
    // Lokālā maiņa jaunāka - uzvar lokālā.
    const tabOff = rec({ searchOverride: "off", statusChangedAt: LATER });
    expect(mergeIrissPasutijumsRecords(rec({ statusChangedAt: AT }), tabOff).searchOverride).toBe("off");
  });

  it("izmaiņu vēsture ieraksta slēdža maiņu", () => {
    const before = snapshotIrissOrder(rec());
    const after = snapshotIrissOrder(rec({ searchOverride: "off" }));
    const diff = diffAdminChangeFields(before, after);
    expect(diff.map((d) => d.field)).toEqual(["searchOverride"]);
    expect(adminChangeFieldValue("iriss-order", "searchOverride", "off")).toBe("Nemeklē");
    expect(adminChangeFieldValue("iriss-order", "searchOverride", "on")).toBe("Meklē");
    expect(applyIrissOrderSnapshot(rec(), after).searchOverride).toBe("off");
    expect(applyIrissOrderSnapshot(rec({ searchOverride: "off" }), before).searchOverride).toBeUndefined();
  });
});

describe("filtrs «Meklē»", () => {
  const rows = [
    irissPasutijumsToListRow(rec({ id: "a" })),
    irissPasutijumsToListRow(rec({ id: "a-off", searchOverride: "off" })),
    irissPasutijumsToListRow(rec({ id: "r", listStatus: "reserved" })),
    irissPasutijumsToListRow(rec({ id: "sold-on", listStatus: "completed", searchOverride: "on" })),
    irissPasutijumsToListRow(rec({ id: "trash", deletedAt: AT })),
  ];

  it("skaits un redzamība neatkarīgi no statusu čipiem, bez miskastes", () => {
    expect(countIrissListSearchOn(rows)).toBe(2);
    const visible = (opts: { trashOn: boolean; searchOnOnly: boolean }) =>
      rows.filter((r) => irissListRowVisible(r, IRISS_LIST_STATUS_DEFAULT_FILTER, opts)).map((r) => r.id);
    expect(visible({ trashOn: false, searchOnOnly: true })).toEqual(["a", "sold-on"]);
    expect(visible({ trashOn: false, searchOnOnly: false })).toEqual(["a", "a-off", "r"]);
    expect(visible({ trashOn: true, searchOnOnly: false })).toEqual(["trash"]);
  });
});

describe("IrissSearchSwitch", () => {
  it("role=switch ar tekstu Meklē / Nemeklē", () => {
    const on = renderHtml(<IrissSearchSwitch on onChange={() => undefined} />);
    expect(on).toContain('role="switch"');
    expect(on).toContain('aria-checked="true"');
    expect(renderText(<IrissSearchSwitch on onChange={() => undefined} />)).toBe("Meklē");
    const off = renderHtml(<IrissSearchSwitch on={false} onChange={() => undefined} />);
    expect(off).toContain('aria-checked="false"');
    expect(renderText(<IrissSearchSwitch on={false} onChange={() => undefined} />)).toBe("Nemeklē");
  });
});
