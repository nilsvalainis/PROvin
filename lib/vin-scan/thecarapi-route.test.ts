import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  getAdminSession: async () => true,
}));

import { POST } from "@/app/api/admin/sources/thecarapi/route";

const VIN = "WBA5R1C0XLFH42873";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/admin/sources/thecarapi", () => {
  it("bez THECARAPI_ADMIN_ENABLED atgriež 403 un nefetchē", async () => {
    vi.stubEnv("THECARAPI_API_KEY", "test-key");
    vi.stubEnv("THECARAPI_ADMIN_ENABLED", "");
    vi.stubEnv("THECARAPI_VIN_SCAN_ENABLED", "");
    const seen: string[] = [];
    const prev = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input instanceof Request ? input.url : String(input);
      if (url.includes("api.thecarapi.com")) seen.push(url);
      return prev(input, init);
    }) as typeof fetch;
    try {
      const res = await POST(
        new Request("http://localhost/api/admin/sources/thecarapi", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ vin: VIN }),
        }),
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe("thecarapi_disabled");
      expect(seen).toEqual([]);
    } finally {
      globalThis.fetch = prev;
    }
  });
});
