import { describe, expect, it } from "vitest";

import { emptyCsddFields, mergeSourceBlocksWithDefaults, type CsddFormFields } from "@/lib/admin-source-blocks";
import { mergeCsddFieldsFillEmpty } from "@/lib/admin-copilot-csdd";
import { buildCsddAvotuZoneHtml } from "@/lib/client-report-html";
import {
  acceptCsddConflictValue,
  csddFieldIsApiLocked,
  csddValuesEquivalent,
  protectCsddApiFields,
  restoreCsddApiValue,
  setCsddFieldManually,
} from "@/lib/csdd-field-lock";
import { buildCsddFieldsFromPdfSources } from "@/lib/csdd-pdf-ingest";
import {
  applyCsddPasteToForm,
  applyCsddPdfImportToForm,
  backfillCsddExtendedFromRaw,
  parseCsddIdentityFromRaw,
  parseCsddPaste,
} from "@/lib/csdd-paste-parse";
import { applyCsddTechDataToBlock } from "@/lib/csdd-tech-data-apply";
import { parseCsddTechDataXml } from "@/lib/csdd-tech-data";

const SAMPLE_XML = `<TL_DATI>
<RN>NG8493</RN>
<VIN>TMBJH9NP9N7043581</VIN>
<MARKA>ŠKODA</MARKA>
<MODELIS>SUPERB</MODELIS>
<GADS>2022</GADS>
<DEGVIELA>Dīzeļdegviela</DEGVIELA>
<JAUDA>110</JAUDA>
<ELEKTRO_JAUDA></ELEKTRO_JAUDA>
<ELEKTRO_JAUDA2></ELEKTRO_JAUDA2>
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
<POL_BEIGAS>23082027</POL_BEIGAS>
<TA_LIDZ>14092028</TA_LIDZ>
</TL_DATI>`;

/** e-CSDD izdrukas formāts (kā HB5743), ar apzināti atšķirīgu masu un marku. */
const RAW_CONFLICTING = `Reģistrācijas dati
Reģistrācijas numurs NG8493
Statuss Uzskaitē
Marka Modelis SKODA SUPERB COMBI
Pilna masa (kg) 2200
Pašmasa (kg) 1612
Degviela Dīzeļdegviela
VIN TMBJH9NP9N7043581
Izlaiduma gads 2022
Iepriekšējās reģistrācijas valsts VĀCIJA
Transportlīdzekļa reģistrācija
No 22/08/2022 2 īpašnieki
22.08.2022 - Pirmā reģistrācija Latvijā
Pēdējā tehniskā apskate
TA datums 31.07.2025
Nākošā TA 31.07.2026
Odometra rādījums 133562
Nobraukuma vēsture
133249 - 31.07.2025
132699 - 09.07.2024
Tehnisko apskašu vēsture
Apskates datums 31.07.2025
Apskates tips pamatpārbaude
Novērtējums 1 - Ar pieļaujamiem defektiem
Kods Novērtējums Trūkumi vai bojājumi
8.4.1. 1 Neveidojot piles, sūcas eļļa no motora (transmisijas).
Informācija sagatavota elektroniski 05.08.2026 12:45:56.`;

function apiData() {
  const res = parseCsddTechDataXml(SAMPLE_XML);
  if (!res.found) throw new Error("fixture must parse");
  return res.data;
}

function withApi(base: CsddFormFields = emptyCsddFields()): CsddFormFields {
  const withAi = { ...base, aiContextRaw: base.aiContextRaw || "Operatora AI piezīme" };
  const next = applyCsddTechDataToBlock(withAi, apiData(), { nr1: "NG8493", now: new Date("2026-10-09T10:00:00Z") });
  if (!next) throw new Error("API must apply");
  return next;
}

describe("CSDD API registry snapshot", () => {
  it("stores the full API response with nr1 and fetch time", () => {
    const f = withApi();
    expect(f.registry?.nr1).toBe("NG8493");
    expect(f.registry?.fetchedAt).toBe("2026-10-09T10:00:00.000Z");
    expect(f.registry?.data.cocVersion).toBe("NFD7FD7GC0044BISTC1B1B");
  });

  it("survives saving and loading the workspace", () => {
    const f = { ...withApi(), conflicts: { grossMassKg: { value: "2200", source: "pdf" as const } } };
    const loaded = mergeSourceBlocksWithDefaults(JSON.parse(JSON.stringify({ csdd: f }))).csdd;
    expect(loaded.registry?.data.vin).toBe("TMBJH9NP9N7043581");
    expect(loaded.conflicts?.grossMassKg).toEqual({ value: "2200", source: "pdf" });
    expect(loaded.vin).toBe("TMBJH9NP9N7043581");
    expect(loaded.insuranceValidUntil).toBe("2027-08-23");
    expect(loaded.cocApprovalNumber).toBe("e8*2007/46*0317*20");
  });
});

describe("RAW paste after API", () => {
  it("keeps API values, records conflicts and keeps the AI context", () => {
    const api = withApi();
    const next = applyCsddPasteToForm(api, RAW_CONFLICTING, parseCsddPaste(RAW_CONFLICTING));
    expect(next.makeModel).toBe("ŠKODA SUPERB");
    expect(next.grossMassKg).toBe("2236");
    expect(next.nextInspectionDate).toBe("2028-09-14");
    expect(next.conflicts?.makeModel).toEqual({ value: "SKODA SUPERB COMBI", source: "raw" });
    expect(next.conflicts?.grossMassKg).toEqual({ value: "2200", source: "raw" });
    expect(next.conflicts?.curbMassKg).toBeUndefined();
    expect(next.aiContextRaw).toContain("Operatora AI piezīme");
    expect(next.aiContextRaw).toContain("CSDD reģistra tehniskie dati (API)");
    expect(next.registry).toEqual(api.registry);
    // Lauki, kurus API nedod, nāk no RAW.
    expect(next.registrationStatus).toBe("Uzskaitē");
    expect(next.previousRegistrationCountry).toBeTruthy();
    expect(next.mileageHistory.length).toBeGreaterThan(0);
  });

  it("does not wipe filled fields when the paste lacks them", () => {
    const api = { ...withApi(), roadTaxEur: "150", pdfChecklist: { ok: true } as never, hidePhotoWatermarks: true };
    const next = applyCsddPasteToForm(api, "Reģistrācijas numurs NG8493", parseCsddPaste("Reģistrācijas numurs NG8493"));
    expect(next.roadTaxEur).toBe("150");
    expect(next.vehicleType).toBe("Vieglais plašlietojuma (M1)");
    expect(next.color).toBe("Pelēka");
    expect(next.hidePhotoWatermarks).toBe(true);
    expect(next.pdfChecklist).toEqual({ ok: true });
  });

  it("without API behaves like before: RAW fills the form", () => {
    const next = applyCsddPasteToForm(emptyCsddFields(), RAW_CONFLICTING, parseCsddPaste(RAW_CONFLICTING));
    expect(next.grossMassKg).toBe("2200");
    expect(next.conflicts).toBeUndefined();
    expect(next.registry).toBeUndefined();
  });
});

describe("PDF import after API", () => {
  it("keeps API values, marks conflicts as PDF and keeps operator fields", () => {
    const api = { ...withApi(), comments: "Eksperta komentārs" };
    const { fields, rawUnprocessedData } = buildCsddFieldsFromPdfSources({ textHint: RAW_CONFLICTING, aiRaw: "" });
    const next = applyCsddPdfImportToForm(api, fields, rawUnprocessedData);
    expect(next.makeModel).toBe("ŠKODA SUPERB");
    expect(next.grossMassKg).toBe("2236");
    expect(next.conflicts?.grossMassKg?.source).toBe("pdf");
    expect(next.comments).toBe("Eksperta komentārs");
    expect(next.aiContextRaw).toContain("Operatora AI piezīme");
    expect(next.technicalInspectionHistory.length).toBeGreaterThan(0);
  });

  it("Copilot PDF merge keeps API values too", () => {
    const api = withApi();
    const { fields } = buildCsddFieldsFromPdfSources({ textHint: RAW_CONFLICTING, aiRaw: "" });
    const next = mergeCsddFieldsFillEmpty(api, fields, RAW_CONFLICTING);
    expect(next.grossMassKg).toBe("2236");
    expect(next.conflicts?.grossMassKg?.value).toBe("2200");
  });
});

describe("conflict actions", () => {
  const conflicted = () =>
    applyCsddPasteToForm(withApi(), RAW_CONFLICTING, parseCsddPaste(RAW_CONFLICTING));

  it("Pieņemt PDF vērtību unlocks the field and later RAW keeps it", () => {
    const accepted = acceptCsddConflictValue(conflicted(), "grossMassKg");
    expect(accepted.grossMassKg).toBe("2200");
    expect(accepted.conflicts?.grossMassKg).toBeUndefined();
    expect(csddFieldIsApiLocked(accepted, "grossMassKg")).toBe(false);
    const again = applyCsddPasteToForm(accepted, RAW_CONFLICTING, parseCsddPaste(RAW_CONFLICTING));
    expect(again.grossMassKg).toBe("2200");
  });

  it("Atjaunot API locks the field again", () => {
    const restored = restoreCsddApiValue(acceptCsddConflictValue(conflicted(), "grossMassKg"), "grossMassKg");
    expect(restored.grossMassKg).toBe("2236");
    expect(csddFieldIsApiLocked(restored, "grossMassKg")).toBe(true);
  });

  it("typing into a locked field unlocks it; typing the API value re-locks it", () => {
    const typed = setCsddFieldManually(withApi(), "enginePowerKw", "120");
    expect(typed.apiUnlocked).toContain("enginePowerKw");
    const back = setCsddFieldManually(typed, "enginePowerKw", "110");
    expect(back.apiUnlocked ?? []).not.toContain("enginePowerKw");
  });

  it("an API re-read overwrites RAW values but not unlocked ones", () => {
    const raw = applyCsddPasteToForm(emptyCsddFields(), RAW_CONFLICTING, parseCsddPaste(RAW_CONFLICTING));
    const unlocked = { ...raw, apiUnlocked: ["curbMassKg"], curbMassKg: "1600" };
    const next = applyCsddTechDataToBlock(unlocked, apiData())!;
    expect(next.grossMassKg).toBe("2236");
    expect(next.conflicts?.grossMassKg?.value).toBe("2200");
    expect(next.curbMassKg).toBe("1600");
  });
});

describe("protectCsddApiFields", () => {
  it("is a no-op without a registry snapshot", () => {
    const f = { ...emptyCsddFields(), makeModel: "X" };
    expect(protectCsddApiFields(emptyCsddFields(), f, "raw")).toBe(f);
  });

  it("treats vehicle type without the COC suffix as the same value", () => {
    expect(csddValuesEquivalent("Vieglais plašlietojuma", "Vieglais plašlietojuma (M1)", "vehicleType")).toBe(true);
    expect(csddValuesEquivalent("Škoda Superb", "Škoda Superb Combi", "makeModel")).toBe(false);
    expect(csddValuesEquivalent("14.09.2028", "2028-09-14", "nextInspectionDate")).toBe(true);
  });
});

describe("VIN / year / colour from RAW and PDF", () => {
  it("parses e-CSDD print lines", () => {
    expect(parseCsddIdentityFromRaw(RAW_CONFLICTING)).toEqual({
      vin: "TMBJH9NP9N7043581",
      modelYear: "2022",
      color: "",
    });
    expect(parseCsddIdentityFromRaw("VIN kods: wvwzzz3hzhe703058").vin).toBe("WVWZZZ3HZHE703058");
    expect(parseCsddIdentityFromRaw("VIN: WVWZZZ3HZHE703058\nKrāsa: Melna\nIzlaiduma gads: 2017")).toEqual({
      vin: "WVWZZZ3HZHE703058",
      modelYear: "2017",
      color: "Melna",
    });
  });

  it("fills VIN and year from a paste without API", () => {
    const next = applyCsddPasteToForm(emptyCsddFields(), RAW_CONFLICTING, parseCsddPaste(RAW_CONFLICTING));
    expect(next.vin).toBe("TMBJH9NP9N7043581");
    expect(next.modelYear).toBe("2022");
  });

  it("backfill fills VIN from stored RAW", () => {
    const next = backfillCsddExtendedFromRaw({ ...emptyCsddFields(), rawUnprocessedData: RAW_CONFLICTING });
    expect(next.vin).toBe("TMBJH9NP9N7043581");
  });
});

describe("client PDF", () => {
  it("prints the new register fields", () => {
    const html = buildCsddAvotuZoneHtml(withApi(), "", undefined, { orderVin: "TMBJH9NP9N7043581" });
    expect(html).toContain("TMBJH9NP9N7043581");
    expect(html).toContain("Tipa apstiprinājuma numurs");
    expect(html).toContain("ACDTSBX01");
    expect(html).toContain("OCTA polise derīga līdz");
    expect(html).not.toContain("nesakrīt ar pasūtījuma VIN");
  });

  it("warns about a VIN mismatch with the order", () => {
    const html = buildCsddAvotuZoneHtml(withApi(), "", undefined, { orderVin: "WVWZZZ3HZHE703058" });
    expect(html).toContain("nesakrīt ar pasūtījuma VIN WVWZZZ3HZHE703058");
    expect(html).toContain("pdf-csdd-alert--red");
  });

  it("warns when OCTA has expired", () => {
    const f = { ...withApi(), insuranceValidUntil: "2020-01-01" };
    const html = buildCsddAvotuZoneHtml(f, "", undefined, {});
    expect(html).toContain("polise beigusies");
  });
});
