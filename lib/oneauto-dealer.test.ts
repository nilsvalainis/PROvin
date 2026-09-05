import { describe, expect, it } from "vitest";
import { emptyOneautoBlock, parseOneautoBlockRaw } from "@/lib/oneauto-block";
import {
  applyOneautoTranslatedDisplay,
  applyOneautoTranslatedWorks,
  OFFICIAL_DEALER_SECTION_TITLE,
  oneautoDisplayToServiceWorks,
  oneautoWorksNeedLvTranslation,
  parseOneautoWorksTranslatePayload,
} from "@/lib/oneauto-dealer";
import { oneautoBlockToPlainText } from "@/lib/oneauto-block";

describe("OneAuto → oficiālā dīlera forma", () => {
  it("kartē laika skalu uz servisa darbu rindām ar LV datumu", () => {
    const rows = oneautoDisplayToServiceWorks({
      equipment: [],
      powertrain: [],
      serviceTimeline: [
        {
          date: "2020-12-23",
          odometer: "142220",
          place: "Volvo Partner",
          works: "End fitting 2 sides install acc.; Actie uitgevoerd.",
        },
      ],
    });
    expect(rows[0]).toMatchObject({
      date: "23.12.2020",
      odometer: "142220",
      location: "Volvo Partner",
    });
    expect(rows[0]?.works).toContain("End fitting");
    expect(rows[0]?.works).toContain("Actie uitgevoerd");
  });

  it("plain text aģentiem ir OFICIĀLĀ DĪLERA DATI ar eļļas un servisa laukiem", () => {
    const parsed = parseOneautoBlockRaw({
      lastFetchedVin: "YV1DZ31A1F2705364",
      display: {
        powertrain: [{ label: "Engine", value: "D4204T14" }],
        equipment: [{ label: "Panoramic roof", value: "Yes" }],
        serviceTimeline: [
          { date: "2020-12-23", odometer: "142220", place: "", works: "Oil service" },
        ],
      },
      serviceHistoryNotes: "23.12.2020 | 142220 km | eļļas maiņa",
      oilChangeIntervalNotes: "Intervāls ~40 000 km.",
    });
    const plain = oneautoBlockToPlainText(parsed);
    expect(plain).toContain(OFFICIAL_DEALER_SECTION_TITLE);
    expect(plain).toContain("D4204T14");
    expect(plain).toContain("142220");
    expect(plain).toContain("eļļas maiņa");
    expect(plain).toContain("Intervāls ~40 000 km.");
    expect(parsed.display.serviceTimeline[0]?.date).toBe("23.12.2020");
  });

  it("tulkojums saglabā datumus un km, aizstāj darbus", () => {
    const current = {
      equipment: [{ label: "Panoramic roof", value: "Yes" }],
      powertrain: [{ label: "Engine", value: "D4204T14" }],
      serviceTimeline: [
        { date: "23.12.2020", odometer: "142220", place: "Dealer NL", works: "Oil service" },
      ],
    };
    const next = applyOneautoTranslatedDisplay(current, {
      equipment: [{ label: "Panorāmas jumts", value: "Jā" }],
      powertrain: [{ label: "Dzinējs", value: "D4204T14" }],
      serviceTimeline: [
        { date: "01.01.1999", odometer: "1", place: "Dīleris NL", works: "Eļļas maiņa" },
      ],
    });
    expect(next.equipment[0]).toEqual({ label: "Panorāmas jumts", value: "Jā" });
    expect(next.serviceTimeline[0]).toMatchObject({
      date: "23.12.2020",
      odometer: "142220",
      place: "Dīleris NL",
      works: "Eļļas maiņa",
    });
  });

  it("atpazīst, ka Darbi vēl jāpārtulko, un latvisko jau gatavo tekstu neskār", () => {
    expect(oneautoWorksNeedLvTranslation("End fitting 2 sides install acc.; Actie uitgevoerd.")).toBe(
      true,
    );
    expect(oneautoWorksNeedLvTranslation("ECM software download acc. to QB.")).toBe(true);
    expect(oneautoWorksNeedLvTranslation("Eļļas maiņa, salona filtrs")).toBe(false);
    expect(oneautoWorksNeedLvTranslation("PBM jauninājums")).toBe(false);
    expect(oneautoWorksNeedLvTranslation("Warranty inspection.")).toBe(true);
    expect(oneautoWorksNeedLvTranslation("")).toBe(false);
  });

  it("ielādes tulkojums aizstāj tikai darbus, ne datumus", () => {
    const next = applyOneautoTranslatedWorks(
      {
        equipment: [],
        powertrain: [],
        serviceTimeline: [
          { date: "23.12.2020", odometer: "142220", place: "Volvo", works: "Oil service" },
        ],
      },
      ["Eļļas maiņa"],
    );
    expect(next.serviceTimeline[0]).toMatchObject({
      date: "23.12.2020",
      odometer: "142220",
      place: "Volvo",
      works: "Eļļas maiņa",
    });
    expect(parseOneautoWorksTranslatePayload({ works: ["Eļļas maiņa", "Filtra maiņa"] })).toEqual([
      "Eļļas maiņa",
      "Filtra maiņa",
    ]);
  });

  it("tukšs bloks paliek bez piezīmēm", () => {
    expect(emptyOneautoBlock().serviceHistoryNotes).toBe("");
    expect(emptyOneautoBlock().oilChangeIntervalNotes).toBe("");
  });
});
