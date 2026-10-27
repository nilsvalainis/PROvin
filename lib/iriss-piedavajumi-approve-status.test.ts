import { describe, expect, it } from "vitest";
import { irissDealStatusAfterApproval, irissPdAutoparksCarId } from "@/lib/iriss-piedavajumi-approve";
import { autoparksStatusReservable } from "@/lib/iriss-autoparks";
import { irissOrderRoomNextSteps } from "@/lib/iriss-order-room";

describe("pēc klienta apstiprinājuma (audits 27.10)", () => {
  it("darījuma statuss «Jauns»/«Meklējam» -> «Piedāvāts»; tālāku posmu nepazemina", () => {
    expect(irissDealStatusAfterApproval(undefined)).toBe("piedavats");
    expect(irissDealStatusAfterApproval("jauns")).toBe("piedavats");
    expect(irissDealStatusAfterApproval("meklejam")).toBe("piedavats");
    expect(irissDealStatusAfterApproval("avanss_sanemts")).toBe("avanss_sanemts");
    expect(irissDealStatusAfterApproval("nopirkts")).toBe("nopirkts");
  });

  it("«Rezervēts» pasūtījumā nākamais solis ir avanss, nevis «Sagatavot pirmo piedāvājumu»", () => {
    const steps = irissOrderRoomNextSteps({ newHits: 3, offerCount: 0, hasPhone: true, listStatus: "reserved" });
    expect(steps.map((s) => s.label)).toEqual(["Saņemt avansu", "Sazināties ar klientu"]);
  });

  it("aktīvā pasūtījumā bez piedāvājumiem - kā agrāk", () => {
    const steps = irissOrderRoomNextSteps({ newHits: 0, offerCount: 0, hasPhone: false, listStatus: "active" });
    expect(steps.map((s) => s.label)).toEqual(["Sagatavot pirmo piedāvājumu"]);
  });
});

describe("Autoparka auto «Rezervēts» pēc apstiprinājuma (Nils 27.10)", () => {
  it("tikai Autoparka avots; Loģistika un saites neaiztiek Autoparku", () => {
    expect(irissPdAutoparksCarId("autoparks:ap-12")).toBe("ap-12");
    expect(irissPdAutoparksCarId("logistics:lo-1")).toBe("");
    expect(irissPdAutoparksCarId("")).toBe("");
  });

  it("pārslēdz no Ceļā / Gaida / Servisā / Pārdošanā; Pasūtījums, Pārdots, Rezervēts netiek pazemināti", () => {
    for (const s of ["in_transit", "prep_waiting", "in_service", "for_sale"] as const) expect(autoparksStatusReservable(s)).toBe(true);
    for (const s of ["reserved", "ordered", "sold"] as const) expect(autoparksStatusReservable(s)).toBe(false);
  });
});
