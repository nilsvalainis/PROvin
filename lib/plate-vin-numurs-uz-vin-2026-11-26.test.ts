/**
 * 26.11.2026 «Dīlera dati» ar numurzīmi EB5020: CSDD VPN pārslēdzās (Idle Timeout) tieši pasūtījuma
 * sekundē, relejs atdeva 502, VIN netika iegūts un ielase klusi apstājās («Nav VIN»).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { dealerDataJobBelongsInSweepIndex } from "@/lib/dealer-data-job-merge";
import {
  dealerDataAlertText,
  dealerNoVinAutoRetryable,
  describeDealerDataJob,
  normalizeDealerDataJob,
} from "@/lib/dealer-data-job-types";
import { fetchCsddTechData, isCsddTransientFailure } from "@/lib/csdd-tech-data";
import { resetVinFetchDedupe } from "@/lib/vin-fetch-dedupe";
import { orderVinPlateFailLabel, parseOrderVinPlateResolution } from "@/lib/order-vin-plate-resolution";

const NOW = Date.parse("2026-11-26T08:20:00.000Z");
const base = { sessionId: "cs_x", vin: "", status: "no_vin" as const, attempts: 0, plate: "EB5020", createdAt: "2026-11-26T08:05:36.470Z", updatedAt: "2026-11-26T08:05:37.949Z" };

describe("numurzīme → VIN: statusi adminā", () => {
  it("sarkanais teksts: neatrasts vs CSDD nesasniedzams", () => {
    expect(describeDealerDataJob({ ...base, error: "vin_not_found" })).toBe("CSDD neatrada VIN numuram EB5020");
    const transient = { ...base, error: "csdd_unreachable", plateAttempts: 1 };
    expect(dealerNoVinAutoRetryable(transient, NOW)).toBe(true);
    expect(describeDealerDataJob(transient)).toContain("CSDD nebija sasniedzams - VIN numuram EB5020");
    expect(orderVinPlateFailLabel("EB5020", "not_found")).toBe("CSDD neatrada VIN numuram EB5020");
    expect(orderVinPlateFailLabel("EB5020", "unreachable")).toBe("CSDD nebija sasniedzams - VIN numuram EB5020 nav iegūts");
    expect(dealerDataAlertText("no_vin", transient).body).toContain("atkārtos automātiski");
  });

  it("cron atkārto tikai pārejošu kļūdu, līdz griestiem, ne atmaksātu un ne vecu darbu", () => {
    const t = { ...base, error: "csdd_unreachable", plateAttempts: 1 };
    expect(dealerDataJobBelongsInSweepIndex(t)).toBe(dealerNoVinAutoRetryable(t));
    expect(dealerNoVinAutoRetryable({ ...t, error: "vin_not_found" }, NOW)).toBe(false);
    expect(dealerNoVinAutoRetryable({ ...t, plateAttempts: 3 }, NOW)).toBe(false);
    expect(
      dealerNoVinAutoRetryable({ ...t, refund: { kind: "credit", amountCents: 2499, at: "x", stripeRefundId: "credit_1" } } as never, NOW),
    ).toBe(false);
    expect(dealerNoVinAutoRetryable({ ...t, createdAt: "2026-11-20T08:00:00.000Z" }, NOW)).toBe(false);
    // Vecais ieraksts ar ziņu tekstu (pirms labojuma) arī ir pārejošs.
    expect(dealerNoVinAutoRetryable({ ...t, error: "CSDD neatbildēja (HTTP 502)" }, NOW)).toBe(true);
  });

  it("plateAttempts un failKind izdzīvo normalizāciju", () => {
    expect(normalizeDealerDataJob({ ...base, plateAttempts: 2 }, "cs_x")?.plateAttempts).toBe(2);
    expect(
      parseOrderVinPlateResolution({ plate: "eb5020", status: "failed", failKind: "unreachable", attempts: 3, updatedAt: "x" }),
    ).toMatchObject({ plate: "EB5020", failKind: "unreachable", attempts: 3 });
  });
});

describe("CSDD kešs: pārejoša kļūda netiek turēta 60 s", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetVinFetchDedupe();
  });

  it("502 → nākamais vaicājums iet uz CSDD no jauna; veiksmīga atbilde paliek kešā", async () => {
    vi.stubEnv("CSDD_RELAY_URL", "https://relay.invalid");
    const xml = "<TL_DATI><RN>EB5020</RN><VIN>WVWZZZ1JZ3W386752</VIN></TL_DATI>";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad", { status: 502 }))
      .mockResolvedValue(new Response(xml, { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchCsddTechData("EB5020");
    expect(isCsddTransientFailure(first)).toBe(true);
    const second = await fetchCsddTechData("EB5020");
    expect(second.found).toBe(true);
    const third = await fetchCsddTechData("EB5020");
    expect(third.found).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("«netika atrasts» nav pārejoša kļūda", () => {
    expect(isCsddTransientFailure({ found: false, message: "CSDD reģistrā šāds numurs netika atrasts" })).toBe(false);
    expect(isCsddTransientFailure({ found: false, message: "Neizdevās sasniegt CSDD releju" })).toBe(true);
    expect(isCsddTransientFailure({ found: false, message: "CSDD pieprasījums noildza" })).toBe(true);
  });
});
