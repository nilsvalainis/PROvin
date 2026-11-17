import { mkdtempSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { isFreeVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { probeThecarapi } from "@/lib/vin-scan/probes-extra";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { fetchThecarapiVinHistory } from "@/lib/vin-scan/thecarapi-api";
import { vinScanPipelineSourceIds } from "@/lib/vin-scan/catalog";
import type { ThecarapiDeps } from "@/lib/vin-scan/thecarapi-api";

const hit = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/history-hit.json"), "utf8"),
) as unknown;
const empty = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/history-empty.json"), "utf8"),
) as unknown;

let dir = "";

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "thecarapi-"));
  vi.stubEnv("VIN_SCAN_DIR", dir);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VIN_SCAN_DIR", dir);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
});

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function paidEnv(extra: Record<string, string> = {}): Record<string, string> {
  return {
    THECARAPI_API_KEY: "test-key",
    THECARAPI_ADMIN_ENABLED: "true",
    THECARAPI_VIN_SCAN_ENABLED: "",
    THECARAPI_BASE_URL: "https://api.thecarapi.com",
    THECARAPI_MONTHLY_CAP: "150",
    ...extra,
  };
}

function scripted(responses: Array<Response | Error>): {
  deps: ThecarapiDeps;
  calls: { url: string; init?: RequestInit }[];
  sleeps: number[];
} {
  const calls: { url: string; init?: RequestInit }[] = [];
  const sleeps: number[] = [];
  const queue = [...responses];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error("unexpected_fetch");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return {
    calls,
    sleeps,
    deps: {
      env: paidEnv(),
      fetch: fetchImpl,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    },
  };
}

function header(init: RequestInit | undefined, name: string): string {
  const headers = new Headers(init?.headers);
  return headers.get(name) ?? "";
}

describe("fetchThecarapiVinHistory", () => {
  it("200 ar ierakstiem", async () => {
    const { deps, calls } = scripted([jsonResponse(200, hit, { etag: "W/\"hit\"" })]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42871", deps);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.thecarapi.com/api/vin/WBA5R1C00LFH42871/history");
    expect(header(calls[0]?.init, "X-API-Key")).toBe("test-key");
    expect(header(calls[0]?.init, "cache-control") || calls[0]?.init?.cache).toBe("no-store");
    expect(result.httpStatus).toBe(200);
    expect(result.billable).toBe(true);
    expect(result.fromCache).toBe(false);
    expect(result.parse.status).toBe("found");
    expect(result.parse.auctions?.[0]?.venue).toBe("Openlane");
    expect(result.refs[0]).toMatchObject({ site: "openlane", id: "OL-55" });
  });

  it("200 tukšs", async () => {
    const { deps, calls } = scripted([jsonResponse(200, empty)]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42872", deps);
    expect(calls).toHaveLength(1);
    expect(result.parse).toMatchObject({ status: "none", summary: "nav ierakstu" });
    expect(result.billable).toBe(true);
  });

  it("401 un 403 neatkārto un nesaka atslēga nederīga/beigusies", async () => {
    const denied = scripted([jsonResponse(401, { error: "expired" })]);
    const expired = await fetchThecarapiVinHistory("WBA5R1C00LFH42873", denied.deps);
    expect(denied.calls).toHaveLength(1);
    expect(denied.sleeps).toEqual([]);
    expect(expired.parse).toMatchObject({ status: "unknown", summary: "atslēga nederīga/beigusies" });

    const revoked = scripted([jsonResponse(403, { error: "revoked" })]);
    const blocked = await fetchThecarapiVinHistory("WBA5R1C00LFH42874", revoked.deps);
    expect(revoked.calls).toHaveLength(1);
    expect(blocked.parse.summary).toBe("atslēga nederīga/beigusies");
  });

  it("429 nelasa vēlreiz un ieliek Retry-After", async () => {
    const { deps, calls, sleeps } = scripted([jsonResponse(429, { error: "throttled" }, { "retry-after": "30" })]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42875", deps);
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
    expect(result.parse.status).toBe("unknown");
    expect(result.parse.summary).toBe("limits");
    expect(result.parse.detail).toBe("Retry-After: 30");
    expect(result.billable).toBe(true);
  });

  it("500 atkārto vienu reizi pēc 2 s", async () => {
    const { deps, calls, sleeps } = scripted([
      jsonResponse(500, { error: "down" }),
      jsonResponse(200, empty),
    ]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42876", deps);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
    expect(result.parse.status).toBe("none");
    expect(result.httpStatus).toBe(200);
  });

  it("timeout atkārto vienu reizi un paliek timeout", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const { deps, calls, sleeps } = scripted([timeout, timeout]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42877", deps);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
    expect(result.parse).toMatchObject({ status: "timeout", summary: "Avots neatbildēja laikā" });
    expect(result.billable).toBe(false);
    expect(result.httpStatus).toBeNull();
  });

  it("otrais izsaukums ņem kešu un vairs nefetchē", async () => {
    const { deps, calls } = scripted([jsonResponse(200, hit)]);
    const first = await fetchThecarapiVinHistory("WBA5R1C00LFH42878", deps);
    const second = await fetchThecarapiVinHistory("WBA5R1C00LFH42878", deps);
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.parse.status).toBe("found");
    expect(calls).toHaveLength(1);
  });

  it("mēneša limits atsakās lokāli bez HTTP", async () => {
    const first = scripted([jsonResponse(200, empty)]);
    first.deps.env = paidEnv({ THECARAPI_MONTHLY_CAP: "1" });
    first.deps.now = () => new Date("2099-04-02T00:00:00.000Z");
    const opened = await fetchThecarapiVinHistory("WBA5R1C00LFH42879", first.deps);
    expect(opened.billable).toBe(true);
    expect(first.calls).toHaveLength(1);

    const second = scripted([jsonResponse(200, empty)]);
    second.deps.env = paidEnv({ THECARAPI_MONTHLY_CAP: "1" });
    second.deps.now = () => new Date("2099-04-02T00:00:00.000Z");
    second.deps.skipCache = true;
    const capped = await fetchThecarapiVinHistory("WBA5R1C00LFH42879", second.deps);
    expect(second.calls).toHaveLength(0);
    expect(capped.parse).toMatchObject({ status: "unknown", summary: "mēneša limits" });
    expect(capped.billable).toBe(false);
  });
});

describe("TheCarApi VIN SCAN slēdzis", () => {
  it("bez THECARAPI_VIN_SCAN_ENABLED nav cauruļvadā un zonde nefetchē", async () => {
    vi.stubEnv("THECARAPI_API_KEY", "test-key");
    vi.stubEnv("THECARAPI_VIN_SCAN_ENABLED", "");
    vi.stubEnv("THECARAPI_ADMIN_ENABLED", "");
    const seen: string[] = [];
    const prev = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
      if (url.includes("api.thecarapi.com")) seen.push(url);
      return prev(input, init);
    }) as typeof fetch;
    try {
      expect(vinScanPipelineSourceIds()).not.toContain("thecarapi_eu");
      expect(isFreeVinScanSourceId("thecarapi_eu")).toBe(false);
      const row = await probeThecarapi({
        vin: "WBA5R1C00LFH42880",
        plates: emptyVinScanPlates(),
        listingUrl: "",
      });
      expect(row.status).toBe("skipped");
      expect(row.summary).toBe("TheCarApi izslēgts (maksas)");
      expect(seen).toEqual([]);
    } finally {
      globalThis.fetch = prev;
    }
  });
});
