import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ecarstradePreciseLinksDryRunRecords } from "@/lib/iriss-ecarstrade-links-dry-run-fixtures";
import {
  dryRunRecordsFromPasutijumiBackup,
  formatEcarstradeDryRunReport,
} from "@/lib/iriss-ecarstrade-links-dry-run";

describe("eCarsTrade dry-run markdown", () => {
  it("lists source criteria and resulting ET links without claiming a write", () => {
    const md = formatEcarstradeDryRunReport(ecarstradePreciseLinksDryRunRecords());
    expect(md).toContain("Produkcijas dati netiek rakstīti");
    expect(md).toContain("Anna / Volvo XC60 dīzelis AWD");
    expect(md).toContain("fuel[]=Diesel");
    expect(md).toContain("iriss_drive=awd");
    expect(md).toContain("Audi A6 diesel vs petrol");
    expect(md).toMatch(/fuel\[\]=Petrol/);
    expect(md).toContain("nav kartējams");
    expect(md).toContain("brandId=12");
    expect(md).not.toContain("engine_from=6060");
    expect(md).not.toContain("\u2014");
    expect(md).not.toContain("Produkcijas dati tiek rakstīti");
    const golden = readFileSync("lib/__fixtures__/iriss-ecarstrade/precise-links-dry-run.md", "utf8");
    expect(md).toBe(golden);
  });

  it("loads anonymized records from a pasutijumi backup payload", () => {
    const records = dryRunRecordsFromPasutijumiBackup({
      orderDrafts: {
        "a.json": JSON.stringify({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          brandModel: "Audi A6",
          clientFirstName: "SECRET",
          phone: "+37100000000",
          email: "hidden@example.com",
          listingLinkAuto1: ["https://www.auto1.com/en/app/merchant/cars?manufacturers=Audi%7CA6"],
          listingLinkOpenline: [],
          listingLinkAutobid: [],
          listingLinkMobile: [],
        }),
      },
    });
    expect(records).toHaveLength(1);
    expect(records[0]?.brandModel).toBe("Audi A6");
    expect(JSON.stringify(records)).not.toContain("SECRET");
    expect(JSON.stringify(records)).not.toContain("hidden@example.com");
  });
});
