import { describe, expect, it } from "vitest";
import { buildCompanyVerifyReport, type CompanyVerifyView } from "@/lib/b2b-company-verify";
import {
  COMPANY_VERIFY_CLIENT_TIMEOUT_MS,
  companyVerifyDecisionError,
  companyVerifyLoadError,
  requestCompanyVerify,
  runCompanyVerifyPanelAction,
} from "@/lib/b2b-company-verify-client";
import { FIXTURE_GOOD_INPUT, fixtureSourcesGood } from "@/lib/b2b-company-verify-fixtures";

const PARTNER_ID = "ptr_0123456789abcdef";

function sampleView(decision: CompanyVerifyView["decision"] = "pending"): CompanyVerifyView {
  return {
    kind: "partner",
    id: PARTNER_ID,
    input: FIXTURE_GOOD_INPUT,
    report: buildCompanyVerifyReport(FIXTURE_GOOD_INPUT, fixtureSourcesGood(), new Date("2026-11-06T08:00:00Z")),
    decision,
    decidedAt: decision === "pending" ? null : "2026-11-06T08:01:00.000Z",
    cached: false,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hangingFetch(): {
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;
  release: () => void;
} {
  let release = () => {};
  const hang = new Promise<Response>((resolve) => {
    release = () => resolve(jsonResponse({ error: "late" }, 504));
  });
  return { fetchImpl: () => hang, release };
}

describe("company verify client timeout and errors", () => {
  it("keeps the browser timeout above one UR/VIES fetch and below a hung Safari wait", () => {
    expect(COMPANY_VERIFY_CLIENT_TIMEOUT_MS).toBeGreaterThanOrEqual(16_000);
    expect(COMPANY_VERIFY_CLIENT_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it("loads a report from GET and posts refresh/decision bodies", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const view = sampleView();
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true, ...view });
    };

    const loaded = await requestCompanyVerify({ kind: "partner", id: PARTNER_ID, fetchImpl });
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.view.report.overall).toBe("derigs");
    expect(calls[0]?.url).toContain("kind=partner");
    expect(calls[0]?.init?.method ?? "GET").toBe("GET");

    await requestCompanyVerify({ kind: "partner", id: PARTNER_ID, refresh: true, fetchImpl });
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      kind: "partner",
      id: PARTNER_ID,
      refresh: true,
    });

    await requestCompanyVerify({ kind: "partner", id: PARTNER_ID, decision: "approved", fetchImpl });
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({
      kind: "partner",
      id: PARTNER_ID,
      decision: "approved",
    });
  });

  it("surfaces 4xx/5xx API errors instead of swallowing them", async () => {
    const unauthorized = await requestCompanyVerify({
      kind: "partner",
      id: PARTNER_ID,
      fetchImpl: async () => jsonResponse({ error: "unauthorized" }, 401),
    });
    expect(unauthorized).toEqual({ ok: false, error: "Pārbaudi neizdevās ielādēt (unauthorized)." });

    const failed = await requestCompanyVerify({
      kind: "partner",
      id: PARTNER_ID,
      decision: "rejected",
      fetchImpl: async () => jsonResponse({ error: "not_found" }, 404),
    });
    expect(failed).toEqual({ ok: false, error: "Lēmumu neizdevās saglabāt (not_found)." });

    const server = await requestCompanyVerify({
      kind: "partner",
      id: PARTNER_ID,
      refresh: true,
      fetchImpl: async () => new Response("<html>oops</html>", { status: 502 }),
    });
    expect(server).toEqual({ ok: false, error: "Pārbaudi neizdevās ielādēt." });
  });

  it("maps a network failure to a visible load/decision error", async () => {
    const load = await requestCompanyVerify({
      kind: "partner",
      id: PARTNER_ID,
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(load.ok).toBe(false);
    if (!load.ok) expect(load.error).toBe("Pārbaudi neizdevās ielādēt.");

    const decide = await requestCompanyVerify({
      kind: "partner",
      id: PARTNER_ID,
      decision: "approved",
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(decide.ok).toBe(false);
    if (!decide.ok) expect(decide.error).toBe("Lēmumu neizdevās saglabāt.");
  });

  it("aborts a hanging fetch even when AbortSignal is ignored", async () => {
    const hang = hangingFetch();
    const started = Date.now();
    try {
      const result = await requestCompanyVerify({
        kind: "partner",
        id: PARTNER_ID,
        refresh: true,
        timeoutMs: 40,
        fetchImpl: hang.fetchImpl,
      });
      expect(Date.now() - started).toBeLessThan(1500);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("Pārbaudes pieprasījums noildza. Mēģini vēlreiz.");
    } finally {
      hang.release();
    }
  });

  it("aborts a hanging decision fetch", async () => {
    const hang = hangingFetch();
    try {
      const result = await requestCompanyVerify({
        kind: "partner",
        id: PARTNER_ID,
        decision: "approved",
        timeoutMs: 40,
        fetchImpl: hang.fetchImpl,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("Lēmuma pieprasījums noildza. Mēģini vēlreiz.");
    } finally {
      hang.release();
    }
  });
});

describe("company verify panel busy reset", () => {
  it("clears busy after timeout, 4xx, network fail and success", async () => {
    const hang = hangingFetch();
    const cases: {
      name: string;
      request: () => ReturnType<typeof requestCompanyVerify>;
      expectError: boolean;
    }[] = [
      {
        name: "timeout",
        request: () =>
          requestCompanyVerify({
            kind: "partner",
            id: PARTNER_ID,
            refresh: true,
            timeoutMs: 30,
            fetchImpl: hang.fetchImpl,
          }),
        expectError: true,
      },
      {
        name: "401",
        request: () =>
          requestCompanyVerify({
            kind: "partner",
            id: PARTNER_ID,
            decision: "approved",
            fetchImpl: async () => jsonResponse({ error: "unauthorized" }, 401),
          }),
        expectError: true,
      },
      {
        name: "network",
        request: () =>
          requestCompanyVerify({
            kind: "partner",
            id: PARTNER_ID,
            fetchImpl: async () => {
              throw new TypeError("Failed to fetch");
            },
          }),
        expectError: true,
      },
      {
        name: "success",
        request: () =>
          requestCompanyVerify({
            kind: "partner",
            id: PARTNER_ID,
            decision: "rejected",
            fetchImpl: async () => jsonResponse({ ok: true, ...sampleView("rejected") }),
          }),
        expectError: false,
      },
    ];

    try {
      for (const row of cases) {
        const busyLog: boolean[] = [];
        let error = "";
        let view: CompanyVerifyView | null = null;
        await runCompanyVerifyPanelAction({
          request: row.request,
          setBusy: (busy) => {
            busyLog.push(busy);
          },
          setError: (next) => {
            error = next;
          },
          onView: (next) => {
            view = next;
          },
          unexpectedError: row.name === "success" ? companyVerifyDecisionError : companyVerifyLoadError,
        });
        expect(busyLog[0], row.name).toBe(true);
        expect(busyLog.at(-1), row.name).toBe(false);
        if (row.expectError) {
          expect(error, row.name).not.toBe("");
          expect(view, row.name).toBeNull();
        } else {
          expect(error, row.name).toBe("");
          expect(view, row.name).not.toBeNull();
        }
      }
    } finally {
      hang.release();
    }
  });

  it("still clears busy if onView throws after a successful response", async () => {
    const busyLog: boolean[] = [];
    let error = "";
    await runCompanyVerifyPanelAction({
      request: async () => ({ ok: true, view: sampleView("approved") }),
      setBusy: (busy) => {
        busyLog.push(busy);
      },
      setError: (next) => {
        error = next;
      },
      onView: () => {
        throw new Error("router_refresh_failed");
      },
      unexpectedError: companyVerifyDecisionError,
    });
    expect(busyLog.at(-1)).toBe(false);
    expect(error).toBe("Lēmumu neizdevās saglabāt.");
  });
});
