import { describe, expect, it } from "vitest";
import {
  looksLikeOfficialDealerServiceNarrative,
  parseOfficialDealerServiceNarrativePaste,
} from "@/lib/auto-records-paste-parse";

const SAMPLE = `02.2026. (278 484 km | Vācija): Veikta regulārā apkope un eļļas maiņa.

07.2025. (261 315 km | Vācija): Veikta regulārā apkope, daļiņu filtra (DPF) serviss un ūdens novadīšanas sistēmas serviss.

02.2025. (250 103 km | Vācija): Veikta regulārā apkope, eļļas maiņa un bremžu šķidruma maiņa.

04.2024. (231 804 km | Vācija): Veikta apjomīga regulārā apkope — eļļas maiņa.

01.2023. (202 424 km | Vācija): Veikta regulārā apkope.

01.2022. (179 631 km | Vācija): Fiksēta transportlīdzekļa apkalpošana.

10.2021. (173 960 km | Beļģija): Veikta pilna regulārā apkope.

03.2021. (156 960 km | Beļģija): Veikta bremžu šķidruma maiņa.

05.2020. (144 462 km | Beļģija): Fiksēta transportlīdzekļa apkalpošana.

02.2019. (113 554 km | Beļģija): Veikts serviss.

07.2018. (84 905 km | Beļģija): Veikta AdBlue papildināšana.

12.2017. (59 757 km | Beļģija): Veikta regulārā apkope.

03.2017. (29 409 km | Beļģija): Veikta pirmatnējā regulārā apkope.

06.2016. (10 km | Beļģija): Veikta pirms-piegādes sagatavošana pie jaunā auto iegādes.;`;

describe("parseOfficialDealerServiceNarrativePaste", () => {
  it("detects narrative format", () => {
    expect(looksLikeOfficialDealerServiceNarrative(SAMPLE)).toBe(true);
    expect(looksLikeOfficialDealerServiceNarrative("ODOMETER CHECK\n2020-01-01")).toBe(false);
  });

  it("parses date, km, country only (14 rows, newest first)", () => {
    const rows = parseOfficialDealerServiceNarrativePaste(SAMPLE);
    expect(rows).toHaveLength(14);
    expect(rows[0]).toEqual({ date: "01.02.2026", odometer: "278484", country: "Vācija" });
    expect(rows[6]).toEqual({ date: "01.10.2021", odometer: "173960", country: "Beļģija" });
    expect(rows[13]).toEqual({ date: "01.06.2016", odometer: "10", country: "Beļģija" });
    expect(rows.every((r) => r.date && r.odometer && r.country)).toBe(true);
  });
});
