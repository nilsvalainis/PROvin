import { describe, expect, it } from "vitest";
import {
  buildCsddRelayUrl,
  csddApiDateToIso,
  csddTechDataLookupPath,
  csddXmlTagValue,
  decodeCsddXmlBody,
  fetchCsddTechData,
  parseCsddTechDataXml,
} from "@/lib/csdd-tech-data";
import {
  applyCsddTechDataToBlock,
  csddTechLookupNr1,
  csddTechSeedNeeded,
  csddVinMatchesOrder,
} from "@/lib/csdd-tech-data-apply";
import { emptyCsddFields } from "@/lib/admin-source-blocks";

/**
 * Reālas CSDD servisa atbildes, nolasītas caur VPN 2026-10-06 (CSDD pašu paraugs NG8493).
 * Baiti glabāti kā base64, jo serviss atdod windows-1257, nevis UTF-8.
 */
const REAL_RESPONSE_B64 =
  "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iV0lORE9XUy0xMjU3IiA/Pgo8VExfREFUST4KPFJOPk5HODQ5MzwvUk4+CjxWSU4+VE1CSkg5TlA5TjcwNDM1ODE8L1ZJTj4KPE1BUktBPtBLT0RBPC9NQVJLQT4KPE1PREVMSVM+U1VQRVJCPC9NT0RFTElTPgo8R0FEUz4yMDIyPC9HQURTPgo8REVHVklFTEE+RO56Ze9kZWd2aWVsYTwvREVHVklFTEE+CjxKQVVEQT4xMTA8L0pBVURBPgo8RUxFS1RST19KQVVEQT48L0VMRUtUUk9fSkFVREE+CjxFTEVLVFJPX0pBVURBMj48L0VMRUtUUk9fSkFVREEyPgo8VElMUFVNUz4xOTY4PC9USUxQVU1TPgo8UkVHMT4yMjA4MjAyMjwvUkVHMT4KPEtSQVNBPlBlbOdrYTwvS1JBU0E+CjxUTF9WRUlEUz5WaWVnbGFpcyBwbGHwbGlldG9qdW1hPC9UTF9WRUlEUz4KPENPQ19LQVRFR09SSUpBPk0xPC9DT0NfS0FURUdPUklKQT4KPENPQ19USVBTPjNUPC9DT0NfVElQUz4KPENPQ19URUhOX0FQU1RfTlVNPmU4KjIwMDcvNDYqMDMxNyoyMDwvQ09DX1RFSE5fQVBTVF9OVU0+CjxDT0NfVkFSSUFOVFM+QUNEVFNCWDAxPC9DT0NfVkFSSUFOVFM+CjxDT0NfVkVSU0lKQT5ORkQ3RkQ3R0MwMDQ0QklTVEMxQjFCPC9DT0NfVkVSU0lKQT4KPFBJTE5BX01BU0E+MjIzNjwvUElMTkFfTUFTQT4KPFBBU01BU0E+MTYxMjwvUEFTTUFTQT4KPFBPTF9CRUlHQVM+MjMwODIwMjc8L1BPTF9CRUlHQVM+CjxUQV9MSURaPjE0MDkyMDI4PC9UQV9MSURaPgo8L1RMX0RBVEk+Cg==";

const REAL_NOT_FOUND_B64 =
  "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iV0lORE9XUy0xMjU3IiA/Pgo8VExfREFUST4KPEVSUk9SPk5BViBBVFJBU1RTPC9FUlJPUj4KPC9UTF9EQVRJPgo=";

function bytesFromBase64(b64: string): ArrayBuffer {
  const bin = Buffer.from(b64, "base64");
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
}

/** CSDD palīdzības dienesta dotais paraugs (līguma 1. pielikums). */
const SAMPLE_XML = `<TL_DATI>
<RN>NG8493</RN>
<VIN>TMBJH9NP9N7043581</VIN>
<MARKA>ŠKODA</MARKA>
<MODELIS>SUPERB</MODELIS>
<GADS>2022</GADS>
<DEGVIELA>Dīzeļdegviela</DEGVIELA>
<JAUDA>110</JAUDA>
<TILPUMS>1968</TILPUMS>
<REG1>22082022</REG1>
<KRASA>Pelēka</KRASA>
<TL_VEIDS>Vieglais plašlietojuma</TL_VEIDS>
<COC_KATEGORIJA>M1</COC_KATEGORIJA>
<COC_TIPS>3T</COC_TIPS>
<COC_TEHN_APST_NUM>e8*2007/46*0317*20</COC_TEHN_APST_NUM>
<COC_VARIANTS>ACDTSBX01</COC_VARIANTS>
<COC_VERSIJA>NFD7FD7GC0044BISTC1B1B</COC_VERSIJA>
<PILNA_MASA>2236</PILNA_MASA>
<PASMASA>1612</PASMASA>
<POL_BEIGAS>23082023</POL_BEIGAS>
<TA_LIDZ>22082024</TA_LIDZ>
</TL_DATI>`;

describe("csddApiDateToIso", () => {
  it("converts the DDMMYYYY form the register uses", () => {
    expect(csddApiDateToIso("22082022")).toBe("2022-08-22");
    expect(csddApiDateToIso("01012026")).toBe("2026-01-01");
  });

  it("treats missing and impossible dates as empty", () => {
    expect(csddApiDateToIso("")).toBe("");
    expect(csddApiDateToIso("00000000")).toBe("");
    expect(csddApiDateToIso("32082022")).toBe("");
    expect(csddApiDateToIso("22132022")).toBe("");
    expect(csddApiDateToIso("2208202")).toBe("");
  });
});

describe("csddXmlTagValue", () => {
  it("reads a tag, CDATA and entities", () => {
    expect(csddXmlTagValue(SAMPLE_XML, "MARKA")).toBe("ŠKODA");
    expect(csddXmlTagValue("<A><![CDATA[BMW & co]]></A>", "A")).toBe("BMW & co");
    expect(csddXmlTagValue("<A>X &amp; Y</A>", "A")).toBe("X & Y");
  });

  it("returns empty for a missing tag", () => {
    expect(csddXmlTagValue(SAMPLE_XML, "NOBRAUKUMS")).toBe("");
  });
});

describe("parseCsddTechDataXml", () => {
  it("reads every field from the CSDD sample", () => {
    const res = parseCsddTechDataXml(SAMPLE_XML);
    expect(res.found).toBe(true);
    if (!res.found) return;
    expect(res.data).toEqual({
      registrationNumber: "NG8493",
      vin: "TMBJH9NP9N7043581",
      make: "ŠKODA",
      model: "SUPERB",
      year: "2022",
      fuel: "Dīzeļdegviela",
      powerKw: "110",
      electricPowerKw: "",
      electricPowerKw2: "",
      displacementCm3: "1968",
      firstRegistrationIso: "2022-08-22",
      color: "Pelēka",
      vehicleKind: "Vieglais plašlietojuma",
      cocCategory: "M1",
      cocType: "3T",
      cocApprovalNumber: "e8*2007/46*0317*20",
      cocVariant: "ACDTSBX01",
      cocVersion: "NFD7FD7GC0044BISTC1B1B",
      grossMassKg: "2236",
      curbMassKg: "1612",
      insuranceEndIso: "2023-08-23",
      inspectionValidUntilIso: "2024-08-22",
    });
    expect(res.message).toContain("ŠKODA SUPERB");
  });

  it("reports an empty or non-vehicle answer", () => {
    expect(parseCsddTechDataXml("")).toEqual({ found: false, message: "CSDD atbilde bija tukša" });
    expect(parseCsddTechDataXml("<HTML>Unauthorized</HTML>").found).toBe(false);
  });

  it("reports a register answer without RN and VIN as not found", () => {
    const res = parseCsddTechDataXml("<TL_DATI><RN></RN><VIN></VIN></TL_DATI>");
    expect(res).toEqual({ found: false, message: "CSDD reģistrā šāds numurs netika atrasts" });
  });

  it("reads the ERROR element the register returns with HTTP 200", () => {
    const res = parseCsddTechDataXml("<TL_DATI>\n<ERROR>NAV ATRASTS</ERROR>\n</TL_DATI>");
    expect(res).toEqual({ found: false, message: "CSDD reģistrā šāds numurs netika atrasts" });
    expect(parseCsddTechDataXml("<TL_DATI><ERROR>PARSNIEDZ LIMITU</ERROR></TL_DATI>").message).toBe(
      "CSDD reģistrs atbildēja: PARSNIEDZ LIMITU",
    );
  });
});

describe("reāla CSDD atbilde (VPN, 2026-10-06)", () => {
  it("decodes windows-1257 and parses the live payload", () => {
    const xml = decodeCsddXmlBody(bytesFromBase64(REAL_RESPONSE_B64), "text/xml; charset=windows-1257");
    expect(xml).toContain("<MARKA>ŠKODA</MARKA>");
    expect(xml).toContain("Dīzeļdegviela");
    expect(xml).toContain("Pelēka");
    expect(xml).toContain("Vieglais plašlietojuma");

    const res = parseCsddTechDataXml(xml);
    expect(res.found).toBe(true);
    if (!res.found) return;
    expect(res.data.make).toBe("ŠKODA");
    expect(res.data.color).toBe("Pelēka");
    expect(res.data.vehicleKind).toBe("Vieglais plašlietojuma");
    expect(res.data.inspectionValidUntilIso).toBe("2028-09-14");
    expect(res.data.insuranceEndIso).toBe("2027-08-23");
  });

  it("falls back to the XML prolog charset when the header has none", () => {
    const xml = decodeCsddXmlBody(bytesFromBase64(REAL_RESPONSE_B64), "text/xml");
    expect(xml).toContain("<MARKA>ŠKODA</MARKA>");
  });

  it("treats the live NAV ATRASTS answer as not found", () => {
    const xml = decodeCsddXmlBody(bytesFromBase64(REAL_NOT_FOUND_B64), "text/xml; charset=windows-1257");
    expect(parseCsddTechDataXml(xml)).toEqual({
      found: false,
      message: "CSDD reģistrā šāds numurs netika atrasts",
    });
  });
});

describe("decodeCsddXmlBody", () => {
  it("decodes UTF-8 by default", () => {
    const buf = new TextEncoder().encode("<MARKA>ŠKODA</MARKA>");
    expect(decodeCsddXmlBody(buf.buffer as ArrayBuffer, null)).toContain("ŠKODA");
  });

  it("decodes the windows-1257 the Oracle gateway may send", () => {
    // Š = 0xD0, Ē = 0xC2 windows-1257 tabulā.
    const bytes = Uint8Array.from([0xd0, 0x4b, 0x4f, 0x44, 0x41]);
    expect(decodeCsddXmlBody(bytes.buffer as ArrayBuffer, "text/xml; charset=windows-1257")).toBe("ŠKODA");
  });
});

describe("csddTechDataLookupPath / buildCsddRelayUrl", () => {
  it("builds the register path for a plate and a VIN", () => {
    expect(csddTechDataLookupPath("ng8493")).toBe("/zvt/plsql/epak.tl_tehn_dati?nr1=NG8493");
    expect(csddTechDataLookupPath("TMBJH9NP9N7043581")).toContain("nr1=TMBJH9NP9N7043581");
  });

  it("appends the path to a relay base and honours {nr1}", () => {
    expect(buildCsddRelayUrl("https://relay.provin.lv/", "NG8493")).toBe(
      "https://relay.provin.lv/zvt/plsql/epak.tl_tehn_dati?nr1=NG8493",
    );
    expect(buildCsddRelayUrl("https://relay.provin.lv/csdd?nr={nr1}", "ng8493")).toBe(
      "https://relay.provin.lv/csdd?nr=NG8493",
    );
  });
});

describe("fetchCsddTechData", () => {
  it("says so when the relay is not configured", async () => {
    const res = await fetchCsddTechData("NG8493", { env: {} });
    expect(res).toEqual({ found: false, message: "CSDD relejs nav konfigurēts" });
  });
});

describe("applyCsddTechDataToBlock", () => {
  const data = (() => {
    const res = parseCsddTechDataXml(SAMPLE_XML);
    if (!res.found) throw new Error("fixture must parse");
    return res.data;
  })();

  it("fills the empty CSDD block fields", () => {
    const next = applyCsddTechDataToBlock(emptyCsddFields(), data);
    expect(next).not.toBeNull();
    expect(next).toMatchObject({
      makeModel: "ŠKODA SUPERB",
      registrationNumber: "NG8493",
      firstRegistration: "2022-08-22",
      nextInspectionDate: "2024-08-22",
      engineDisplacementCm3: "1968",
      enginePowerKw: "110",
      fuelType: "Dīzeļdegviela",
      vehicleType: "Vieglais plašlietojuma (M1)",
      grossMassKg: "2236",
      curbMassKg: "1612",
    });
  });

  it("overwrites RAW/PDF values with the register and keeps the old value as a conflict", () => {
    const current = { ...emptyCsddFields(), makeModel: "Škoda Superb Combi", enginePowerKw: "140" };
    const next = applyCsddTechDataToBlock(current, data);
    expect(next?.makeModel).toBe("ŠKODA SUPERB");
    expect(next?.enginePowerKw).toBe("110");
    expect(next?.fuelType).toBe("Dīzeļdegviela");
    expect(next?.conflicts?.makeModel?.value).toBe("Škoda Superb Combi");
    expect(next?.conflicts?.enginePowerKw?.value).toBe("140");
    expect(next?.registry?.data.vin).toBe("TMBJH9NP9N7043581");
  });

  it("keeps a value the operator deliberately unlocked", () => {
    const current = {
      ...emptyCsddFields(),
      enginePowerKw: "140",
      apiUnlocked: ["enginePowerKw"],
    };
    const next = applyCsddTechDataToBlock(current, data);
    expect(next?.enginePowerKw).toBe("140");
    expect(next?.apiUnlocked).toEqual(["enginePowerKw"]);
  });

  it("fills the 11 register-only fields into the form", () => {
    const next = applyCsddTechDataToBlock(emptyCsddFields(), data);
    expect(next).toMatchObject({
      vin: "TMBJH9NP9N7043581",
      modelYear: "2022",
      color: "Pelēka",
      electricPowerKw: "",
      electricPowerKw2: "",
      cocCategory: "M1",
      cocType: "3T",
      cocApprovalNumber: "e8*2007/46*0317*20",
      cocVariant: "ACDTSBX01",
      cocVersion: "NFD7FD7GC0044BISTC1B1B",
      insuranceValidUntil: "2023-08-23",
    });
  });

  it("keeps COC variant, colour and OCTA date in the AI context", () => {
    const next = applyCsddTechDataToBlock(emptyCsddFields(), data);
    expect(next?.aiContextRaw).toContain("Variants: ACDTSBX01");
    expect(next?.aiContextRaw).toContain("Versija: NFD7FD7GC0044BISTC1B1B");
    expect(next?.aiContextRaw).toContain("Krāsa: Pelēka");
    expect(next?.aiContextRaw).toContain("OCTA polise derīga līdz: 2023-08-23");
  });

  it("appends after existing AI context and stays idempotent", () => {
    const first = applyCsddTechDataToBlock({ ...emptyCsddFields(), aiContextRaw: "Operatora piezīme" }, data);
    expect(first?.aiContextRaw.startsWith("Operatora piezīme")).toBe(true);
    expect(applyCsddTechDataToBlock(first!, data)).toBeNull();
  });
});

describe("csddTechSeedNeeded", () => {
  const data = (() => {
    const res = parseCsddTechDataXml(SAMPLE_XML);
    if (!res.found) throw new Error("fixture must parse");
    return res.data;
  })();

  it("is true for an untouched block", () => {
    expect(csddTechSeedNeeded(emptyCsddFields())).toBe(true);
  });

  it("is true when the operator filled only part of the block", () => {
    expect(csddTechSeedNeeded({ ...emptyCsddFields(), makeModel: "Škoda Superb" })).toBe(true);
  });

  it("is false once the register already filled the block, so the quota is not spent twice", () => {
    const filled = applyCsddTechDataToBlock(emptyCsddFields(), data);
    expect(filled).not.toBeNull();
    expect(csddTechSeedNeeded(filled!)).toBe(false);
  });
});

describe("csddTechLookupNr1", () => {
  it("prefers the plate already in the CSDD block", () => {
    expect(csddTechLookupNr1("NG8493", "TMBJH9NP9N7043581")).toBe("NG8493");
    expect(csddTechLookupNr1("ng-8493", "")).toBe("NG8493");
  });

  it("falls back to the order VIN or plate", () => {
    expect(csddTechLookupNr1("", "TMBJH9NP9N7043581")).toBe("TMBJH9NP9N7043581");
    expect(csddTechLookupNr1("  ", "ng8493")).toBe("NG8493");
  });

  it("returns empty when neither is a VIN or plate", () => {
    expect(csddTechLookupNr1("", "")).toBe("");
    expect(csddTechLookupNr1("ab", "xy")).toBe("");
  });
});

describe("csddVinMatchesOrder", () => {
  it("compares VIN codes and ignores plates", () => {
    expect(csddVinMatchesOrder("TMBJH9NP9N7043581", "tmbjh9np9n7043581")).toBe(true);
    expect(csddVinMatchesOrder("TMBJH9NP9N7043581", "WAUZZZ4L98D010101")).toBe(false);
    expect(csddVinMatchesOrder("TMBJH9NP9N7043581", "NG8493")).toBeNull();
    expect(csddVinMatchesOrder("", "TMBJH9NP9N7043581")).toBeNull();
  });
});
