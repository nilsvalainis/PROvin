import { describe, expect, it } from "vitest";

import type { ClientReportPayload } from "@/lib/client-report-html";
import {
  applyClientReportTranslatedTexts,
  collectClientReportTranslatableTexts,
  hashTranslatableTexts,
} from "@/lib/client-report-translatable-fields";

function basePayload(overrides: Partial<ClientReportPayload> = {}): ClientReportPayload {
  return {
    sessionId: "sess_1",
    isDemo: false,
    vin: "WVWZZZ1KZAW000000",
    created: 0,
    amountTotal: null,
    currency: null,
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: null,
    contactMethod: null,
    notes: null,
    csdd: "",
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    ...overrides,
  } as ClientReportPayload;
}

describe("collectClientReportTranslatableTexts", () => {
  it("collects only non-empty top-level free-text fields", () => {
    const payload = basePayload({
      tehniskoRiskuAnalize: "Auto ir bijis negadījumā.",
      apskatesPlāns: "",
      cenasAtbilstiba: "Cena atbilst tirgum.",
    });
    const texts = collectClientReportTranslatableTexts(payload);
    expect(texts["main.tehniskoRiskuAnalize"]).toBe("Auto ir bijis negadījumā.");
    expect(texts["main.cenasAtbilstiba"]).toBe("Cena atbilst tirgum.");
    expect(texts["main.apskatesPlāns"]).toBeUndefined();
  });

  it("collects vendor block comments by index and skips empty optional fields", () => {
    const payload = basePayload({
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [],
          incidentRows: [],
          comments: "Servisa vēsture pilnīga.",
          ownersSummary: "2 īpašnieki",
        },
      ],
    });
    const texts = collectClientReportTranslatableTexts(payload);
    expect(texts["vendor.0.comments"]).toBe("Servisa vēsture pilnīga.");
    expect(texts["vendor.0.ownersSummary"]).toBe("2 īpašnieki");
    expect(texts["vendor.0.statusRecords"]).toBeUndefined();
  });

  it("collects citi avoti section comments and listing analysis text", () => {
    const payload = basePayload({
      citiAvoti: { sections: [{ ...emptyVendorSection(), comments: "Papildu piezīme." }] },
      listingAnalysis: {
        sellerPortrait: "Privātpersona.",
        photoAnalysis: "",
        photos: [],
        photoGroups: [],
        extraSellerName: "",
        listingPasteRaw: "",
        listingSalesContext: "Pārdod steidzami.",
        aiContextRaw: "",
      },
    });
    const texts = collectClientReportTranslatableTexts(payload);
    expect(texts["citiAvoti.0.comments"]).toBe("Papildu piezīme.");
    expect(texts["listingAnalysis.sellerPortrait"]).toBe("Privātpersona.");
    expect(texts["listingAnalysis.listingSalesContext"]).toBe("Pārdod steidzami.");
    expect(texts["listingAnalysis.photoAnalysis"]).toBeUndefined();
  });
});

describe("applyClientReportTranslatedTexts", () => {
  it("replaces only the fields present in the translated map, keeping the rest of the payload intact", () => {
    const payload = basePayload({
      tehniskoRiskuAnalize: "Auto ir bijis negadījumā.",
      cenasAtbilstiba: "Cena atbilst tirgum.",
      vin: "WVWZZZ1KZAW000000",
    });
    const out = applyClientReportTranslatedTexts(payload, {
      "main.tehniskoRiskuAnalize": "The car has been in an accident.",
    });
    expect(out.tehniskoRiskuAnalize).toBe("The car has been in an accident.");
    expect(out.cenasAtbilstiba).toBe("Cena atbilst tirgum.");
    expect(out.vin).toBe("WVWZZZ1KZAW000000");
  });

  it("falls back to the original text when a key is missing from the translation map", () => {
    const payload = basePayload({ tehniskoRiskuAnalize: "Oriģinālais teksts." });
    const out = applyClientReportTranslatedTexts(payload, {});
    expect(out.tehniskoRiskuAnalize).toBe("Oriģinālais teksts.");
  });

  it("does not mutate the original payload object", () => {
    const payload = basePayload({ tehniskoRiskuAnalize: "Oriģināls." });
    applyClientReportTranslatedTexts(payload, { "main.tehniskoRiskuAnalize": "Translated." });
    expect(payload.tehniskoRiskuAnalize).toBe("Oriģināls.");
  });
});

describe("hashTranslatableTexts", () => {
  it("is stable for the same content regardless of key insertion order", () => {
    const a = hashTranslatableTexts({ a: "1", b: "2" });
    const b = hashTranslatableTexts({ b: "2", a: "1" });
    expect(a).toBe(b);
  });

  it("changes when any value changes", () => {
    const a = hashTranslatableTexts({ a: "1" });
    const b = hashTranslatableTexts({ a: "2" });
    expect(a).not.toBe(b);
  });
});

function emptyVendorSection() {
  return {
    serviceHistory: [],
    incidents: [],
    comments: "",
    aiContextRaw: "",
    photos: [],
    photoGroups: [],
  };
}
