import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchOneautoProducts = vi.fn();
const getOneautoApiConfig = vi.fn(() => ({ apiKey: "test", baseUrl: "https://api.oneautoapi.com" }));
const readDealerDataJob = vi.fn();
const upsertDealerDataJob = vi.fn();
const readOrderDraft = vi.fn();
const patchOrderDraft = vi.fn();
const generateSourceCommentWithAi = vi.fn();
const translateOneautoWorksOnIngest = vi.fn(async (display: unknown) => display);
const refundB2bWalletOrderIfNoData = vi.fn(async (_id: string) => ({ refunded: false, reason: "not_wallet" }));

vi.mock("@/lib/oneauto-api", () => ({
  fetchOneautoProducts: (opts: unknown) => fetchOneautoProducts(opts),
  getOneautoApiConfig: () => getOneautoApiConfig(),
}));
vi.mock("@/lib/dealer-data-job-store", () => ({
  readDealerDataJob: (id: string) => readDealerDataJob(id),
  upsertDealerDataJob: (id: string, patch: unknown) => upsertDealerDataJob(id, patch),
}));
vi.mock("@/lib/admin-order-draft-store", () => ({
  isSafeOrderDraftSessionId: (id: string) => /^[a-zA-Z0-9_]+$/.test(id),
  readOrderDraft: (id: string) => readOrderDraft(id),
  patchOrderDraft: (id: string, patch: unknown, opts?: unknown) => patchOrderDraft(id, patch, opts),
}));
vi.mock("@/lib/admin-ai-source-comment", () => ({
  generateSourceCommentWithAi: (opts: unknown) => generateSourceCommentWithAi(opts),
}));
vi.mock("@/lib/admin-ai-oneauto-translate", () => ({
  translateOneautoWorksOnIngest: (display: unknown) => translateOneautoWorksOnIngest(display),
}));
vi.mock("@/lib/b2b-wallet-refund", () => ({
  refundB2bWalletOrderIfNoData: (id: string) => refundB2bWalletOrderIfNoData(id),
}));
const sendDealerDataAlertIfNeeded = vi.fn(async (_id: string, _opts?: unknown) => null);
const reviewDealerCommentsWithOpus = vi.fn(async (args: { fields: { id: string; text: string }[] }) => ({
  texts: Object.fromEntries(args.fields.map((f) => [f.id, f.text])),
  applied: 0,
  ok: true,
}));
vi.mock("@/lib/dealer-data-alert", () => ({
  sendDealerDataAlertIfNeeded: (id: string, opts?: unknown) => sendDealerDataAlertIfNeeded(id, opts),
}));
vi.mock("@/lib/dealer-comments-review", () => ({
  reviewDealerCommentsWithOpus: (args: { fields: { id: string; text: string }[] }) =>
    reviewDealerCommentsWithOpus(args),
}));
vi.mock("@/lib/admin-rich-comment-html", () => ({
  aiExpertSourceCommentToRichHtml: (text: string) => `<p>${text}</p>`,
  adminRichHtmlToPlainText: (text: string) => String(text ?? "").replace(/<[^>]+>/g, " "),
}));

import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { runDealerDataJob } from "@/lib/dealer-data-job";

const SESSION = "manual_order_testdealer1";
const VIN = "WAUZZZ4M0JD000001";

function historyPayload() {
  return {
    success: true,
    result: {
      service_events: [{ date: "2024-01-10", odometer: "12000", dealer: "Audi Riga", works: "Oil change" }],
    },
  };
}

function lookupPayload() {
  return {
    success: true,
    result: { make: "Audi", model: "A5", engine: "DLVB", fuel: "Petrol", colour: "Black" },
  };
}

function emptyDraft(notes: string) {
  return {
    workspace: {
      sourceBlocks: createDefaultSourceBlocks(),
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
    },
    orderEdits: { notes, listingUrl: "", customerName: "B2B", internalComment: "" },
  };
}

describe("runDealerDataJob paid idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOneautoApiConfig.mockReturnValue({ apiKey: "test", baseUrl: "https://api.oneautoapi.com" });
    upsertDealerDataJob.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      sessionId: SESSION,
      vin: VIN,
      status: patch.status ?? "pending",
      attempts: patch.attempts ?? 0,
      createdAt: "2026-10-19T00:00:00.000Z",
      updatedAt: "2026-10-19T00:00:00.000Z",
      ...patch,
    }));
    patchOrderDraft.mockResolvedValue({ ok: true });
    generateSourceCommentWithAi.mockResolvedValue("Dealer comment in English.");
    readDealerDataJob.mockResolvedValue(null);
    readOrderDraft.mockResolvedValue(
      emptyDraft(
        "B2B dealer · partner_id=ptr_1 · wallet_product=dealer_pro · wallet_txn=wtx_1 · wallet_cents=2499 · report_lang=en",
      ),
    );
  });

  it("pirmajā reizē izsauc OE Service History, tad VIN Lookup, komentāru ģenerē EN", async () => {
    fetchOneautoProducts
      .mockResolvedValueOnce({
        costEur: "3.00",
        results: {
          oe_service_history: { ok: true, payload: historyPayload() },
        },
        display: { equipment: [], powertrain: [], serviceTimeline: [{ date: "10.01.2024", odometer: "12000", place: "Audi Riga", works: "Oil change" }] },
      })
      .mockResolvedValueOnce({
        costEur: "0.36",
        results: {
          oe_vin_lookup: { ok: true, payload: lookupPayload() },
        },
        display: { equipment: [], powertrain: [{ label: "Engine", value: "DLVB" }], serviceTimeline: [] },
      });

    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "webhook" });
    expect(r).toMatchObject({ ok: true, status: "done" });
    expect(fetchOneautoProducts).toHaveBeenCalledTimes(2);
    expect(fetchOneautoProducts.mock.calls[0]![0]).toEqual({
      vin: VIN,
      products: ["oe_service_history"],
    });
    expect(fetchOneautoProducts.mock.calls[1]![0]).toEqual({
      vin: VIN,
      products: ["oe_vin_lookup"],
    });
    // Divi komentāri: eļļas intervāli + „Komentāri”.
    expect(generateSourceCommentWithAi).toHaveBeenCalledTimes(2);
    const fields = generateSourceCommentWithAi.mock.calls.map((c) => (c[0] as { targetField: string }).targetField);
    expect(fields.sort()).toEqual(["comments", "oilChangeIntervalNotes"]);
    for (const call of generateSourceCommentWithAi.mock.calls) {
      expect(call[0]).toMatchObject({
        modelTier: "gemini-flash",
        outputLang: "en",
        isolateDealerComments: true,
        highlightMajorAssemblies: true,
      });
      expect(call[0]).not.toHaveProperty("includeOilIntervalSummary");
    }
    // EN komentāriem Opus (LV) pārbaudi nepalaižam.
    expect(reviewDealerCommentsWithOpus).not.toHaveBeenCalled();
    const last = upsertDealerDataJob.mock.calls.at(-1)![1] as Record<string, unknown>;
    expect(last).toMatchObject({ status: "done", aiGenerated: true });
  });

  it("retry neizsauc jau settled maksas produktus, tikai trūkstošo", async () => {
    readDealerDataJob.mockResolvedValue({
      sessionId: SESSION,
      vin: VIN,
      status: "failed",
      attempts: 1,
      createdAt: "2026-10-19T00:00:00.000Z",
      updatedAt: "2026-10-19T00:00:00.000Z",
      paidOutcomes: { oe_vin_lookup: "ok" },
      oneautoResults: {
        oe_vin_lookup: { ok: true, payload: lookupPayload() },
      },
    });
    fetchOneautoProducts.mockResolvedValue({
      costEur: "3.00",
      results: {
        oe_service_history: { ok: true, payload: historyPayload() },
      },
      display: { equipment: [], powertrain: [], serviceTimeline: [{ date: "10.01.2024", odometer: "12000", place: "Riga", works: "Oil" }] },
    });

    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "manual" });
    expect(r.status).toBe("done");
    expect(fetchOneautoProducts).toHaveBeenCalledTimes(1);
    expect(fetchOneautoProducts.mock.calls[0]![0].products).toEqual(["oe_service_history"]);
  });

  it("pabeigtam darbam retry nemaksā nevienu produktu", async () => {
    readDealerDataJob.mockResolvedValue({
      sessionId: SESSION,
      vin: VIN,
      status: "done",
      attempts: 1,
      createdAt: "2026-10-19T00:00:00.000Z",
      updatedAt: "2026-10-19T00:00:00.000Z",
      paidOutcomes: { oe_vin_lookup: "ok", oe_service_history: "ok" },
      oneautoResults: {
        oe_vin_lookup: { ok: true, payload: lookupPayload() },
        oe_service_history: { ok: true, payload: historyPayload() },
      },
    });
    const draft = emptyDraft(
      "B2B dealer · wallet_product=dealer_pro · wallet_txn=wtx_1 · wallet_cents=2499 · report_lang=en",
    );
    draft.workspace.sourceBlocks.auto_records.oneautoIngest = {
      vinOverride: "",
      lastFetchedVin: VIN,
      fetchedAt: "2026-10-19T00:00:00.000Z",
      selectedProducts: ["oe_vin_lookup", "oe_service_history"],
      lastCostEur: "3.36",
      results: {
        oe_vin_lookup: { ok: true, payload: lookupPayload() },
        oe_service_history: { ok: true, payload: historyPayload() },
      },
      serviceTimelineOriginal: [{ date: "10.01.2024", odometer: "12000", place: "Riga", works: "Oil" }],
    };
    readOrderDraft.mockResolvedValue(draft);

    const skipped = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "manual" });
    expect(skipped.reason).toBe("already_fetched");
    expect(fetchOneautoProducts).not.toHaveBeenCalled();

    const forced = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "manual", force: true });
    expect(forced.status).toBe("done");
    expect(fetchOneautoProducts).not.toHaveBeenCalled();
  });

  it("RAW ģenerē komentāru oriģinālvalodā un netulko darbus", async () => {
    readOrderDraft.mockResolvedValue(
      emptyDraft("B2B dealer · wallet_product=dealer_raw · wallet_txn=wtx_2 · wallet_cents=1999"),
    );
    fetchOneautoProducts
      .mockResolvedValueOnce({
        costEur: "3.00",
        results: {
          oe_service_history: { ok: true, payload: historyPayload() },
        },
        display: { equipment: [], powertrain: [], serviceTimeline: [{ date: "10.01.2024", odometer: "12000", place: "München", works: "Ölwechsel" }] },
      })
      .mockResolvedValueOnce({
        costEur: "0.36",
        results: {
          oe_vin_lookup: { ok: true, payload: lookupPayload() },
        },
        display: { equipment: [], powertrain: [], serviceTimeline: [] },
      });

    const r = await runDealerDataJob({
      sessionId: SESSION,
      vin: VIN,
      trigger: "webhook",
      skipTranslate: true,
    });
    expect(r.status).toBe("done");
    expect(translateOneautoWorksOnIngest).not.toHaveBeenCalled();
    expect(generateSourceCommentWithAi.mock.calls[0]![0]).toMatchObject({ outputLang: "source" });
  });

  it("OE vēsture HTTP 206 „no data available” = no_data, nevis kļūda", async () => {
    fetchOneautoProducts.mockResolvedValue({
      costEur: "0.00",
      results: {
        oe_service_history: {
          ok: false,
          error: "http_206",
          httpStatus: 206,
          payload: {
            success: false,
            result: null,
            error: "There is no data available for this vehicle identification number.  You have not been charged.",
          },
        },
      },
      display: { equipment: [], powertrain: [], serviceTimeline: [] },
    });
    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "webhook" });
    expect(r).toMatchObject({ ok: true, status: "no_data" });
    expect(fetchOneautoProducts).toHaveBeenCalledTimes(1);
    expect(refundB2bWalletOrderIfNoData).toHaveBeenCalledWith(SESSION);
  });

  it("VIN Lookup HTTP 206 neaptur vēstures ierakstu - darbs pabeigts", async () => {
    fetchOneautoProducts
      .mockResolvedValueOnce({
        costEur: "3.00",
        results: { oe_service_history: { ok: true, payload: historyPayload() } },
        display: { equipment: [], powertrain: [], serviceTimeline: [] },
      })
      .mockResolvedValueOnce({
        costEur: "0.00",
        results: {
          oe_vin_lookup: {
            ok: false,
            error: "http_206",
            httpStatus: 206,
            payload: {
              success: false,
              result: null,
              error: "There is no data available for this vehicle identification number.  You have not been charged.",
            },
          },
        },
        display: { equipment: [], powertrain: [], serviceTimeline: [] },
      });
    fetchOneautoProducts.mockResolvedValueOnce({
      costEur: "0.18",
      results: { vin_decoder: { ok: true, payload: lookupPayload() } },
      display: { equipment: [], powertrain: [], serviceTimeline: [] },
    });
    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "webhook" });
    expect(r).toMatchObject({ ok: true, status: "done" });
    expect(patchOrderDraft).toHaveBeenCalled();
    // Lookup nedeva datus -> VIN Decoder (0,18 €).
    expect(fetchOneautoProducts).toHaveBeenCalledTimes(3);
    expect(fetchOneautoProducts.mock.calls[2]![0].products).toEqual(["vin_decoder"]);
    const last = upsertDealerDataJob.mock.calls.at(-1)![1] as Record<string, unknown>;
    expect(last).toMatchObject({
      status: "done",
      paidOutcomes: { oe_service_history: "ok", oe_vin_lookup: "no_data", vin_decoder: "ok" },
    });
  });

  it("OE vēstures no_data neatver VIN Lookup un neatgriež Decoder", async () => {
    fetchOneautoProducts.mockResolvedValue({
      costEur: "0.00",
      results: {
        oe_service_history: { ok: false, error: "no_data", payload: { success: false } },
      },
      display: { equipment: [], powertrain: [], serviceTimeline: [] },
    });
    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "webhook" });
    expect(r).toMatchObject({ ok: true, status: "no_data" });
    expect(fetchOneautoProducts).toHaveBeenCalledTimes(1);
    expect(fetchOneautoProducts.mock.calls[0]![0].products).toEqual(["oe_service_history"]);
    expect(refundB2bWalletOrderIfNoData).toHaveBeenCalledWith(SESSION);
    expect(generateSourceCommentWithAi).not.toHaveBeenCalled();
  });

  it("pārraksta dīzeļa komentāru, kad VIN Lookup ieliek benzīnu", async () => {
    const draft = emptyDraft(
      "B2B dealer · wallet_product=dealer_pro · wallet_txn=wtx_1 · wallet_cents=2499 · report_lang=en",
    );
    draft.workspace.sourceBlocks.auto_records.comments = "<p>Šis dīzelis ir tipisks TDI ar DPF.</p>";
    draft.workspace.sourceBlocks.auto_records.outvinReport = {
      vehicleInfo: {
        vinCode: VIN,
        model: "A5 35 TFSI",
        modelSeries: "",
        vehicleType: "",
        transmission: "",
        steeringSide: "",
        engineCode: "DLVB",
        engineNumber: "",
        body: "",
        drive: "",
        power: "",
        integrationLevel: "",
        currentILevel: "",
        developmentCode: "",
        modelCode: "",
        productionDate: "",
        firstRegistration: "",
        warrantyStartDate: "",
        countryRegion: "",
        color: "Black",
        colorCode: "",
        interior: "",
        interiorCode: "",
        fuel: "Petrol",
        displacement: "",
      },
      accidentCheck: "",
      stolenCheck: "",
      equipment: [],
    };
    draft.workspace.sourceBlocks.auto_records.oneautoIngest = {
      vinOverride: "",
      lastFetchedVin: VIN,
      fetchedAt: "2026-10-19T00:00:00.000Z",
      selectedProducts: ["oe_vin_lookup", "oe_service_history"],
      lastCostEur: "3.36",
      results: {
        oe_vin_lookup: { ok: true, payload: lookupPayload() },
        oe_service_history: { ok: true, payload: historyPayload() },
      },
      serviceTimelineOriginal: [{ date: "10.01.2024", odometer: "12000", place: "Riga", works: "Oil" }],
    };
    readDealerDataJob.mockResolvedValue({
      sessionId: SESSION,
      vin: VIN,
      status: "done",
      attempts: 1,
      createdAt: "2026-10-19T00:00:00.000Z",
      updatedAt: "2026-10-19T00:00:00.000Z",
      paidOutcomes: { oe_vin_lookup: "ok", oe_service_history: "ok" },
      oneautoResults: {
        oe_vin_lookup: { ok: true, payload: lookupPayload() },
        oe_service_history: { ok: true, payload: historyPayload() },
      },
    });
    readOrderDraft.mockResolvedValue(draft);
    generateSourceCommentWithAi.mockResolvedValue("35 TFSI benzīna motors DLVB.");

    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "manual", force: true });
    expect(r.status).toBe("done");
    expect(fetchOneautoProducts).not.toHaveBeenCalled();
    // Pretrunīgais komentārs + tukšais eļļas lauks.
    expect(generateSourceCommentWithAi).toHaveBeenCalledTimes(2);
    expect(patchOrderDraft.mock.calls.some((call) => {
      const comments = call[1]?.workspace?.sourceBlocks?.auto_records?.comments;
      return typeof comments === "string" && comments.includes("35 TFSI");
    })).toBe(true);
  });

  it("VIN Lookup 502 nebloķē vēsturi: Decoder; Decoder kļūda -> vēsture melnrakstā, dekodēšana atkārtosies", async () => {
    fetchOneautoProducts
      .mockResolvedValueOnce({
        costEur: "3.00",
        results: { oe_service_history: { ok: true, payload: historyPayload() } },
        display: { equipment: [], powertrain: [], serviceTimeline: [] },
      })
      .mockResolvedValueOnce({
        costEur: "0.00",
        results: { oe_vin_lookup: { ok: false, error: "http_502", httpStatus: 502, payload: null } },
        display: { equipment: [], powertrain: [], serviceTimeline: [] },
      })
      .mockRejectedValueOnce(new Error("timeout"));
    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "webhook" });
    expect(r).toMatchObject({ ok: false, status: "failed", reason: "vin_decode_failed" });
    expect(fetchOneautoProducts.mock.calls.map((c) => c[0].products[0])).toEqual([
      "oe_service_history",
      "oe_vin_lookup",
      "vin_decoder",
    ]);
    // Vēsture ierakstīta melnrakstā, komentāri ģenerēti.
    expect(
      patchOrderDraft.mock.calls.some(
        (call) => (call[1]?.workspace?.sourceBlocks?.auto_records?.serviceWorks ?? []).length > 0,
      ),
    ).toBe(true);
    expect(generateSourceCommentWithAi).toHaveBeenCalledTimes(2);
    const last = upsertDealerDataJob.mock.calls.at(-1)![1] as Record<string, unknown>;
    expect(last).toMatchObject({ status: "failed", aiGenerated: true });
    expect(String(last.error)).toMatch(/^vin_decode:/);
    expect(sendDealerDataAlertIfNeeded).toHaveBeenCalledWith(SESSION, { trigger: "webhook" });
  });

  it("retry pēc Decoder kļūdas: Lookup un vēsturi nepērk, tikai Decoder", async () => {
    readDealerDataJob.mockResolvedValue({
      sessionId: SESSION,
      vin: VIN,
      status: "failed",
      error: "vin_decode:timeout",
      attempts: 1,
      createdAt: "2026-10-19T00:00:00.000Z",
      updatedAt: "2026-10-19T00:00:00.000Z",
      paidOutcomes: { oe_service_history: "ok", oe_vin_lookup: "failed", vin_decoder: "failed" },
      oneautoResults: {
        oe_service_history: { ok: true, payload: historyPayload() },
        oe_vin_lookup: { ok: false, error: "http_502", payload: null },
        vin_decoder: { ok: false, error: "timeout", payload: null },
      },
    });
    fetchOneautoProducts.mockResolvedValueOnce({
      costEur: "0.18",
      results: { vin_decoder: { ok: true, payload: lookupPayload() } },
      display: { equipment: [], powertrain: [], serviceTimeline: [] },
    });
    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "cron" });
    expect(r.status).toBe("done");
    expect(fetchOneautoProducts).toHaveBeenCalledTimes(1);
    expect(fetchOneautoProducts.mock.calls[0]![0].products).toEqual(["vin_decoder"]);
  });

  it("LV: Opus pārbaude piemērota abiem komentāriem pirms ieraksta", async () => {
    readOrderDraft.mockResolvedValue(emptyDraft("Privātpersona"));
    fetchOneautoProducts
      .mockResolvedValueOnce({
        costEur: "3.00",
        results: { oe_service_history: { ok: true, payload: historyPayload() } },
        display: { equipment: [], powertrain: [], serviceTimeline: [] },
      })
      .mockResolvedValueOnce({
        costEur: "0.36",
        results: { oe_vin_lookup: { ok: true, payload: lookupPayload() } },
        display: { equipment: [], powertrain: [], serviceTimeline: [] },
      });
    generateSourceCommentWithAi.mockImplementation(async (opts: { targetField: string }) =>
      opts.targetField === "comments" ? "Dzinējs remontēts 2020. gadā." : "Ražotāja intervāls: 15 000 km / 12 mēn.",
    );
    reviewDealerCommentsWithOpus.mockImplementationOnce(async (args) => ({
      texts: Object.fromEntries(
        args.fields.map((f) => [f.id, f.text.replace("2020. gadā", "2024. gadā")]),
      ),
      applied: 1,
      ok: true,
    }));
    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "webhook" });
    expect(r.status).toBe("done");
    expect(reviewDealerCommentsWithOpus).toHaveBeenCalledTimes(1);
    const written = patchOrderDraft.mock.calls
      .map((c) => c[1]?.workspace?.sourceBlocks?.auto_records)
      .filter(Boolean)
      .at(-1);
    expect(written.comments).toContain("2024. gadā");
    expect(written.comments).toContain("<strong>Dzinējs</strong>");
    expect(written.oilChangeIntervalNotes).toContain("Ražotāja intervāls");
  });

  it("viens komentārs neizdodas -> failed ai_generation_failed (atkārtos tikai trūkstošo)", async () => {
    fetchOneautoProducts
      .mockResolvedValueOnce({
        costEur: "3.00",
        results: { oe_service_history: { ok: true, payload: historyPayload() } },
        display: { equipment: [], powertrain: [], serviceTimeline: [] },
      })
      .mockResolvedValueOnce({
        costEur: "0.36",
        results: { oe_vin_lookup: { ok: true, payload: lookupPayload() } },
        display: { equipment: [], powertrain: [], serviceTimeline: [] },
      });
    generateSourceCommentWithAi.mockImplementation(async (opts: { targetField: string }) => {
      if (opts.targetField === "oilChangeIntervalNotes") throw new Error("gemini_down");
      return "Komentārs.";
    });
    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "webhook" });
    expect(r).toMatchObject({ ok: false, reason: "ai_generation_failed" });
  });

  it("OneAuto 202 (apstrādē): ātrs atkārtojums, mēģinājums netiek skaitīts", async () => {
    fetchOneautoProducts.mockResolvedValueOnce({
      costEur: "0.00",
      results: { oe_service_history: { ok: false, error: "pending", payload: { status: "In Progress" } } },
      display: { equipment: [], powertrain: [], serviceTimeline: [] },
    });
    const before = Date.now();
    const r = await runDealerDataJob({ sessionId: SESSION, vin: VIN, trigger: "webhook" });
    expect(r.status).toBe("failed");
    const last = upsertDealerDataJob.mock.calls.at(-1)![1] as Record<string, unknown>;
    expect(last.attempts).toBe(0);
    const next = Date.parse(String(last.nextRetryAt));
    expect(next - before).toBeLessThan(6 * 60 * 1000);
  });
});
