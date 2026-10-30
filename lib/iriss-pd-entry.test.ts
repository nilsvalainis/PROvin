import { describe, expect, it } from "vitest";
import { IRISS_PD_NEW_PATH, irissPdNewHref, irissPdSourceRefHref, parseIrissPdEntry } from "@/lib/iriss-pd-entry";

describe("PD viena ieeja (Nils 27.10)", () => {
  it("pogas ved uz PD ar izvēlētu avotu, saiti un pasūtījumu", () => {
    expect(irissPdNewHref()).toBe(IRISS_PD_NEW_PATH);
    expect(irissPdNewHref({ from: "autoparks", id: "ap-1" })).toBe(`${IRISS_PD_NEW_PATH}?from=autoparks%3Aap-1`);
    expect(irissPdNewHref({ link: "https://www.auto1.com/x", orderId: "o-7" })).toBe(
      `${IRISS_PD_NEW_PATH}?link=https%3A%2F%2Fwww.auto1.com%2Fx&order=o-7`,
    );
  });

  it("nolasa avotu atpakaļ; nederīgais tiek ignorēts", () => {
    expect(parseIrissPdEntry({ from: "logistics:lo_12", order: "o-7" })).toEqual({ tab: "logistics", carId: "lo_12", link: "", orderId: "o-7" });
    expect(parseIrissPdEntry({ link: "https://www.openlane.eu/car/1" })).toMatchObject({ tab: "link", link: "https://www.openlane.eu/car/1" });
    expect(parseIrissPdEntry({ from: "autoparks:../x", order: "a b", link: "javascript:alert(1)" })).toEqual({ tab: "link", carId: "", link: "", orderId: "" });
  });

  it("avota auto saite - uz īsto Autoparka kabinetu vai Loģistikas auto", () => {
    expect(irissPdSourceRefHref("autoparks:ap-1")).toBe("/admin/iriss/autoparks-v2/ap-1");
    expect(irissPdSourceRefHref("logistics:lo_12")).toBe("/admin/iriss/logistika?car=lo_12");
  });
});
