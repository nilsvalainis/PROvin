import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { CLIENT_REPORT_LANGS } from "@/lib/client-report-i18n";
import {
  DEALER_SIGNAL_DEFAULT_TEXTS,
  DEALER_SIGNAL_TITLES,
  addManualDealerSignal,
  dealerSignalDefaultTone,
  dealerSignalsPdfRows,
  isDealerSignalTextAllowed,
  regenerateDealerSignals,
} from "@/lib/dealer-signals";
import {
  detectDealerSignals,
  hasArchivePhotoSignal,
  hasExtraHistorySignal,
  hasPreviewIncidentSignal,
} from "@/lib/dealer-signals-detect";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

/**
 * «Signāli» no maksas atskaišu bezmaksas priekšskatiem (Nils 27.11): AutoDNA arhīva foto un vēsture,
 * CheckCar.vin foto, CARFAX.eu ieraksti. Anonimizēta pasūtījuma forma (dīlera dati, signālu bloks bija tukšs).
 */
const AUTODNA_FOUND: VinScanIndicator = {
  id: "autodna_precheck",
  label: "AutoDNA (priekšskatījums)",
  country: "EU",
  status: "found",
  summary: "AutoDNA priekšskatījums: 85 ieraksti · vēsture 7 · arhīva foto 53",
  detail: [
    "Kopā: 85",
    "Auto: BMW iX3",
    "Transportlīdzekļa tehniskie dati: ir · 9",
    "Transportlīdzekļa vēsture: ir · 7",
    "Auto arhīva fotogrāfijas: ir · 53",
    "Auto zādzības pārbaude: ir · 14/14",
    "Aprīkojums: nav · 0",
    "Ražotāju atsaukumi: nav · 0",
    "VIN koda pārbaude: ir",
  ].join("\n"),
  openUrl: null,
};

function autodna(lines: string[], status: VinScanIndicator["status"] = "found"): VinScanIndicator {
  return { ...AUTODNA_FOUND, status, detail: lines.join("\n") };
}

const CARFAX_FOUND: VinScanIndicator = {
  id: "carfax_eu",
  label: "CARFAX.eu",
  country: "EU",
  status: "found",
  summary: "12 ieraksti CARFAX priekšskatījumā (SE 10, DE 2)",
  detail: "Ieraksti: 12\nValstis: SE 10, DE 2\nNobraukuma rādījumi: 4\nTehniskās apskates: 2",
  openUrl: null,
};

const CHECKCAR_FOUND: VinScanIndicator = {
  id: "checkcar_vin",
  label: "CheckCar.vin",
  country: "US",
  status: "found",
  summary: "14 foto",
  detail: "",
  openUrl: null,
};

const empty = () => mergeSourceBlocksWithDefaults({});
const detect = (indicators: VinScanIndicator[]) => detectDealerSignals({ sourceBlocks: empty(), sourceIssues: [], vinScan: { indicators } });

describe("maksas priekšskati -> signāli", () => {
  it("AutoDNA ar arhīva foto un vēsturi (pasūtījuma forma) -> arhīva foto + papildu vēsture", () => {
    expect(detect([AUTODNA_FOUND])).toEqual(["archive_photos", "extra_history"]);
  });

  it("tikai arhīva foto / tikai vēsture", () => {
    expect(detect([autodna(["Kopā: 5", "Transportlīdzekļa vēsture: nav · 0", "Auto arhīva fotogrāfijas: ir · 5"])])).toEqual(["archive_photos"]);
    expect(detect([autodna(["Kopā: 3", "Transportlīdzekļa vēsture: ir · 3", "Auto arhīva fotogrāfijas: nav · 0"])])).toEqual(["extra_history"]);
  });

  it("AutoDNA bez ierakstiem, tikai tehniskie dati / zādzības pārbaude -> nekas", () => {
    const none = autodna(
      ["Kopā: 23", "Transportlīdzekļa tehniskie dati: ir · 9", "Transportlīdzekļa vēsture: nav · 0", "Auto arhīva fotogrāfijas: nav · 0", "Auto zādzības pārbaude: ir · 14/14"],
      "none",
    );
    expect(detect([none])).toEqual([]);
  });

  it("nenolasīts priekšskats (gaida pārlūku / kļūda) netiek skaitīts", () => {
    expect(detect([{ ...AUTODNA_FOUND, status: "browser_only" }])).toEqual([]);
    expect(detect([{ ...AUTODNA_FOUND, status: "unknown" }])).toEqual([]);
    expect(detect([{ ...CARFAX_FOUND, status: "browser_only" }, { ...CHECKCAR_FOUND, status: "none", summary: "Atskaitē nav foto" }])).toEqual([]);
  });

  it("CheckCar.vin foto -> arhīva foto; bez skaita -> nē", () => {
    expect(hasArchivePhotoSignal({ vinScan: { indicators: [CHECKCAR_FOUND] } })).toBe(true);
    expect(hasArchivePhotoSignal({ vinScan: { indicators: [{ ...CHECKCAR_FOUND, summary: "Atskaite ir" }] } })).toBe(false);
  });

  it("CARFAX.eu ieraksti -> papildu vēsture; «ierakstu nav» -> nē", () => {
    expect(hasExtraHistorySignal({ vinScan: { indicators: [CARFAX_FOUND] } })).toBe(true);
    expect(
      hasExtraHistorySignal({ vinScan: { indicators: [{ ...CARFAX_FOUND, status: "none", summary: "CARFAX priekšskatījumā ierakstu nav", detail: "" }] } }),
    ).toBe(false);
    // Viens ieraksts bez nobraukuma / apskatēm (tikai reģistrācija) - nē.
    const one = { ...CARFAX_FOUND, summary: "1 ieraksts CARFAX priekšskatījumā (EU 1)", detail: "Ieraksti: 1\nValstis: EU 1" };
    expect(hasExtraHistorySignal({ vinScan: { indicators: [one] } })).toBe(false);
    expect(hasExtraHistorySignal({ vinScan: { indicators: [{ ...one, detail: "Ieraksti: 1\nNobraukuma rādījumi: 1" }] } })).toBe(true);
  });

  it("priekšskata bojājumu sadaļa ar ierakstiem -> esošais «Negadījumi»", () => {
    const dmg = autodna(["Kopā: 2", "Bojājumi: ir · 2", "Transportlīdzekļa vēsture: nav · 0", "Auto arhīva fotogrāfijas: nav · 0"]);
    expect(hasPreviewIncidentSignal({ vinScan: { indicators: [dmg] } })).toBe(true);
    expect(detect([dmg])).toEqual(["incidents"]);
    expect(hasPreviewIncidentSignal({ vinScan: { indicators: [AUTODNA_FOUND] } })).toBe(false);
  });

  it("izsoļu foto + arhīva foto -> viena rinda «Arhīva fotogrāfijas»", () => {
    const bid: VinScanIndicator = {
      id: "bid_cars",
      label: "bid.cars",
      country: "US",
      status: "found",
      summary: "1 izsole",
      detail: "",
      openUrl: null,
      auctions: [{ title: "Sold", date: "2022-11-04", venue: "IAAI", photoCount: 10 }],
    };
    expect(detect([bid])).toContain("auction_photos");
    const kinds = detect([bid, AUTODNA_FOUND]);
    expect(kinds).toContain("archive_photos");
    expect(kinds).not.toContain("auction_photos");
  });

  it("manuāls «Izsoļu fotogrāfijas» + atrastais arhīva foto -> bez dublēšanās", () => {
    const st = addManualDealerSignal({ enabled: true, items: [] }, "auction_photos");
    const next = regenerateDealerSignals(st, ["archive_photos", "extra_history"]);
    expect(next.items.map((i) => i.kind)).toEqual(["auction_photos", "extra_history"]);
    // Abi manuāli - paliek admina izvēle.
    const both = addManualDealerSignal(st, "archive_photos");
    expect(regenerateDealerSignals(both, []).items.map((i) => i.kind)).toEqual(["auction_photos", "archive_photos"]);
  });
});

describe("jaunie tipi: teksti un krāsas", () => {
  it("visās valodās, bez cipariem un avotu nosaukumiem", () => {
    for (const kind of ["archive_photos", "extra_history"] as const) {
      for (const lang of CLIENT_REPORT_LANGS) {
        expect(DEALER_SIGNAL_TITLES[kind][lang]).toBeTruthy();
        expect(isDealerSignalTextAllowed(DEALER_SIGNAL_DEFAULT_TEXTS[kind][lang])).toBe(true);
        expect(DEALER_SIGNAL_DEFAULT_TEXTS[kind][lang]).not.toMatch(/[–—]/);
      }
    }
    expect(DEALER_SIGNAL_DEFAULT_TEXTS.archive_photos.lv).toBe("Pieejamas vēsturiskas fotogrāfijas (piem. bojājumi, izsoles, sludinājumi)");
    expect(DEALER_SIGNAL_DEFAULT_TEXTS.extra_history.lv).toBe("Citos avotos pieejami papildu vēstures ieraksti");
  });

  it("arhīva foto - oranžs, papildu vēsture - parasts; PDF rindās tā pati krāsa", () => {
    expect(dealerSignalDefaultTone("archive_photos")).toBe("orange");
    expect(dealerSignalDefaultTone("extra_history")).toBe("neutral");
    const rows = dealerSignalsPdfRows(
      { enabled: true, items: [{ kind: "archive_photos", checked: true }, { kind: "extra_history", checked: true }] },
      "de",
    );
    expect(rows.map((r) => [r.kind, r.tone, r.alert])).toEqual([
      ["archive_photos", "orange", false],
      ["extra_history", "neutral", false],
    ]);
    expect(rows[0]!.title).toBe("Archivfotos");
  });
});
