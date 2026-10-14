import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("JoJ USA vārdnīcas", () => {
  it("lapo /usa/damages un /usa/titles, kešo ilgtermiņā", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "joj-dict-"));
    vi.stubEnv("VIN_SCAN_DIR", dir);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const { loadJojNameDict } = await import("@/lib/vin-scan/joj-dicts");
    const urls: string[] = [];
    const getJson = vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes("/usa/damages") && url.includes("page=1")) {
        return {
          status: 200,
          json: {
            data: [{ id: 37, name: "Side" }],
            next_page_url: "https://carstat-copart-iaai.jojapi.net/usa/damages?page=2",
          },
        };
      }
      if (url.includes("/usa/damages") && url.includes("page=2")) {
        return { status: 200, json: { data: [{ id: 3, name: "Front End" }], next_page_url: null } };
      }
      if (url.includes("/usa/titles")) {
        return { status: 200, json: { data: [{ id: 12, code: "SAL", name: "Salvage" }], next_page_url: "" } };
      }
      return { status: 404, json: {} };
    });
    const first = await loadJojNameDict({
      baseUrl: "https://carstat-copart-iaai.jojapi.net",
      getJson,
      skipCache: true,
    });
    expect(first.damages).toEqual({ "37": "Side", "3": "Front End" });
    expect(first.titles).toEqual({ "12": "Salvage" });
    expect(getJson).toHaveBeenCalledTimes(3);
    const second = await loadJojNameDict({
      baseUrl: "https://carstat-copart-iaai.jojapi.net",
      getJson,
    });
    expect(second.damages["37"]).toBe("Side");
    expect(getJson).toHaveBeenCalledTimes(3);
    await rm(dir, { recursive: true, force: true });
  });
});
