import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchMntHttp = vi.fn();
const fetchMntRelay = vi.fn();
const isMntRelayConfigured = vi.fn();
const hasCaptchaSolverKey = vi.fn();
const isVinSourcesBrowserAllowed = vi.fn();

vi.mock("@/lib/vin-sources/mnt-http", () => ({
  fetchMntHttp: (...args: unknown[]) => fetchMntHttp(...args),
}));

vi.mock("@/lib/vin-sources/mnt-relay", () => ({
  fetchMntRelay: (...args: unknown[]) => fetchMntRelay(...args),
  isMntRelayConfigured: (...args: unknown[]) => isMntRelayConfigured(...args),
}));

vi.mock("@/lib/captcha-solver", () => ({
  hasCaptchaSolverKey: () => hasCaptchaSolverKey(),
}));

vi.mock("@/lib/vin-sources/browser", () => ({
  createVinSourceContext: vi.fn(),
  extractPageData: vi.fn(),
  humanMouse: vi.fn(),
  humanType: vi.fn(),
  isVinSourcesBrowserAllowed: () => isVinSourcesBrowserAllowed(),
  sleep: vi.fn(),
}));

vi.mock("@/lib/vin-sources/lkf-http", () => ({
  fetchLkfHttp: vi.fn(),
}));

import { emptyVinSourceResult } from "@/lib/vin-sources/types";
import { fetchMnt } from "@/lib/vin-sources/estonia";

const VIN = "U5YH6G17GNL050102";

describe("fetchMnt", () => {
  beforeEach(() => {
    fetchMntHttp.mockReset();
    fetchMntRelay.mockReset();
    isMntRelayConfigured.mockReset();
    hasCaptchaSolverKey.mockReset();
    isVinSourcesBrowserAllowed.mockReset();
    isVinSourcesBrowserAllowed.mockReturnValue(false);
  });

  it("bez releja env paliek vecais HTTP + CapSolver ceļš", async () => {
    isMntRelayConfigured.mockReturnValue(false);
    hasCaptchaSolverKey.mockReturnValue(true);
    const http = { ...emptyVinSourceResult("mnt_ee", VIN, "HTTP ok"), found: true, message: "HTTP ok" };
    fetchMntHttp.mockResolvedValue(http);
    await expect(fetchMnt(VIN)).resolves.toEqual(http);
    expect(fetchMntRelay).not.toHaveBeenCalled();
    expect(fetchMntHttp).toHaveBeenCalledOnce();
  });

  it("relejs found → rezultāts, bez CapSolver fallback", async () => {
    isMntRelayConfigured.mockReturnValue(true);
    hasCaptchaSolverKey.mockReturnValue(true);
    const found = { ...emptyVinSourceResult("mnt_ee", VIN, "Atrasts"), found: true, message: "Atrasts" };
    fetchMntRelay.mockResolvedValue({ kind: "result", result: found });
    await expect(fetchMnt(VIN)).resolves.toEqual(found);
    expect(fetchMntHttp).not.toHaveBeenCalled();
  });

  it("relejs not_found → found=false, bez CapSolver fallback", async () => {
    isMntRelayConfigured.mockReturnValue(true);
    const missing = emptyVinSourceResult("mnt_ee", VIN, "VIN nav Igaunijas transportlīdzekļu reģistrā");
    fetchMntRelay.mockResolvedValue({ kind: "result", result: missing });
    const out = await fetchMnt(VIN);
    expect(out.found).toBe(false);
    expect(out.message).toMatch(/nav Igaunijas/);
    expect(fetchMntHttp).not.toHaveBeenCalled();
  });

  it("relejs 502/503 unavailable → neatver 240 s CapSolver ķēdi", async () => {
    isMntRelayConfigured.mockReturnValue(true);
    hasCaptchaSolverKey.mockReturnValue(true);
    fetchMntRelay.mockResolvedValue({ kind: "unavailable", reason: "mnt.ee relejs ir aizņemts, mēģini vēlreiz" });
    const out = await fetchMnt(VIN);
    expect(out.found).toBe(false);
    expect(out.message).toMatch(/aizņemts/);
    expect(fetchMntHttp).not.toHaveBeenCalled();
  });
});
