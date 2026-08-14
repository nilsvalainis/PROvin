import { describe, expect, it } from "vitest";
import { normalizeEcsddPdfText } from "@/lib/csdd-ecsdd-pdf-normalize";
import { buildCsddFieldsFromPdfSources } from "@/lib/csdd-pdf-ingest";
import { previousInspectionBlockHasData } from "@/lib/csdd-extended-parse";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { emptyCsddFields } from "@/lib/admin-source-blocks";

/** e.csdd.lv TCPDF slānis — FORD RANGER ON8848 (1 lpp.). */
const ON8848_TCPDF = `
Reģistrācijas numursON8848
StatussNoņemts no uzskaites
Marka ModelisFORD RANGER
Pilna masa (kg)3270
Pašmasa (kg)2333
DegvielaDīzeļdegviela
VIN6FPPXXMJ2PMR24461
Izlaiduma gads2021
Iepriekšējās reģistrācijas valstsVĀCIJA
Transportlīdzekļa reģistrācija
19.05.2026 - Pirmā reģistrācija Latvijā
Pēdējā tehniskā apskate
TA datums10.06.2026
Nākošā TA17.06.2027
Odometra rādījums181076
Novērtējums0 - Teicamā tehniskā stāvoklī
Nobraukuma vēsture
Nobraukums, datums
181044- 19.05.2026
Tehnisko apskašu vēsture
Apskates datums19.05.2026
Apskates tipspamatpārbaude
Novērtējums2 - Ar mēneša laikā labojamiem defektiem
Atgāzu cietās daļiņas (cm
-3
):2000001
PiezīmesMērījuma vērtība pārsniedz mēriekārtas maksimālo
attēlojamo vērtību ( un gt; 2000000 cm-3).
 Kods Novērtējums Trūkumi vai bojājumi
8.2.2.3.2Cieto daļiņu koncentrācija
dīzeļmotoru atgāzēs pārsniedz
pieļaujamo vērtību.
4.6.1.2Nedeg atpakaļgaitas lukturis
(lukturi).
4.3.1.2Nedeg labais bremžu lukturis.
4.3.2.2Prasībām neatbilstošs S3 kategorijas
bremžu lukturu slēgums.
Informācija sagatavota elektroniski 14.08.2026 19:09:27.
`;

/** e.csdd.lv TCPDF — Mercedes KG982 fragments (salīmēts nobraukums + dūmainība). */
const KG982_TCPDF = `
Reģistrācijas numursKG982
StatussUzskaitē
Marka ModelisMERCEDES BENZ E220
Pilna masa (kg)2360
Pašmasa (kg)1810
DegvielaDīzeļdegviela
Iepriekšējās reģistrācijas valstsVĀCIJA
Transportlīdzekļa reģistrācija
 No 22/01/20163 īpašnieki
22.01.2016 - Pirmā reģistrācija Latvijā
22.02.2016 - Īpašnieka maiņa
20.01.2017 - Īpašnieka maiņa
Pēdējā tehniskā apskate
TA datums30.12.2025
Nākošā TA12.01.2027
Odometra rādījums274726
Novērtējums1 - Ar pieļaujamiem defektiem
Nobraukuma vēsture
Nobraukums, datums
274516- 16.12.2025269950- 04.12.2024269457- 12.11.2024180108- 27.01.20161 / 5
Tehnisko apskašu vēsture
Apskates datums16.12.2025
Apskates tipspamatpārbaude
Novērtējums2 - Ar mēneša laikā labojamiem defektiem
Dūmainības koeficients (m
-1
):0.58
PiezīmesStāvbremzes bremzēšanas efektivitāte pietiekoša.
 Kods Novērtējums Trūkumi vai bojājumi
5.3.4.2Priekšējais tilts. Palielināta
brīvkustība balstiekārtas šarnīrā.
Kreisais augšējais šarnīrs.
3.2.1Redzamību vai izturību būtiski
neietekmējoši stiklojuma bojājumi.
6.2.1.1Virsbūves stiprību un citus
satiksmes dalībniekus neapdraudoši
korozijas bojājumi
Apskates datums04.12.2024
Apskates tipsatkārtota pārbaude
Novērtējums1 - Ar pieļaujamiem defektiem
 Kods Novērtējums Trūkumi vai bojājumi
8.4.1.1Neveidojot piles, sūcas eļļa no
motora (transmisijas).
Apskates datums27.01.2016
Apskates tipspamatpārbaude
Novērtējums2 - Ar mēneša laikā labojamiem defektiem
 Kods Novērtējums Trūkumi vai bojājumi
5032Nepietiekams riepu protektora dziļums.
Informācija sagatavota elektroniski 31.05.2026 11:56:58.
`;

describe("normalizeEcsddPdfText", () => {
  it("unsticks labels, defect codes and superscript units", () => {
    const n = normalizeEcsddPdfText(ON8848_TCPDF);
    expect(n).toContain("Reģistrācijas numurs ON8848");
    expect(n).toContain("Apskates datums 19.05.2026");
    expect(n).toContain("8.2.2.3. 2 Cieto");
    expect(n).toMatch(/Atgāzu cietās daļiņas \(cm-3\):\s*2000001/);
    expect(n).toContain(">");
  });

  it("splits glued mileage pairs", () => {
    const n = normalizeEcsddPdfText(KG982_TCPDF);
    expect(n).toContain("274516- 16.12.2025");
    expect(n).toContain("269950- 04.12.2024");
    expect(n).toMatch(/27\.01\.2016\n/);
  });
});

describe("e.csdd.lv TCPDF → CSDD forma", () => {
  it("ON8848 fills identity, particles, prev inspection defects and last TA", () => {
    const { fields } = buildCsddFieldsFromPdfSources({ textHint: ON8848_TCPDF });
    expect(fields.registrationNumber).toBe("ON8848");
    expect(fields.makeModel).toMatch(/FORD RANGER/i);
    expect(fields.previousRegistrationCountry).toBe("VĀCIJA");
    expect(fields.fuelType).toMatch(/Dīze[lļ]/i);
    expect(fields.grossMassKg).toBe("3270");
    expect(fields.curbMassKg).toBe("2333");
    expect(fields.registrationStatus).toMatch(/Noņemts/i);
    expect(fields.firstRegistration).toBe("2026-05-19");
    expect(fields.nextInspectionDate).toBe("2027-06-17");
    expect(fields.prevInspectionDate).toBe("2026-06-10");
    expect(fields.particulateMatter).toBe("2000001");
    expect(fields.mileageHistory.some((r) => r.odometer === "181044")).toBe(true);
    expect(fields.mileageHistory.some((r) => r.odometer === "181076")).toBe(true);

    expect(previousInspectionBlockHasData(fields.prevInspectionBlock)).toBe(true);
    expect(fields.prevInspectionBlock.inspectionDateText).toBe("19.05.2026");
    expect(fields.prevInspectionBlock.odometer).toBe("181044");
    expect(fields.prevInspectionBlock.ratingLevel).toBe(2);
    const codes = fields.prevInspectionBlock.defects.map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(["8.2.2.3.", "4.6.1.", "4.3.1.", "4.3.2."]));

    const dates = fields.technicalInspectionHistory.map((r) => r.date);
    expect(dates).toEqual(expect.arrayContaining(["10.06.2026", "19.05.2026"]));
    const fail = fields.technicalInspectionHistory.find((r) => r.date === "19.05.2026");
    expect(fail?.defects.length).toBe(4);
  });

  it("KG982 fills owners, smoke opacity, glued mileage and history defects", () => {
    const { fields } = buildCsddFieldsFromPdfSources({ textHint: KG982_TCPDF });
    expect(fields.registrationNumber).toBe("KG982");
    expect(fields.makeModel).toMatch(/MERCEDES/i);
    expect(fields.ownerCountLatvia).toBe("3");
    expect(fields.ownerRegistrationEvents).toHaveLength(3);
    expect(fields.nextInspectionDate).toBe("2027-01-12");
    expect(fields.opacityCoefficient).toMatch(/0\.58/);
    expect(fields.mileageHistory.some((r) => r.odometer === "274516")).toBe(true);
    expect(fields.mileageHistory.some((r) => r.odometer === "269950")).toBe(true);
    expect(fields.mileageHistory.some((r) => r.odometer === "274726")).toBe(true);

    expect(fields.prevInspectionBlock.defects.some((d) => d.code === "5.3.4.")).toBe(true);
    const old = fields.technicalInspectionHistory.find((r) => r.date === "27.01.2016");
    expect(old?.defects.some((d) => d.code === "503")).toBe(true);
  });

  it("raw paste of TCPDF text still fills the form (partial/full raw path)", () => {
    const parsed = parseCsddPaste(ON8848_TCPDF);
    const form = applyCsddPasteToForm(emptyCsddFields(), ON8848_TCPDF, parsed);
    expect(form.registrationNumber).toBe("ON8848");
    expect(form.prevInspectionBlock.defects.length).toBe(4);
    expect(form.rawUnprocessedData).toContain("Reģistrācijas numursON8848");
  });
});
