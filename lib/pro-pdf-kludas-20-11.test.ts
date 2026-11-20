/**
 * PRO klienta PDF kļūdas (Dropbox /_PROv pārbaude 20.11.2026): zīmola zīmogs, ārvalstu
 * īpašnieki, reģistrācija Latvijā, valsts maiņa no sludinājuma, mnt.ee termini,
 * CSDD valsts defise, Mac CSS atliekas, personu vārdi.
 */
import { describe, expect, it } from "vitest";
import {
  SOURCE_BLOCK_LABELS,
  createDefaultSourceBlocks,
  emptyCsddFields,
  emptyVinRegistryBlock,
  toPdfManualVendorBlocks,
  type ClientManualVendorBlockPdf,
} from "@/lib/admin-source-blocks";
import {
  adminRichHtmlToPdfSafeHtml,
  adminRichHtmlToPlainText,
  stripIrissBrandStamp,
} from "@/lib/admin-rich-comment-html";
import { computeLatviaRegistrationTenure } from "@/lib/latvia-registration-tenure";
import {
  countVendorOwnershipChangeEvents,
  synthesizeOwnerCountsFromBlocks,
  synthesizeOwnerCountsFromPdfInput,
} from "@/lib/owner-count-synthesis";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";
import { translateTextLv } from "@/lib/vin-sources/translate-lv";
import { stripRegistryPersonNames } from "@/lib/vin-registry-client-text";
import { csddPreviousRegistrationCountryForPdf, stripCsddCountryDashes } from "@/lib/csdd-extended-parse";

describe("1. PROVIN atskaitē nav „Inspected by IRISS”", () => {
  it("noņem zīmogu no teksta beigām un no HTML rindkopas", () => {
    expect(stripIrissBrandStamp("Fakti\nAuto ir labs.\n\nInspected by IRISS")).toBe("Fakti\nAuto ir labs.");
    expect(stripIrissBrandStamp("<p>Fakti</p><p><strong>Inspected by IRISS</strong></p>")).toBe("<p>Fakti</p>");
    expect(stripIrissBrandStamp("Teksts.<br>Approved by IRISS.")).toBe("Teksts.");
  });

  it("nesabojā parastu tekstu ar vārdu IRISS citā nozīmē", () => {
    expect(stripIrissBrandStamp("Fakti par auto.")).toBe("Fakti par auto.");
  });
});

describe("2. Ārvalstu īpašnieki - bez Latvijas perioda CV/AutoDNA maiņām", () => {
  function ownerChange(date: string, country = ""): { date: string; country: string; description: string } {
    return { date, country, description: "Mainītas īpašumtiesības" };
  }

  it("525d: maiņas pēc CSDD pirmās reģistrācijas Latvijā un CV+AutoDNA dublikāti netiek skaitīti", () => {
    const csdd = emptyCsddFields();
    csdd.firstRegistrationLatvia = "2019-05-14";
    csdd.ownerCountLatvia = "3";
    csdd.registrationNumber = "AB1234";
    csdd.ownerRegistrationEvents = [
      { date: "14.05.2019", label: "Pirmā reģistrācija Latvijā" },
      { date: "02.03.2021", label: "Īpašnieka maiņa" },
    ];
    const blocks: ClientManualVendorBlockPdf[] = [
      {
        title: SOURCE_BLOCK_LABELS.carvertical,
        mileageRows: [],
        incidentRows: [],
        comments: "",
        vehicleHistoryTimeline: [
          ownerChange("2014-06", "Vācija"),
          ownerChange("2017-02", "Vācija"),
          ownerChange("2019-05", "Latvija"),
          ownerChange("2021-03"),
          ownerChange("2023-08"),
        ],
      },
      {
        title: SOURCE_BLOCK_LABELS.autodna,
        mileageRows: [],
        incidentRows: [],
        comments: "",
        vehicleHistoryTimeline: [ownerChange("06.2014", "Vācija"), ownerChange("02.2017", "Vācija")],
      },
    ];
    expect(countVendorOwnershipChangeEvents(blocks)).toBe(7);
    expect(countVendorOwnershipChangeEvents(blocks, csdd)).toBe(2);

    const syn = synthesizeOwnerCountsFromPdfInput({ csddForm: csdd, manualVendorBlocks: blocks });
    expect(syn.chosen.latvia?.count).toBe(3);
    expect(syn.chosen.other?.count).toBe(2);
    expect(syn.noteLine).toBe("Latvijā: 3 | ārvalstīs: 2");
  });

  it("tā pati loģika AI kontekstam / faktu lapai (bloki)", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd.firstRegistrationLatvia = "2019-05-14";
    blocks.csdd.registrationNumber = "AB1234";
    blocks.csdd.ownerCountLatvia = "2";
    blocks.carvertical.vehicleHistoryTimeline = [
      { ...ownerChange("2016-01", "Vācija"), includeInPdf: false },
      { ...ownerChange("2020-01"), includeInPdf: false },
      { ...ownerChange("2022-01"), includeInPdf: false },
    ];
    const syn = synthesizeOwnerCountsFromBlocks(blocks);
    expect(syn.chosen.other?.count).toBe(1);
  });
});

describe("3. + 4. Reģistrācija Latvijā - precīzs CSDD datums, nekad no sludinājuma", () => {
  it("Yaris: rāda CSDD „Pirmā reģistrācija Latvijā” (22.08.2023), ne mēneša 1. datumu no CV/AutoDNA", () => {
    const csdd = emptyCsddFields();
    csdd.firstRegistrationLatvia = "2023-08-22";
    csdd.mileageHistory = [{ date: "22.08.2023", odometer: "5", country: "Latvija" }];
    const tenure = computeLatviaRegistrationTenure({
      csddForm: csdd,
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [{ date: "08.2023", odometer: "8", country: "Latvija" }],
          incidentRows: [],
          comments: "",
        },
      ],
      referenceDate: new Date("2023-09-01T12:00:00Z"),
    });
    expect(tenure?.firstDateDisplay).toBe("22.08.2023");
    expect(tenure?.daysRegistered).toBe(10);
  });

  it("Kia: nav CSDD reģistrācijas - sludinājuma / CV „Latvija” rinda neveido „Reģistrācija Latvijā”", () => {
    const csdd = emptyCsddFields();
    csdd.registrationStatus = "Dati nav pieejami";
    const tenure = computeLatviaRegistrationTenure({
      csddForm: csdd,
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [{ date: "01.10.2026", odometer: "61000", country: "Latvija" }],
          incidentRows: [],
          comments: "",
        },
      ],
      referenceDate: new Date("2026-11-12T12:00:00Z"),
    });
    expect(tenure).toBeNull();
  });

  it("Kia: „Francija → Latvija” nerodas, ja Latvija nāk tikai no sludinājuma / CV, bez CSDD", () => {
    const csdd = emptyCsddFields();
    csdd.registrationStatus = "Dati nav pieejami";
    const events = buildVehicleLifecycleEvents({
      csddForm: csdd,
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [
            { date: "10.03.2022", odometer: "30000", country: "Francija" },
            { date: "01.10.2026", odometer: "61000", country: "Latvija" },
          ],
          incidentRows: [],
          comments: "",
        },
      ],
    });
    expect(events.filter((e) => e.kind === "import")).toHaveLength(0);
  });

  it("ar CSDD reģistrāciju Latvijā valsts maiņa paliek", () => {
    const csdd = emptyCsddFields();
    csdd.registrationNumber = "AB1234";
    csdd.mileageHistory = [{ date: "05.11.2026", odometer: "61200", country: "Latvija" }];
    const events = buildVehicleLifecycleEvents({
      csddForm: csdd,
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [{ date: "10.03.2022", odometer: "30000", country: "Francija" }],
          incidentRows: [],
          comments: "",
        },
      ],
    });
    const imports = events.filter((e) => e.kind === "import");
    expect(imports).toHaveLength(1);
    expect(imports[0]!.detail).toBe("Francija → Latvija");
  });
});

describe("5. mnt.ee termini tulkoti", () => {
  it("tulko atsavināšanu, pagaidu izslēgšanu un ekonomisko iznīcināšanu", () => {
    expect(translateTextLv("Võõrandamisest teatamine", "et")).toBe("paziņojums par atsavināšanu");
    expect(translateTextLv("Ajutine registrist kustutamine", "et")).toBe("pagaidu izslēgšana no reģistra");
    expect(translateTextLv("Majanduslikus mõttes hävinenud", "et")).toBe("ekonomiski iznīcināts (norakstīts)");
  });

  it("NFD teksts (o + kombinējošā tilde) arī tiek tulkots", () => {
    expect(translateTextLv("Võõrandamisest teatamine".normalize("NFD"), "et")).toBe("paziņojums par atsavināšanu");
  });
});

describe("6. Liekas defises un Mac CSS atliekas", () => {
  it("CSDD „-LATVIJA” → bez defises; Latvija kā iepriekšējā valsts netiek rādīta", () => {
    expect(stripCsddCountryDashes("-LATVIJA")).toBe("LATVIJA");
    expect(stripCsddCountryDashes("VĀCIJA -")).toBe("VĀCIJA");
    expect(csddPreviousRegistrationCountryForPdf("-LATVIJA")).toBe("");
    expect(csddPreviousRegistrationCountryForPdf("- VĀCIJA")).toBe("VĀCIJA");
  });

  it("noņem „p.p1 {margin…}” un <style> no admin teksta pirms PDF", () => {
    const pasted =
      '<style type="text/css">p.p1 {margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px \'Helvetica Neue\'}</style>' +
      '<p class="p1"><span class="s1">Auto ir apskatīts.</span></p>';
    expect(adminRichHtmlToPdfSafeHtml(pasted)).toBe("Auto ir apskatīts.");
    const asText =
      "p.p1 {margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue'} span.s1 {font-kerning: none}\nAuto ir apskatīts.";
    expect(adminRichHtmlToPlainText(asText)).toBe("Auto ir apskatīts.");
    expect(adminRichHtmlToPdfSafeHtml(asText)).toBe("Auto ir apskatīts.");
  });

  it("parasts teksts ar punktu un iekavām netiek skarts", () => {
    expect(adminRichHtmlToPlainText("Cena 4,50 € (p.s. {nav CSS})")).toBe("Cena 4,50 € (p.s. {nav CSS})");
  });
});

describe("7. Personu vārdi nenonāk PDF", () => {
  it("Traficom un car.info lomas paliek, vārdi pazūd", () => {
    expect(stripRegistryPersonNames("8.11.2021-1.11.2024 Pirmais īpašnieks: Jānis Bērziņš")).toBe(
      "8.11.2021-1.11.2024 Pirmais īpašnieks",
    );
    expect(stripRegistryPersonNames("04.09.2023 īpašnieka maiņa: Anna Svensson")).toBe("04.09.2023 īpašnieka maiņa");
    expect(stripRegistryPersonNames("Pirmais operators (lietotājs): Matti Virtanen")).toBe(
      "Pirmais operators (lietotājs)",
    );
    expect(stripRegistryPersonNames("Īpašnieku skaits Somijā: 3.")).toBe("Īpašnieku skaits Somijā: 3.");
  });

  it("PDF bloki (toPdfManualVendorBlocks) nesatur vārdus, īpašnieku skaits paliek", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.traficom_fi = {
      ...emptyVinRegistryBlock(),
      ownersSummary: "8.11.2021-1.11.2024 Pirmais īpašnieks: Jānis Bērziņš\nĪpašnieku skaits Somijā: 2.",
      timeline: [{ date: "08.11.2021", odometer: "", country: "Somija", event: "Pirmais īpašnieks: Jānis Bērziņš" }],
    };
    const pdf = toPdfManualVendorBlocks(blocks).find((b) => b.title === SOURCE_BLOCK_LABELS.traficom_fi)!;
    expect(JSON.stringify(pdf)).not.toMatch(/Bērziņš/);
    expect(pdf.ownersSummary).toMatch(/Īpašnieku skaits Somijā: 2/);
    const events = buildVehicleLifecycleEvents({ manualVendorBlocks: [pdf] });
    expect(JSON.stringify(events)).not.toMatch(/Bērziņš/);
  });
});
