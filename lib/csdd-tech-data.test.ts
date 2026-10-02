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
import { applyCsddTechDataToBlock, csddVinMatchesOrder } from "@/lib/csdd-tech-data-apply";
import { emptyCsddFields } from "@/lib/admin-source-blocks";

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
      grossMassKg: "2236",
      curbMassKg: "1612",
    });
  });

  it("never overwrites what the operator already typed", () => {
    const current = { ...emptyCsddFields(), makeModel: "Škoda Superb Combi", enginePowerKw: "140" };
    const next = applyCsddTechDataToBlock(current, data);
    expect(next?.makeModel).toBe("Škoda Superb Combi");
    expect(next?.enginePowerKw).toBe("140");
    expect(next?.fuelType).toBe("Dīzeļdegviela");
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

describe("csddVinMatchesOrder", () => {
  it("compares VIN codes and ignores plates", () => {
    expect(csddVinMatchesOrder("TMBJH9NP9N7043581", "tmbjh9np9n7043581")).toBe(true);
    expect(csddVinMatchesOrder("TMBJH9NP9N7043581", "WAUZZZ4L98D010101")).toBe(false);
    expect(csddVinMatchesOrder("TMBJH9NP9N7043581", "NG8493")).toBeNull();
    expect(csddVinMatchesOrder("", "TMBJH9NP9N7043581")).toBeNull();
  });
});
