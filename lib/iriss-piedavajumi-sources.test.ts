import { describe, expect, it } from "vitest";
import { detectIrissPdLink, IRISS_PD_ADAPTERS, irissPdLinkErrorLv, irissPdLinkSourceHint } from "@/lib/iriss-piedavajumi-sources";
import { decideAdminApiAccess, decideAdminPageAccess, IRISS_SECTIONS } from "@/lib/staff-roles";

describe("Piedāvājumi: izsoles saites atpazīšana", () => {
  it.each([
    ["https://www.auto1.com/en/app/merchant/car/DE48213", "auto1", "DE48213"],
    ["auto1.com/de/app/merchant/car/at12345?x=1", "auto1", "AT12345"],
    ["https://www.openlane.eu/en/car/info?auctionId=1234567", "openlane", "1234567"],
    ["https://www.autobid.de/lot/48213-ford-transit", "autobid", "48213"],
    ["https://autobid.de/en/item/ford-transit-2-0-tdci-3215456/details", "autobid", "3215456"],
    ["https://suchen.mobile.de/fahrzeuge/details.html?id=412345678&lang=en", "mobilede", "412345678"],
    ["https://www.mobile.de/fahrzeuge/auto/412345678.html", "mobilede", "412345678"],
  ])("%s", (url, source, key) => {
    expect(detectIrissPdLink(url)).toMatchObject({ source, key });
  });

  it("svešas un nepilnas saites netiek atpazītas", () => {
    expect(detectIrissPdLink("https://example.com/car/DE48213")).toBeNull();
    expect(detectIrissPdLink("https://www.auto1.com/en/home")).toBeNull();
    expect(detectIrissPdLink("javascript:alert(1)")).toBeNull();
    expect(detectIrissPdLink("")).toBeNull();
  });

  it("platformas zīme rakstīšanas laikā", () => {
    expect(irissPdLinkSourceHint("https://www.autobid.de/")).toBe("autobid");
    expect(irissPdLinkSourceHint("openline.eu")).toBe("openlane");
    expect(irissPdLinkSourceHint("nav saite")).toBeNull();
  });

  it("adapteri: Auto1 pilns, Openlane caur releju, Autobid un mobile.de - stub ar LV paskaidrojumu", () => {
    expect(IRISS_PD_ADAPTERS.auto1.mode).toBe("relay_auto1");
    expect(IRISS_PD_ADAPTERS.openlane.mode).toBe("relay_basic");
    expect(IRISS_PD_ADAPTERS.autobid.mode).toBe("stub");
    expect(IRISS_PD_ADAPTERS.mobilede.stubNote).toContain("ar roku");
  });

  it("kļūdu teksti", () => {
    expect(irissPdLinkErrorLv("not_auction_link")).toContain("Auto1, Autobid, Openlane vai mobile.de");
    expect(irissPdLinkErrorLv("relay_error")).toBe("Neizdevās nolasīt saiti - pārbaudi URL vai aizpildi manuāli.");
  });
});

describe("Piedāvājumi: tikai Admin", () => {
  const staff = { kind: "staff" as const, sections: [...IRISS_SECTIONS] };

  it("darbinieks (pat ar visām sadaļām) neatver lapas un API; admins atver", () => {
    expect(decideAdminPageAccess("/admin/iriss/piedavajumi", staff)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/iriss/piedavajumi/jauns", staff)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/iriss-piedavajumi", staff)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/iriss-piedavajumi/x/foto/0", staff)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/iriss/piedavajumi", { kind: "admin" })).toBe("allow");
  });
});
