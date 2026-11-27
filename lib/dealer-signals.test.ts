import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildDealerSignalsSectionHtml } from "@/lib/client-report-html";
import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";
import { buildDealerSendMessage } from "@/lib/dealer-send-message";
import {
  DEALER_SIGNAL_KINDS,
  DEALER_SIGNALS_EMAIL_LINE,
  DEALER_SIGNALS_SECTION_TITLE,
  dealerSignalText,
  dealerSignalsAuditLinkFromOffer,
  dealerSignalsFallbackAuditUrl,
  dealerSignalsPdfRows,
  dealerSignalsSectionOn,
  emptyDealerSignalsState,
  regenerateDealerSignals,
  withDealerSignalsEmailLine,
  type DealerSignalsState,
} from "@/lib/dealer-signals";
import { detectDealerSignals } from "@/lib/dealer-signals-detect";
import { parseDealerSignals } from "@/lib/dealer-signals-persist";
import { checkSourceConsistency } from "@/lib/source-consistency";

/** Dīlera PDF «Signāli ārpus dīlera datiem» (Nils 27.11). Anonimizētas struktūras. */
const NOW = Date.UTC(2026, 10, 27);

function blocks(patch: Record<string, unknown>): WorkspaceSourceBlocks {
  return mergeSourceBlocksWithDefaults(patch as unknown);
}

const work = (date: string, odometer: string) => ({ date, odometer, location: "", works: "Apkope" });

/** Dīleris 2016 216 612 km, reģistrs 2022 189 261 km (#1305 gadījums). */
const MILEAGE_PATCH = {
  auto_records: { serviceWorks: [work("23.03.2016", "216612"), work("27.07.2015", "203689"), work("15.12.2011", "138274")] },
  csdd: {
    makeModel: "BMW 320D",
    registrationNumber: "XX0000",
    firstRegistration: "2008-10-13",
    mileageHistory: [
      { date: "10.10.2026", odometer: "212270", country: "Latvija" },
      { date: "18.10.2022", odometer: "189261", country: "Latvija" },
    ],
  },
};

const INCIDENT_PATCH = { ltab: { rows: [{ incidentNo: "LV", csngDate: "01.02.2020", lossAmount: "1200" }] } };
const photoId = (c: string) => `ih_ph_${c.repeat(24)}`;
const PHOTO_PATCH = { cc_vin: { photos: [{ id: photoId("a") }] } };
const FOREIGN_PATCH = { mnt_ee: { mileage: [{ date: "13.08.2024", odometer: "150000", country: "EE", origin: "" }] } };

function detect(patch: Record<string, unknown>) {
  const b = blocks(patch);
  return detectDealerSignals({ sourceBlocks: b, sourceIssues: checkSourceConsistency({ sourceBlocks: b, nowMs: NOW }) });
}

const ALL_ON: DealerSignalsState = {
  enabled: true,
  items: DEALER_SIGNAL_KINDS.map((kind) => ({ kind, checked: true })),
};

describe("signālu noteikšana", () => {
  it("tukši dati -> nekas", () => {
    expect(detect({})).toEqual([]);
  });

  it("dīleris pret reģistru (#1305) -> nobraukuma nesakritība", () => {
    expect(detect(MILEAGE_PATCH)).toEqual(["mileage_mismatch"]);
  });

  it("noraidīta pretruna (info) netiek skaitīta", () => {
    expect(
      detectDealerSignals({ sourceBlocks: blocks({}), sourceIssues: [{ kind: "dealer_registry_mileage", severity: "info" }] }),
    ).toEqual([]);
    expect(
      detectDealerSignals({ sourceBlocks: blocks({}), sourceIssues: [{ kind: "mileage_drop", severity: "warn" }] }),
    ).toEqual([]);
    expect(
      detectDealerSignals({ sourceBlocks: blocks({}), sourceIssues: [{ kind: "mileage_drop", severity: "critical" }] }),
    ).toEqual(["mileage_mismatch"]);
  });

  it("negadījumi, izsoļu foto, citas valsts reģistrs", () => {
    expect(detect(INCIDENT_PATCH)).toEqual(["incidents"]);
    expect(detect(PHOTO_PATCH)).toEqual(["auction_photos"]);
    expect(detect({ cc_vin: { thecarapiRecords: [{ photoUrls: ["https://x/1.jpg"], photos: [] }] } })).toEqual([
      "auction_photos",
    ]);
    expect(detect(FOREIGN_PATCH)).toEqual(["foreign_registry"]);
    // Tikai valsts bez datuma un km - nav fakts.
    expect(detect({ mnt_ee: { mileage: [{ date: "", odometer: "", country: "EE", origin: "x" }] } })).toEqual([]);
  });

  it("viens ieraksts uz tipu neatkarīgi no avotu skaita", () => {
    const kinds = detect({
      ...MILEAGE_PATCH,
      ltab: { rows: [INCIDENT_PATCH.ltab.rows[0], { incidentNo: "LV", csngDate: "05.06.2021", lossAmount: "800" }] },
      cc_vin: {
        photos: [{ id: photoId("a") }, { id: photoId("b") }],
        damages: [{ date: "01.01.2019", region: "DE", amount: "900 EUR", description: "" }],
        thecarapiRecords: [{ photoUrls: ["https://x/1.jpg"], photos: [] }],
      },
      ...FOREIGN_PATCH,
      carinfo: { mileage: [{ date: "01.01.2023", odometer: "140000", country: "SE", origin: "" }] },
    });
    expect(kinds).toEqual(["mileage_mismatch", "incidents", "auction_photos", "foreign_registry"]);
    const st = regenerateDealerSignals({ enabled: true, items: [] }, [...kinds, ...kinds]);
    expect(st.items.map((i) => i.kind)).toEqual(kinds);
  });
});

describe("stāvoklis", () => {
  it("noklusējums izslēgts; pārģenerēšana slēdzi neieslēdz", () => {
    expect(emptyDealerSignalsState().enabled).toBe(false);
    const st = regenerateDealerSignals(undefined, ["incidents"]);
    expect(st.enabled).toBe(false);
    expect(st.items).toEqual([{ kind: "incidents", checked: true }]);
    expect(dealerSignalsSectionOn(st)).toBe(false);
    expect(dealerSignalsSectionOn(undefined)).toBe(false);
    expect(dealerSignalsSectionOn({ enabled: true, items: [{ kind: "incidents", checked: false }] })).toBe(false);
  });

  it("pārģenerēšana saglabā ķekšus un tekstus esošajiem tipiem, ja nelūdz atiestatīt", () => {
    const cur: DealerSignalsState = { enabled: true, items: [{ kind: "incidents", checked: false, text: "Labots" }] };
    expect(regenerateDealerSignals(cur, ["incidents", "auction_photos"]).items).toEqual([
      { kind: "incidents", checked: false, text: "Labots" },
      { kind: "auction_photos", checked: true },
    ]);
    expect(regenerateDealerSignals(cur, ["incidents"], { keepEdits: false })).toEqual({
      enabled: true,
      items: [{ kind: "incidents", checked: true }],
    });
  });

  it("persistences parse: nezināmi tipi ārā, dublikāti ārā, vecie bez lauka - undefined", () => {
    expect(parseDealerSignals(undefined)).toBeUndefined();
    expect(parseDealerSignals([1])).toBeUndefined();
    expect(
      parseDealerSignals({
        enabled: "yes",
        items: [
          { kind: "auction_photos", checked: true },
          { kind: "x", checked: true },
          { kind: "auction_photos", checked: false },
          { kind: "mileage_mismatch", checked: true, text: "  Teksts " },
        ],
      }),
    ).toEqual({
      enabled: false,
      items: [
        { kind: "mileage_mismatch", checked: true, text: "Teksts" },
        { kind: "auction_photos", checked: true },
      ],
    });
  });
});

describe("PDF sadaļa", () => {
  const dealer = (state: DealerSignalsState | null, link = { url: "https://www.provin.lv/lv/papildinajums/abc" }) => ({
    pdfReportKind: "dealer" as const,
    dealerSignals: state,
    dealerSignalsAuditLink: link,
  });

  it("izslēgta vai bez ķekšiem -> nav sadaļas; ne-dīlera PDF -> nav", () => {
    expect(buildDealerSignalsSectionHtml(dealer(null), "lv")).toBe("");
    expect(buildDealerSignalsSectionHtml(dealer({ ...ALL_ON, enabled: false }), "lv")).toBe("");
    expect(
      buildDealerSignalsSectionHtml(dealer({ enabled: true, items: [{ kind: "incidents", checked: false }] }), "lv"),
    ).toBe("");
    expect(buildDealerSignalsSectionHtml({ ...dealer(ALL_ON), pdfReportKind: "full" }, "lv")).toBe("");
  });

  it("nosaukums, viena rinda uz tipu, sarkanā nobraukuma rinda, audita saite", () => {
    const html = buildDealerSignalsSectionHtml(dealer(ALL_ON), "lv");
    expect(html).toContain(DEALER_SIGNALS_SECTION_TITLE.lv);
    expect(html.match(/<tr class="pdf-dealer-signal-row/g)).toHaveLength(4);
    expect(html.match(/pdf-dealer-signal-row--alert/g)).toHaveLength(1);
    expect(html).toMatch(/pdf-dealer-signal-row--alert" data-signal="mileage_mismatch"/);
    expect(html).toContain("Nobraukuma nesakritība");
    expect(html).toContain("Iespējama odometra korekcija");
    expect(html).toContain("Par šo auto pieejami negadījumu ieraksti");
    expect(html).toContain("Pieejamas izsoļu fotogrāfijas");
    expect(html).toContain('<a href="https://www.provin.lv/lv/papildinajums/abc">Pasūtīt PROVIN AUDITU</a>');
    expect(html).not.toMatch(/eksperts|pirkt|nepirkt|AutoDNA|carVertical|CARFAX|LTAB|CSDD|mnt\.ee/i);
    expect(html).not.toMatch(/[–—]/);
  });

  it("bez skaitļiem visās valodās (sadaļas teksts bez cipariem)", () => {
    for (const lang of CLIENT_REPORT_LANGS) {
      const text = buildDealerSignalsSectionHtml(dealer(ALL_ON), lang)
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ");
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toMatch(/\d/);
    }
  });

  it("BF cena saitē: tikai BF laikā un BF piemaksai; citādi bez cenas", () => {
    const base = { vin: "WBA5R1C0XLFH42873", lang: "lv" as ClientReportLang, nowMs: NOW, bfChargeCents: 7999 };
    const bf = dealerSignalsAuditLinkFromOffer({ url: "https://x.lv/a", chargeCents: 7999 }, { ...base, bfWindow: () => true });
    expect(bf).toEqual({ url: "https://x.lv/a", priceLabel: "79,99 €" });
    expect(buildDealerSignalsSectionHtml(dealer(ALL_ON, bf), "lv")).toContain("Pasūtīt PROVIN AUDITU - 79,99 €");
    expect(
      dealerSignalsAuditLinkFromOffer({ url: "https://x.lv/a", chargeCents: 7999 }, { ...base, bfWindow: () => false }),
    ).toEqual({ url: "https://x.lv/a" });
    expect(
      dealerSignalsAuditLinkFromOffer({ url: "https://x.lv/a", chargeCents: 7500 }, { ...base, bfWindow: () => true }),
    ).toEqual({ url: "https://x.lv/a" });
    expect(dealerSignalsAuditLinkFromOffer(null, { ...base, bfWindow: () => true })).toEqual({
      url: "https://www.provin.lv/lv?plan=audits&vin=WBA5R1C0XLFH42873",
    });
    expect(dealerSignalsFallbackAuditUrl("", "en")).toBe("https://www.provin.lv/en?plan=audits");
  });

  it("valodas: virsraksti tulkoti, labotais teksts tikai LV un bez cipariem", () => {
    const en = buildDealerSignalsSectionHtml(dealer(ALL_ON), "en");
    expect(en).toContain("Signals beyond dealer data");
    expect(en).toContain("Possible odometer correction");
    expect(en).toContain("Order PROVIN AUDITS");
    expect(buildDealerSignalsSectionHtml(dealer(ALL_ON), "ru")).toContain(DEALER_SIGNALS_SECTION_TITLE.ru);
    expect(buildDealerSignalsSectionHtml(dealer(ALL_ON), "de")).toContain(DEALER_SIGNALS_SECTION_TITLE.de);
    const custom = { kind: "incidents" as const, text: "Pieejami ieraksti — pārbaudiet" };
    expect(dealerSignalText(custom, "lv")).toBe("Pieejami ieraksti - pārbaudiet");
    expect(dealerSignalText(custom, "en")).toBe("Accident records are available for this car");
    expect(dealerSignalText({ kind: "incidents", text: "3 ieraksti" }, "lv")).toBe("Par šo auto pieejami negadījumu ieraksti");
    expect(dealerSignalsPdfRows({ enabled: true, items: [{ kind: "incidents", checked: true }] }, "de")[0]).toEqual({
      kind: "incidents",
      title: "Unfalleinträge",
      text: "Für dieses Fahrzeug liegen Unfalleinträge vor",
      alert: false,
    });
  });
});

describe("e-pasta rinda", () => {
  const msg = (signalsLine: boolean, lang: ClientReportLang = "lv", situation: "ready" | "no_data" = "ready") =>
    buildDealerSendMessage({ channel: "email", situation, b2b: false, vin: "WBA5R1C0XLFH42873", lang, signalsLine }).text;

  it("tikai, ja sadaļa ieslēgta un «Dati gatavi»", () => {
    expect(msg(false)).not.toContain(DEALER_SIGNALS_EMAIL_LINE.lv);
    expect(msg(true)).toContain(DEALER_SIGNALS_EMAIL_LINE.lv);
    expect(msg(true, "lv", "no_data")).not.toContain(DEALER_SIGNALS_EMAIL_LINE.lv);
    expect(
      buildDealerSendMessage({ channel: "whatsapp", situation: "ready", b2b: false, signalsLine: true }).text,
    ).not.toContain(DEALER_SIGNALS_EMAIL_LINE.lv);
  });

  it("klienta valodā, viena reize, pēc ievada rindkopas", () => {
    for (const lang of CLIENT_REPORT_LANGS) {
      const t = msg(true, lang);
      expect(t.split(DEALER_SIGNALS_EMAIL_LINE[lang]).length - 1).toBe(1);
    }
    expect(DEALER_SIGNALS_EMAIL_LINE.en).toBe(
      "The report includes a section with additional signals - we recommend reviewing it.",
    );
    const once = withDealerSignalsEmailLine("Labdien!\n\nGatavs.\n\nParaksts", "lv");
    expect(once).toBe(`Labdien!\n\nGatavs.\n\n${DEALER_SIGNALS_EMAIL_LINE.lv}\n\nParaksts`);
    expect(withDealerSignalsEmailLine(once, "lv")).toBe(once);
  });
});
