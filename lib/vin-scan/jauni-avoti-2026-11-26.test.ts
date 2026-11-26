import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const scanFetch = vi.fn();
vi.mock("@/lib/vin-scan/http", () => ({
  scanFetch: (...args: unknown[]) => scanFetch(...args),
}));

import {
  isVinScanSourceId,
  vinScanPipelineSourceIds,
  vinScanSourceCategory,
  vinScanSourceLinkOnly,
} from "@/lib/vin-scan/catalog";
import { czPoliceSearchUrl, parseCzPoliceDetail, parseCzPoliceHits, parseCzPoliceSearch } from "@/lib/vin-scan/cz-police";
import { freeVinScanSourceIds, isPaidVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { vinScanManualLinks } from "@/lib/vin-scan/manual-links";
import { nhtsaComplaintsApiUrl, nhtsaComponentLv, parseNhtsaComplaints } from "@/lib/vin-scan/nhtsa-complaints";
import {
  fordRecallCheckUrl,
  oemRecallLinkBrandForVin,
  stellantisRecallCheckUrl,
  MOTOR_OMBUDSMAN_RECALLS_URL,
} from "@/lib/vin-scan/oem-recall-links";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { probeCzPolice, probeLinkOnly, probeNhtsaComplaints } from "@/lib/vin-scan/probes-new-sources";
import { buildVinScanFacts } from "@/lib/vin-scan/summary";
import { isVinScanWantedSource, vinScanWantedStatusLabel } from "@/lib/vin-scan/wanted";

const fx = (dir: string, name: string) => readFileSync(join(__dirname, "__fixtures__", dir, name), "utf8");

const CZ_VIN = "TMBJJ7NE9L0123456"; // izdomāts, sakrīt ar sintētisko fiktūru
const NONE_VIN = "WVWZZZ1KZ6W000001"; // reālā 26.11 testa vaicājuma VIN (nav meklēšanā)
const US_ACURA = "5J8TB2H53CA000001";
const EU_KIA = "U5YH6G17GNL050102";
const EU_SKODA = "TMBJH9NP9N7043581";
const EU_PEUGEOT = "VF3MCYHZRKS000001";
const EU_OPEL = "W0LBD6EA0GC000001";
const EU_FORD = "WF0AXXWPMAFA00001";
const EU_BMW = "WBA5R1C0XLFH42873";

function ctx(vin: string, hint?: { make: string; model: string; year: string } | null) {
  return {
    vin,
    plates: emptyVinScanPlates(),
    listingUrl: "",
    ...(hint !== undefined ? { vehicleHint: async () => hint } : {}),
  };
}

afterEach(() => {
  scanFetch.mockReset();
});

describe("CZ policija (Pátrání po vozidlech)", () => {
  it("katalogā: zādzība, automātisks, bezmaksas, «Meklēšanā» kartīte", () => {
    expect(isVinScanSourceId("cz_patrani")).toBe(true);
    expect(vinScanSourceCategory("cz_patrani")).toBe("zadziba");
    expect(vinScanSourceLinkOnly("cz_patrani")).toBe(false);
    expect(isPaidVinScanSourceId("cz_patrani")).toBe(false);
    expect(freeVinScanSourceIds()).toContain("cz_patrani");
    expect(isVinScanWantedSource("cz_patrani")).toBe(true);
    expect(czPoliceSearchUrl(" tmbjj7ne9l0123456 ")).toBe(`https://policie.gov.cz/patrani-vozidla?Vin=${CZ_VIN}`);
  });

  it("reāla «Nebyly nalezeny žádné výsledky» lapa ir none; VIN tikai formas laukā nav trāpījums", () => {
    const html = fx("cz-policie", "nav-meklesana.html");
    expect(html).toContain(`value="${NONE_VIN}"`);
    expect(parseCzPoliceHits(html, NONE_VIN)).toEqual([]);
    expect(parseCzPoliceSearch(200, html, NONE_VIN)).toMatchObject({ status: "none", summary: "Nav meklēšanā" });
    expect(vinScanWantedStatusLabel("none")).toBe("Nav meklēšanā");
  });

  it("tabulas rinda ar šo VIN ir found ar marku, RZ un detaļām", () => {
    const html = fx("cz-policie", "meklesana-trapijums.html");
    const hits = parseCzPoliceHits(html, CZ_VIN);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ druh: "osobní automobil", vyrobce: "ŠKODA", typ: "OCTAVIA", rz: "5AB 1234", mpz: "CZ" });
    expect(hits[0]?.detailUrl).toBe(`https://policie.gov.cz/patrani-vozidla?id=987654&Vin=${CZ_VIN}`);
    const detail = parseCzPoliceDetail(fx("cz-policie", "detail.html"));
    expect(detail).toEqual({ barva: "šedá", rokVyroby: "2020", datumVyhlaseni: "14.03.2026" });
    const parsed = parseCzPoliceSearch(200, html, CZ_VIN, detail);
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toBe("Meklēšanā (Čehijas policija). ŠKODA OCTAVIA, RZ 5AB 1234 (CZ), šedá, 2020. g., meklēšanā kopš 14.03.2026");
    expect(parsed.flags).toMatchObject({ wanted: true, stolen: true });
  });

  it("cita VIN rinda nav trāpījums; nezināma lapa un HTTP kļūda ir unknown, nevis «nav meklēšanā»", () => {
    const html = fx("cz-policie", "meklesana-trapijums.html");
    expect(parseCzPoliceSearch(200, html, "TMBJJ7NE9L0999999").status).toBe("unknown");
    expect(parseCzPoliceSearch(200, "<html><body>Údržba systému</body></html>", CZ_VIN).status).toBe("unknown");
    expect(parseCzPoliceSearch(503, "", CZ_VIN)).toMatchObject({ status: "unknown", summary: "CZ policija: HTTP 503" });
  });

  it("zonde: viens GET bez trāpījuma; ar trāpījumu vēl detaļu lapa", async () => {
    scanFetch.mockResolvedValueOnce({ status: 200, text: fx("cz-policie", "nav-meklesana.html") });
    const none = await probeCzPolice(ctx(NONE_VIN));
    expect(scanFetch).toHaveBeenCalledTimes(1);
    expect(scanFetch.mock.calls[0]?.[0]).toBe(czPoliceSearchUrl(NONE_VIN));
    expect(none).toMatchObject({ id: "cz_patrani", status: "none" });

    scanFetch.mockReset();
    scanFetch
      .mockResolvedValueOnce({ status: 200, text: fx("cz-policie", "meklesana-trapijums.html") })
      .mockResolvedValueOnce({ status: 200, text: fx("cz-policie", "detail.html") });
    const found = await probeCzPolice(ctx(CZ_VIN));
    expect(scanFetch).toHaveBeenCalledTimes(2);
    expect(found.status).toBe("found");
    expect(found.summary).toContain("meklēšanā kopš 14.03.2026");
    expect(buildVinScanFacts([found], CZ_VIN).wanted).toEqual(["CZ policija"]);
  });

  it("zonde: tīkla kļūda ir unknown ar saiti", async () => {
    scanFetch.mockRejectedValueOnce(new Error("timeout"));
    const row = await probeCzPolice(ctx(CZ_VIN));
    expect(row.status).toBe("timeout");
    expect(row.openUrl).toBe(czPoliceSearchUrl(CZ_VIN));
  });
});

describe("NHTSA sūdzības (Tipiskās kaites / sūdzības)", () => {
  const acura = { make: "ACURA", model: "RDX", year: "2012" };

  it("katalogā: ražotāja grupa, automātisks, bezmaksas", () => {
    expect(vinScanSourceCategory("nhtsa_complaints")).toBe("razotajs");
    expect(vinScanPipelineSourceIds()).toContain("nhtsa_complaints");
    expect(isPaidVinScanSourceId("nhtsa_complaints")).toBe(false);
    expect(nhtsaComplaintsApiUrl("ACURA", "RDX", "2012")).toBe(
      "https://api.nhtsa.gov/complaints/complaintsByVehicle?make=ACURA&model=RDX&modelYear=2012",
    );
    expect(nhtsaComponentLv("AIR BAGS")).toBe("Drošības spilveni");
    expect(nhtsaComponentLv("SOMETHING NEW")).toBe("SOMETHING NEW");
  });

  it("fiktūra (2012 Acura RDX, 15 sūdzības): kopskaits, biežākās komponentes, bez citu auto VIN un tekstiem", () => {
    const parsed = parseNhtsaComplaints(200, fx("nhtsa-complaints", "2012-acura-rdx.json"), acura);
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toMatch(/^Tipiskās kaites \/ sūdzības: 15 · Drošības spilveni 6, /);
    expect(parsed.summary).toBe("Tipiskās kaites / sūdzības: 15 · Drošības spilveni 6, Cits / nezināms 2, Elektrosistēma 2, Stūres iekārta 2");
    expect(parsed.detail).toContain("Modelis: 2012 ACURA RDX (NHTSA, ASV)");
    expect(parsed.detail).not.toMatch(/5J8TB|Odometer Fraud/);
    expect(parsed.openUrl).toBe("https://www.nhtsa.gov/vehicle/2012/ACURA/RDX");
    expect(parsed.vehicle).toEqual(acura);
  });

  it("0 sūdzību: ASV auto - none; ES auto ar reģistra modeli - skipped (nav ASV tirgus modelis)", () => {
    const empty = fx("nhtsa-complaints", "empty.json");
    expect(parseNhtsaComplaints(200, empty, acura).status).toBe("none");
    const eu = parseNhtsaComplaints(200, empty, { make: "SKODA", model: "OCTAVIA", year: "2020" }, { usMarket: false });
    expect(eu.status).toBe("skipped");
    expect(parseNhtsaComplaints(500, "", acura).status).toBe("unknown");
    expect(parseNhtsaComplaints(200, "<html>", acura).status).toBe("unknown");
  });

  it("ES auto ar sakrītošu modeli: found ar brīdinājumu «ASV tirgus modelis, var neattiekties»", () => {
    const parsed = parseNhtsaComplaints(200, fx("nhtsa-complaints", "2012-acura-rdx.json"), acura, { usMarket: false });
    expect(parsed.summary).toMatch(/ASV tirgus modelis, var neattiekties/);
  });

  it("zonde ASV VIN: vPIC -> sūdzības", async () => {
    scanFetch
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ Results: [{ Make: "ACURA", Model: "RDX", ModelYear: "2012" }] }) })
      .mockResolvedValueOnce({ status: 200, text: fx("nhtsa-complaints", "2012-acura-rdx.json") });
    const row = await probeNhtsaComplaints(ctx(US_ACURA));
    expect(scanFetch.mock.calls[1]?.[0]).toBe(nhtsaComplaintsApiUrl("ACURA", "RDX", "2012"));
    expect(row).toMatchObject({ id: "nhtsa_complaints", status: "found" });
  });

  it("zonde ES VIN: modelis no reģistra (bez vPIC); bez modeļa - skipped bez tīkla", async () => {
    scanFetch.mockResolvedValueOnce({ status: 200, text: fx("nhtsa-complaints", "empty.json") });
    const row = await probeNhtsaComplaints(ctx(EU_SKODA, { make: "SKODA", model: "OCTAVIA", year: "2022" }));
    expect(scanFetch).toHaveBeenCalledTimes(1);
    expect(scanFetch.mock.calls[0]?.[0]).toBe(nhtsaComplaintsApiUrl("SKODA", "OCTAVIA", "2022"));
    expect(row.status).toBe("skipped");

    scanFetch.mockReset();
    const noHint = await probeNhtsaComplaints(ctx(EU_SKODA, null));
    expect(scanFetch).not.toHaveBeenCalled();
    expect(noHint.status).toBe("skipped");
  });
});

describe("ražotāju atsaukumu saites (tā pati sistēma kā #1249)", () => {
  it("WMI -> marka", () => {
    expect(oemRecallLinkBrandForVin(EU_KIA)).toBe("kia");
    expect(oemRecallLinkBrandForVin(EU_SKODA)).toBe("skoda");
    expect(oemRecallLinkBrandForVin("WAUZZZF43PA018831")).toBe("audi");
    expect(oemRecallLinkBrandForVin("VSSZZZKJZLR000001")).toBe("seat");
    expect(oemRecallLinkBrandForVin(EU_PEUGEOT)).toBe("stellantis");
    expect(oemRecallLinkBrandForVin(EU_FORD)).toBe("ford");
    expect(oemRecallLinkBrandForVin(EU_BMW)).toBeNull();
    expect(stellantisRecallCheckUrl(EU_PEUGEOT)).toContain("peugeot.co.uk");
    expect(stellantisRecallCheckUrl(EU_OPEL)).toBe(`${MOTOR_OMBUDSMAN_RECALLS_URL}?vin=${EU_OPEL}`);
    expect(fordRecallCheckUrl(EU_FORD)).toContain("ford.co.uk");
    expect(fordRecallCheckUrl("1FTFW1ET5DFC10312")).toContain("ford.com");
  });

  it("tikai saites, tikai attiecīgajai markai", () => {
    for (const id of ["recall_kia", "recall_skoda", "recall_audi", "recall_seat", "recall_stellantis", "recall_ford"]) {
      expect(vinScanSourceLinkOnly(id), id).toBe(true);
      expect(vinScanSourceCategory(id), id).toBe("atsaukumi");
      expect(vinScanPipelineSourceIds(), id).not.toContain(id);
    }
    const kia = vinScanManualLinks(EU_KIA).map((l) => l.id);
    expect(kia).toContain("recall_kia");
    expect(kia).not.toContain("recall_skoda");
    expect(kia).not.toContain("recall_vw");
    const skoda = vinScanManualLinks(EU_SKODA).map((l) => l.id);
    expect(skoda).toEqual(expect.arrayContaining(["recall_vw", "recall_skoda"]));
    expect(skoda).not.toContain("recall_audi");
    expect(vinScanManualLinks(EU_SKODA).find((l) => l.id === "recall_skoda")?.href).toBe(`https://recall.skoda-auto.com/411/lv-lv?vin=${EU_SKODA}`);
    const bmw = vinScanManualLinks(EU_BMW).map((l) => l.id);
    for (const id of ["recall_kia", "recall_skoda", "recall_audi", "recall_seat", "recall_stellantis", "recall_ford"]) {
      expect(bmw, id).not.toContain(id);
    }
  });

  it("saites zonde neko nelasa: browser_only ar saiti", () => {
    const row = probeLinkOnly("recall_kia", ctx(EU_KIA));
    expect(row.status).toBe("browser_only");
    expect(row.openUrl).toContain("kia.com/eu");
    expect(scanFetch).not.toHaveBeenCalled();
  });
});

describe("Kanāda: CPIC un IBC VIN Verify (tikai saites)", () => {
  it("noteikumi neatļauj automatizāciju -> saites, tikai Ziemeļamerikas VIN", () => {
    for (const id of ["ca_cpic", "ca_ibc"]) {
      expect(vinScanSourceLinkOnly(id), id).toBe(true);
      expect(freeVinScanSourceIds(), id).not.toContain(id);
    }
    expect(vinScanSourceCategory("ca_cpic")).toBe("zadziba");
    expect(vinScanSourceCategory("ca_ibc")).toBe("apdrosinasana");
    const us = vinScanManualLinks(US_ACURA);
    expect(us.find((l) => l.id === "ca_cpic")?.href).toBe(`https://www.cpic-cipc.ca/sve-rve-eng.htm?vin=${US_ACURA}`);
    expect(us.find((l) => l.id === "ca_ibc")?.href).toContain("ibc.ca");
    const eu = vinScanManualLinks(EU_BMW).map((l) => l.id);
    expect(eu).not.toContain("ca_cpic");
    expect(eu).not.toContain("ca_ibc");
  });
});
