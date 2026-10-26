import { describe, expect, it } from "vitest";
import { irissDealStatusAfterApproval } from "@/lib/iriss-piedavajumi-approve";
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
