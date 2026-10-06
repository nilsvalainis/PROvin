import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { captchaProvider } from "@/lib/captcha-solver";
import { mntCaptchaSteps } from "@/lib/vin-sources/mnt-http";

describe("mntCaptchaSteps", () => {
  it("CapSolver standarta, M1, tad rezerves risinātāji ar atslēgu", () => {
    const anti = captchaProvider("anticaptcha", "anticaptcha-key-123");
    const two = captchaProvider("2captcha", "twocaptcha-key-123");
    expect(mntCaptchaSteps({ m1Enabled: true, fallbackProviders: [anti, two] })).toEqual([
      { variant: "standard" },
      { variant: "m1" },
      { provider: anti, variant: "standard" },
      { provider: two, variant: "standard" },
    ]);
  });

  it("bez M1 un bez rezervēm paliek tikai standarta CapSolver", () => {
    expect(mntCaptchaSteps({ m1Enabled: false, fallbackProviders: [] })).toEqual([{ variant: "standard" }]);
  });
});
