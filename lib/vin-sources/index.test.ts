import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const hasCaptchaSolverKey = vi.fn();
const isMntRelayConfigured = vi.fn();

vi.mock("@/lib/captcha-solver", () => ({
  hasCaptchaSolverKey: () => hasCaptchaSolverKey(),
}));

vi.mock("@/lib/vin-sources/mnt-relay", () => ({
  isMntRelayConfigured: () => isMntRelayConfigured(),
  fetchMntRelay: vi.fn(),
}));

vi.mock("@/lib/vin-sources/estonia", () => ({
  fetchMnt: vi.fn(),
  fetchLkf: vi.fn(),
}));

vi.mock("@/lib/vin-sources/carinfo", () => ({ fetchCarInfo: vi.fn() }));
vi.mock("@/lib/vin-sources/tjekbil", () => ({ fetchTjekbil: vi.fn() }));
vi.mock("@/lib/vin-sources/browser", () => ({
  isVinSourcesBrowserAllowed: () => false,
  VIN_SOURCES_BROWSER_UNAVAILABLE: "browser off",
}));

import { vinSourceNeedsBrowser } from "@/lib/vin-sources";

describe("vinSourceNeedsBrowser", () => {
  it("mnt_ee ar releju nevajag pārlūku pat bez CapSolver", () => {
    hasCaptchaSolverKey.mockReturnValue(false);
    isMntRelayConfigured.mockReturnValue(true);
    expect(vinSourceNeedsBrowser("mnt_ee")).toBe(false);
  });

  it("lkf_ee paliek atkarīgs tikai no CapSolver", () => {
    hasCaptchaSolverKey.mockReturnValue(false);
    isMntRelayConfigured.mockReturnValue(true);
    expect(vinSourceNeedsBrowser("lkf_ee")).toBe(true);
    hasCaptchaSolverKey.mockReturnValue(true);
    expect(vinSourceNeedsBrowser("lkf_ee")).toBe(false);
  });

  it("mnt_ee bez releja un bez CapSolver joprojām prasa pārlūku", () => {
    hasCaptchaSolverKey.mockReturnValue(false);
    isMntRelayConfigured.mockReturnValue(false);
    expect(vinSourceNeedsBrowser("mnt_ee")).toBe(true);
  });
});
