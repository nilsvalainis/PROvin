import { describe, expect, it } from "vitest";
import {
  extractMakeModelFromListingUrl,
  formatPdfReportMakeModel,
  resolvePdfReportMakeModel,
} from "@/lib/pdf-report-vehicle-identity";

describe("resolvePdfReportMakeModel", () => {
  it("ņem CSDD pirms dīlera un sludinājuma", () => {
    expect(
      resolvePdfReportMakeModel({
        csddMakeModel: "Audi Q7",
        dealerModel: "Range Rover Sport",
        listingUrl: "https://www.ss.lv/msg/lv/transport/cars/bmw/x5/abcd.html",
      }),
    ).toBe("Audi Q7");
  });

  it("ja CSDD nav, ņem oficiālā dīlera modeli", () => {
    expect(
      resolvePdfReportMakeModel({
        dealerModel: "Range Rover Sport",
        listingUrl: "https://www.ss.lv/msg/lv/transport/cars/audi/q7/abcd.html",
      }),
    ).toBe("Range Rover Sport");
  });

  it("ja nav CSDD un dīlera, ņem ss.lv ceļu", () => {
    expect(extractMakeModelFromListingUrl("https://www.ss.lv/msg/lv/transport/cars/audi/q7/msg123.html")).toBe(
      "audi q7",
    );
    expect(
      resolvePdfReportMakeModel({
        listingUrl: "https://www.ss.lv/msg/lv/transport/cars/audi/q7/msg123.html",
      }),
    ).toBe("audi q7");
    expect(formatPdfReportMakeModel("audi q7")).toBe("AUDI Q7");
  });
});
