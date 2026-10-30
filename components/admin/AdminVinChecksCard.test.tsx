import { describe, expect, it } from "vitest";
import { AdminVinChecksCard } from "@/components/admin/AdminVinChecksCard";
import { summarizeVinCheckDays } from "@/lib/vin-check-stats";
import { renderText } from "@/lib/test-render";

describe("AdminVinChecksCard", () => {
  it("rāda sekmīgos, kļūdainos, numurzīmes, reģionus un CSDD mēneša lietojumu", () => {
    const day = {
      date: "2026-10-29",
      counts: {
        "check:vin:ok": 8,
        "check:vin:invalid_length": 2,
        "check:plate:ok": 4,
        "check:plate:not_found": 1,
        "region:europe": 10,
        "region:northAmerica": 2,
        "model:vag": 5,
        "model:csdd": 4,
        "src:home": 9,
        "cta:cta_audit": 3,
        "csdd:decoder:found": 4,
        "csdd:admin:found": 20,
        "csdd:admin:error": 1,
      },
    };
    const s = summarizeVinCheckDays([day]);
    const t = renderText(<AdminVinChecksCard last30={s} today={s} month={s} />);
    expect(t).toContain("25%"); // 3 audita klikšķi no 12 sekmīgām
    expect(t).toContain("VIN sekmīgi 8");
    expect(t).toContain("2 garums, 0 burti");
    expect(t).toContain("Numurzīmes sekmīgi 4");
    expect(t).toContain("1 nav atrasts");
    expect(t).toContain("Eiropa 10");
    expect(t).toContain("Ziemeļamerika 2");
    expect(t).toContain("CSDD (numurzīme) 4");
    expect(t).toContain("25 / 10");
    expect(t).toContain("Kļūdas 1");
  });

  it("bez datiem nekrīt", () => {
    const empty = summarizeVinCheckDays([]);
    expect(renderText(<AdminVinChecksCard last30={empty} today={empty} month={empty} />)).toContain("VIN pārbaudes");
  });
});
