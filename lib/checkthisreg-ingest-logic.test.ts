import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import {
  applyCtrToAutoRecords,
  ctrChipLabel,
  decideCtrResult,
  matchCtrOrder,
  nextCtrOrderRecord,
  normalizeCtrPending,
  parseCtrDocumentChunk,
  parseCtrFinalize,
  verifyCtrIngestToken,
  type CtrOrderCandidate,
} from "@/lib/checkthisreg-ingest-logic";

const VIN = "VF1TEST0000000001";
const TOKEN = "t".repeat(32);
const NOW = Date.parse("2026-11-27T18:00:00Z");
const DAY = 24 * 60 * 60_000;

describe("verifyCtrIngestToken", () => {
  it("bez env vai ar īsu env - izslēgts", () => {
    expect(verifyCtrIngestToken(`Bearer ${TOKEN}`, {})).toBe(false);
    expect(verifyCtrIngestToken("Bearer short", { CTR_INGEST_TOKEN: "short" })).toBe(false);
  });
  it("pareizs / nepareizs tokens", () => {
    expect(verifyCtrIngestToken(`Bearer ${TOKEN}`, { CTR_INGEST_TOKEN: TOKEN })).toBe(true);
    expect(verifyCtrIngestToken(`Bearer ${"x".repeat(32)}`, { CTR_INGEST_TOKEN: TOKEN })).toBe(false);
    expect(verifyCtrIngestToken(null, { CTR_INGEST_TOKEN: TOKEN })).toBe(false);
  });
});

describe("ievades ķermeņi", () => {
  it("document: md5, daļas, izmērs", () => {
    const ok = parseCtrDocumentChunk({
      ctrOrderId: "token_1_ABCDEF",
      md5: "a".repeat(32),
      fileName: "2018-07-19.pdf",
      chunkIndex: 0,
      chunkCount: 1,
      chunkBase64: Buffer.from("%PDF-1.4 test").toString("base64"),
    });
    expect("error" in ok).toBe(false);
    expect(parseCtrDocumentChunk({ ctrOrderId: "../x", md5: "a".repeat(32), chunkBase64: "AA==" })).toEqual({ error: "invalid_order_id" });
    expect(parseCtrDocumentChunk({ ctrOrderId: "token_1_ABCDEF", md5: "zz", chunkBase64: "AA==" })).toEqual({ error: "invalid_md5" });
    expect(parseCtrDocumentChunk({ ctrOrderId: "token_1_ABCDEF", md5: "a".repeat(32), chunkIndex: 2, chunkCount: 2, chunkBase64: "AA==" })).toEqual({
      error: "invalid_chunk",
    });
  });

  it("finalize: VIN, e-pasta veids, dokumenti bez dublikātiem", () => {
    const fin = parseCtrFinalize({
      ctrOrderId: "token_1_ABCDEF",
      orderNumber: "20261127-ABCDEF",
      vin: VIN.toLowerCase(),
      manufacturer: "Renault",
      emailKind: "ready",
      documents: [
        { md5: "b".repeat(32), fileName: "a.pdf", size: 10 },
        { md5: "b".repeat(32), fileName: "a.pdf", size: 10 },
      ],
    });
    if ("error" in fin) throw new Error(fin.error);
    expect(fin.vin).toBe(VIN);
    expect(fin.documents).toHaveLength(1);
    expect(parseCtrFinalize({ ctrOrderId: "token_1_ABCDEF", vin: "123", emailKind: "ready" })).toEqual({ error: "invalid_vin" });
    expect(parseCtrFinalize({ ctrOrderId: "token_1_ABCDEF", vin: VIN, emailKind: "purchase" })).toEqual({ error: "invalid_email_kind" });
  });
});

describe("matchCtrOrder", () => {
  const base = (o: Partial<CtrOrderCandidate>): CtrOrderCandidate => ({
    id: "cs_x",
    createdMs: NOW - DAY,
    vins: [VIN],
    checkoutLine: "dealer",
    reportSent: false,
    ...o,
  });

  it("dīlera pasūtījumam priekšroka, tad jaunākais", () => {
    expect(
      matchCtrOrder(
        [
          base({ id: "cs_audits", checkoutLine: "premium", createdMs: NOW - 1000 }),
          base({ id: "cs_dealer", createdMs: NOW - 5 * DAY }),
        ],
        VIN,
        NOW,
      ),
    ).toBe("cs_dealer");
    expect(matchCtrOrder([base({ id: "cs_a", checkoutLine: "premium" }), base({ id: "cs_b", checkoutLine: "audit", createdMs: NOW - 100 })], VIN, NOW)).toBe("cs_b");
  });

  it("nosūtīts, MINI, cits VIN, par vecu -> nav", () => {
    expect(matchCtrOrder([base({ reportSent: true })], VIN, NOW)).toBeNull();
    expect(matchCtrOrder([base({ checkoutLine: "mini" })], VIN, NOW)).toBeNull();
    expect(matchCtrOrder([base({ vins: ["WBATEST0000000002"] })], VIN, NOW)).toBeNull();
    expect(matchCtrOrder([base({ createdMs: NOW - 200 * DAY })], VIN, NOW)).toBeNull();
    expect(matchCtrOrder([base({ checkoutLine: null, isManual: true })], VIN, NOW)).toBe("cs_x");
  });
});

describe("applyCtrToAutoRecords", () => {
  const patch = {
    serviceWorks: [{ date: "19.07.2018", odometer: "163451", location: "Renault dīleris", works: "Turbokompresora diagnostika (91695M, 1 h)" }],
    serviceHistory: [{ date: "19.07.2018", odometer: "163451", country: "" }],
    rawText: "Avots: Renault dīleris - dīlera sistēmas izdrukas",
    aiContext: "Dīlera dati: Renault dīleris",
    oilInterval: { km: 40000, months: null },
  };

  it("ievada rindas, RAW, AI kontekstu un OEM intervālu; atkārtojums nedublē", () => {
    const ar0 = createDefaultSourceBlocks().auto_records;
    const once = applyCtrToAutoRecords(ar0, patch);
    expect(once.serviceWorks.filter((r) => r.works)).toHaveLength(1);
    expect(once.serviceHistory.filter((r) => r.date)).toHaveLength(1);
    expect(once.oilIntervalChart?.oemKm).toBe(40000);
    const twice = applyCtrToAutoRecords(once, patch);
    expect(twice.serviceWorks.filter((r) => r.works)).toHaveLength(1);
    expect(twice.serviceHistory.filter((r) => r.date)).toHaveLength(1);
    expect(twice.rawUnprocessedData).toBe(once.rawUnprocessedData);
    expect(twice.aiContextRaw).toBe(once.aiContextRaw);
  });

  it("operatora dati paliek; esošais OEM intervāls netiek pārrakstīts", () => {
    const ar0 = {
      ...createDefaultSourceBlocks().auto_records,
      serviceWorks: [{ date: "01.02.2020", odometer: "100000", location: "Cits serviss", works: "Eļļas maiņa" }],
      rawUnprocessedData: "Operatora teksts",
      oilIntervalChart: { rows: [], oemKm: 30000, oemMonths: 24, highlightOverOem: true, useSavedRows: false },
    };
    const out = applyCtrToAutoRecords(ar0, patch);
    expect(out.serviceWorks.map((r) => r.date)).toEqual(["01.02.2020", "19.07.2018"]);
    expect(out.serviceWorks.some((r) => r.works === "Eļļas maiņa")).toBe(true);
    expect(out.rawUnprocessedData.startsWith("Operatora teksts")).toBe(true);
    expect(out.oilIntervalChart?.oemKm).toBe(30000);
    expect(out.oilIntervalChart?.oemMonths).toBe(24);
  });
});

describe("rezultāts, ieraksts, čips", () => {
  it("decideCtrResult", () => {
    expect(decideCtrResult({ docCount: 0, hasStructuredData: false, serviceRows: 0, mileageRows: 0, unknownDocs: 0 })).toBe("no_data");
    expect(decideCtrResult({ docCount: 2, hasStructuredData: true, serviceRows: 2, mileageRows: 2, unknownDocs: 0 })).toBe("data");
    expect(decideCtrResult({ docCount: 1, hasStructuredData: false, serviceRows: 0, mileageRows: 0, unknownDocs: 1 })).toBe("manual_needed");
  });

  it("«dati» uzvar pār vēlāku «nav datu»; čipa teksts", () => {
    const a = nextCtrOrderRecord(null, {
      status: "data",
      at: "2026-11-27T16:00:00Z",
      ctrOrderId: "token_1_ABCDEF",
      orderNumber: "20261127-ABCDEF",
      docCount: 3,
      serviceRows: 2,
      mileageRows: 2,
      formats: ["renault_operation"],
    });
    const b = nextCtrOrderRecord(a, { ...a, status: "no_data", ctrOrderId: "token_2_ABCDEF", orderNumber: "x", docCount: 0, serviceRows: 0, mileageRows: 0, formats: [] });
    expect(b.status).toBe("data");
    expect(b.ctrOrderIds).toHaveLength(2);
    expect(ctrChipLabel(a)?.text).toBe("CheckThisReg: dati ievadīti 27.11");
    expect(ctrChipLabel({ ...a, status: "no_data" })).toEqual({ text: "CheckThisReg: nav datu", tone: "missing" });
    expect(ctrChipLabel(null)).toBeNull();
  });

  it("gaidošie: novecojušie (> 30 d) izkrīt", () => {
    const fin = { ctrOrderId: "token_1_ABCDEF", vin: VIN, emailKind: "ready", documents: [] };
    const list = normalizeCtrPending(
      [
        { at: new Date(NOW - DAY).toISOString(), finalize: fin },
        { at: new Date(NOW - 40 * DAY).toISOString(), finalize: { ...fin, ctrOrderId: "token_2_ABCDEF" } },
      ],
      NOW,
    );
    expect(list.map((x) => x.ctrOrderId)).toEqual(["token_1_ABCDEF"]);
  });
});

describe("ctrPendingDue", () => {
  it("ne biežāk kā reizi stundā", async () => {
    const { ctrPendingDue } = await import("@/lib/checkthisreg-ingest-logic");
    expect(ctrPendingDue({}, NOW)).toBe(true);
    expect(ctrPendingDue({ triedAt: new Date(NOW - 10 * 60_000).toISOString() }, NOW)).toBe(false);
    expect(ctrPendingDue({ triedAt: new Date(NOW - 61 * 60_000).toISOString() }, NOW)).toBe(true);
  });
});
