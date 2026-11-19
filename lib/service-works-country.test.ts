import { describe, expect, it } from "vitest";

import { buildDealerServiceVisitsHtml } from "@/lib/pdf-dealer-service-visits";
import {
  countryEvidenceFromRows,
  inferServiceWorkCountries,
  serviceWorkOwnCountry,
} from "@/lib/service-works-country";

const evidence = [
  { date: "10.03.2016", country: "Vācija" },
  { date: "15.06.2018", country: "Vācija" },
  { date: "20.05.2020", country: "Latvija" },
  { date: "10.04.2022", country: "Latvija" },
];

const row = (date: string, location = "") => ({ date, odometer: "", location, works: "Eļļas maiņa" });

describe("inferServiceWorkCountries", () => {
  it("aizpilda starp diviem vienas valsts kaimiņiem un tajā pašā mēnesī", () => {
    const out = inferServiceWorkCountries([row("01.01.2017"), row("25.06.2018")], evidence);
    expect(out).toEqual([
      { country: "Vācija", countryInferred: true },
      { country: "Vācija", countryInferred: true },
    ]);
  });

  it("pāri valsts maiņai, pirms pirmā un pēc pēdējā ieraksta neaizpilda", () => {
    const out = inferServiceWorkCountries([row("01.01.2019"), row("01.01.2015"), row("01.01.2024")], evidence);
    expect(out.every((o) => o.country === "" && !o.countryInferred)).toBe(true);
  });

  it("ieraksta paša valsti nemaina un neatzīmē kā secinātu", () => {
    const out = inferServiceWorkCountries([row("01.01.2017", "Autohaus X, Riga, Latvija")], evidence);
    expect(out[0]).toEqual({ country: "Latvija", countryInferred: false });
    expect(serviceWorkOwnCountry("Niederlassung Bonn BMW AG, Bonn")).toBe("");
  });

  it("bez pierādījumiem - tukšs", () => {
    expect(inferServiceWorkCountries([row("01.01.2017")], [])[0]).toEqual({ country: "", countryInferred: false });
  });

  it("sludinājumi un jau secinātas valstis nav pierādījums", () => {
    const ev = countryEvidenceFromRows([
      { date: "01.01.2017", country: "Latvija", countryUnverified: true },
      { date: "01.02.2017", country: "Lietuva", countryInferred: true },
      { date: "01.03.2017", country: "Vācija" },
      { date: "01.04.2017", country: "Nezināma valsts" },
    ]);
    expect(ev).toEqual([{ date: "01.03.2017", country: "Vācija" }]);
  });
});

describe("PDF dīlera vizītes - secinātā valsts", () => {
  it("rāda secināto valsti pie vietas, saglabātās rindas nemaina", () => {
    const rows = [row("01.01.2017", "Niederlassung Bonn BMW AG, Bonn")];
    const before = JSON.stringify(rows);
    const html = buildDealerServiceVisitsHtml(rows, { countryEvidence: evidence, omitSpan: true });
    expect(html).toContain('data-country-inferred="1"');
    expect(html).toContain("· Vācija");
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("bez pierādījumiem HTML kā agrāk", () => {
    const rows = [row("01.01.2017", "Niederlassung Bonn BMW AG, Bonn")];
    const html = buildDealerServiceVisitsHtml(rows, { omitSpan: true });
    expect(html).not.toContain("data-country-inferred");
  });
});
