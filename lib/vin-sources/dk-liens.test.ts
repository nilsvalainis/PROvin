import { describe, expect, it } from "vitest";
import {
  createDefaultSourceBlocks,
  repairVinRegistryBlock,
  SOURCE_BLOCK_LABELS,
  toPdfManualVendorBlocks,
  type VinRegistryBlockState,
} from "@/lib/admin-source-blocks";
import { buildAtraFacts, type AtraFactRow } from "@/lib/atra-parbaude-facts";
import { buildQuickEvalRedFlags } from "@/lib/quick-eval-auto-core";
import { registryCardFacts } from "@/lib/quick-eval-cards";
import { buildVinScanV4Attention } from "@/lib/vin-scan/v4-view";
import type { VinScanIndicator } from "@/lib/vin-scan/types";
import { isoDay } from "@/lib/vin-sources/dk-json";
import { formatLienAmount, liensFromTjekbilRaw, parseTjekbilLiens, tjekbilLienDate } from "@/lib/vin-sources/dk-liens";
import { mapTjekbilPayload, type TjekbilDmrResponse } from "@/lib/vin-sources/tjekbil-map";

/** Anonimizēta tjekbil `debtData` struktūra (vārdi, numuri un summas izdomāti). */
const DEBT = {
  carId: "9000000000000001",
  laaneDokumenter: [
    {
      hovedStol: "150000 DKK",
      dato: "10/24/2022",
      loebeNummer: "20221024-1000000001",
      dokumentType: "ejerpantebrev",
      underpanthaver: "TESTBANKEN A/S",
      kreditorer: [{ navn: "Jens Testesen" }],
      debitorer: [{ navn: "Jens Testesen", foedselsDato: "010190-XXXX" }],
      tillaegsTekster: ["Advarsel: test"],
      interestRate: null,
      saerligeLaanevilkaar: "rentetilpasning",
    },
  ],
  konkurs: null,
};

const DMR: TjekbilDmrResponse = {
  basic: { regNr: "XX12345", maerkeTypeNavn: "TESTMÆRKE", status: "Registreret" },
  debtData: DEBT,
};

describe("isoDay - datumu validācija (26.11)", () => {
  it("ASV MM/DD/YYYY nekad nekļūst par mēnesi 24", () => {
    expect(isoDay("10/24/2022")).toBe("2022-10-24");
    expect(isoDay("10/24/2022", { slashOrder: "mdy" })).toBe("2022-10-24");
    expect(isoDay("8/1/2016", { slashOrder: "mdy" })).toBe("2016-08-01");
    expect(isoDay("03/04/2022")).toBe("2022-04-03");
    expect(isoDay("03/04/2022", { slashOrder: "mdy" })).toBe("2022-03-04");
  });

  it("sabojāts ISO ar mēnesi > 12 -> samaina dienu un mēnesi vai atstāj tukšu", () => {
    expect(isoDay("2022-24-10")).toBe("2022-10-24");
    expect(isoDay("2022-13-13")).toBe("");
    expect(isoDay("2022-02-30")).toBe("");
    expect(isoDay("2025-11-14T12:02:00")).toBe("2025-11-14");
  });

  it("da-DK dd-mm-yyyy paliek kā bija", () => {
    expect(isoDay("14-11-2025")).toBe("2025-11-14");
    expect(isoDay("06.10.2023")).toBe("2023-10-06");
  });
});

describe("Bilbogen ķīla - apgrūtinājums, ne negadījums", () => {
  it("datums no loebeNummer / ASV dato, summa ar valūtu, tikai uzņēmuma ķīlas ņēmējs", () => {
    expect(tjekbilLienDate(DEBT.laaneDokumenter[0]!)).toBe("2022-10-24");
    expect(tjekbilLienDate({ dato: "10/24/2022" })).toBe("2022-10-24");
    expect(formatLienAmount("150000 DKK")).toBe("150 000 DKK");
    expect(formatLienAmount("2930.00")).toBe("2 930");
    const [lien] = parseTjekbilLiens(DEBT.laaneDokumenter);
    expect(lien).toEqual({
      date: "2022-10-24",
      type: "īpašnieka ķīlas zīme (ejerpantebrev)",
      amount: "150 000 DKK",
      holder: "TESTBANKEN A/S",
    });
  });

  it("mapTjekbilPayload: nav negadījumu rindas, ķīla statusos, karogs piezīmēs, bez personas datiem", () => {
    const mapped = mapTjekbilPayload({ dmr: DMR });
    expect(mapped.incidents).toEqual([]);
    expect(mapped.statusRecords).toContain(
      "Ķīla / parāds (Bilbogen): 24.10.2022 · īpašnieka ķīlas zīme (ejerpantebrev) · parāda summa 150 000 DKK · ķīlas ņēmējs TESTBANKEN A/S",
    );
    expect(mapped.notes).toContain("Reģistrēta ķīla (Bilbogen).");
    const all = JSON.stringify(mapped);
    expect(all).not.toContain("Jens");
    expect(all).not.toContain("010190");
    expect(all).not.toMatch(/2022-24-10/);
  });

  it("saglabātais pasūtījums (pirms 26.11): rinda no negadījumiem pārnesta uz statusiem ar RAW datiem", () => {
    const legacy = {
      ...createDefaultSourceBlocks().tjekbil,
      incidents: [{ date: "2022-24-10", amount: "", country: "Dānija", note: "Ķīla / parāds (Bilbogen)" }],
      statusRecords: "Izmantošanas veids: Privāti",
      autoNotes: "Reģistrēta ķīla (Bilbogen).",
      rawUnprocessedData: JSON.stringify({ tjekbil: { dmr: { debtData: DEBT } }, nummerplade: { ok: true } }, null, 2),
    } as VinRegistryBlockState;
    const fixed = repairVinRegistryBlock(legacy);
    expect(fixed.incidents.some((r) => /ķīla/i.test(r.note))).toBe(false);
    expect(fixed.statusRecords).toBe(
      "Izmantošanas veids: Privāti\nĶīla / parāds (Bilbogen): 24.10.2022 · īpašnieka ķīlas zīme (ejerpantebrev) · parāda summa 150 000 DKK · ķīlas ņēmējs TESTBANKEN A/S",
    );
    // Idempotents: otrreiz nedublē.
    expect(repairVinRegistryBlock(fixed).statusRecords).toBe(fixed.statusRecords);

    const blocks = createDefaultSourceBlocks();
    blocks.tjekbil = legacy;
    const pdf = toPdfManualVendorBlocks(blocks).find((v) => v.title === SOURCE_BLOCK_LABELS.tjekbil);
    expect(pdf?.incidentRows).toEqual([]);
    expect(pdf?.statusRecords).toContain("Ķīla / parāds (Bilbogen): 24.10.2022");
  });

  it("saglabātais pasūtījums bez RAW: ņem rindas datumu (salabotu) un summu", () => {
    const legacy = {
      ...createDefaultSourceBlocks().tjekbil,
      incidents: [{ date: "2022-24-10", amount: "2930.00", country: "Dānija", note: "Ķīla / parāds (Bilbogen) - TESTBANKEN A/S" }],
    } as VinRegistryBlockState;
    const fixed = repairVinRegistryBlock(legacy);
    expect(fixed.incidents.some((r) => /ķīla/i.test(r.note))).toBe(false);
    expect(fixed.statusRecords).toBe("Ķīla / parāds (Bilbogen): 24.10.2022 · parāda summa 2 930 · ķīlas ņēmējs TESTBANKEN A/S");
    expect(liensFromTjekbilRaw('{"ok":true}')).toBeNull();
  });

  it("citi sabojāti ISO datumi reģistra blokā tiek salaboti vai iztukšoti", () => {
    const b = repairVinRegistryBlock({
      ...createDefaultSourceBlocks().tjekbil,
      mileage: [{ date: "2023-31-12", odometer: "100", country: "Dānija", origin: "" }],
      timeline: [{ date: "2023-13-13", odometer: "", country: "Dānija", event: "Test" }],
    } as VinRegistryBlockState);
    expect(b.mileage[0]?.date).toBe("2023-12-31");
    expect(b.timeline[0]?.date).toBe("");
  });

  it("Ātro vērtējumu kartīte: «Ķīla / parāds» sarkana, negadījumu nav", () => {
    const b = repairVinRegistryBlock({
      ...createDefaultSourceBlocks().tjekbil,
      mileage: [{ date: "2025-11-14", odometer: "170000", country: "Dānija", origin: "" }],
      incidents: [{ date: "2022-24-10", amount: "", country: "Dānija", note: "Ķīla / parāds (Bilbogen)" }],
    } as VinRegistryBlockState);
    const facts = registryCardFacts(b);
    expect(facts.find((f) => f.label === "Negadījumi")?.value).toBe("nav");
    expect(facts.find((f) => f.label === "Ķīla / parāds")).toMatchObject({ value: "24.10.2022", tone: "bad" });
  });
});

describe("VIN SCAN / Ātrie vērtējumi - ķīlas karogs", () => {
  const oldRow: AtraFactRow = {
    id: "tjekbil",
    label: "tjekbil.dk",
    country: "DK",
    status: "found",
    summary: "Atrasts Dānijas reģistrā",
    detail: "Izmantošanas veids: Privāti\nReģistrēta ķīla (Bilbogen).",
  };

  it("v4 «Uzmanību»: «Ķīla / parāds», nevis negadījums (arī vecam momentuzņēmumam bez karoga)", () => {
    const facts = buildAtraFacts({
      vin: "VF3TEST0000000001",
      plate: "",
      title: "",
      year: "",
      rows: [oldRow],
      dealer: null,
      csdd: null,
      hasListing: false,
    });
    expect(facts.incidents.count).toBe(0);
    expect(facts.liens).toEqual(["tjekbil.dk"]);
    const attention = buildVinScanV4Attention(facts);
    expect(attention).toContainEqual({ text: "Ķīla / parāds", source: "tjekbil.dk" });
    expect(attention.some((f) => /negadījum/i.test(f.text))).toBe(false);
  });

  it("Ātro vērtējumu sarkanais karogs no flags.lien", () => {
    const row = { ...oldRow, detail: "", openUrl: null, flags: { lien: true } } as unknown as VinScanIndicator;
    const flags = buildQuickEvalRedFlags({ issues: [], banners: [], indicators: [row] });
    expect(flags).toContainEqual({ severity: "red", text: "tjekbil.dk: reģistrēta ķīla / parāds" });
  });
});
