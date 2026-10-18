import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOneautoProducts } from "@/lib/oneauto-api";
import { applyOneautoToAutoRecords, emptyOneautoIngest } from "@/lib/oneauto-to-auto-records";
import { collectOemOneautoPayloads, oemDisplayFromRawPayloads } from "@/lib/pdf-dealer-oem";
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";

const VIN = "WVWZZZAUZFW000001";

/** OneAuto dokumentācijas OE Build Sheet (Europe) parauga atbilde. */
const EUROPE_BUILD_SHEET = {
  success: true,
  result: {
    manufactured_date: "2015-03-19",
    delivered_date: "2020-03-01",
    oem_colour_desc: "Metallic mythical black (0E)",
    oem_interior_trim_desc: "Soul (black) (QF)",
    oem_engine_desc: "CULB (D64 : 4-cylinder SI engine 2.0 l/132 kW (16V) turbo FSI)",
    oem_transmission_type_desc: "PUZ (G1D : 7-speed automatic transmission)",
    oem_drivetrain_desc: "All-wheel drive",
    oem_wheel_desc: "20 Inch Wheel",
    options: [
      { factory_code: "9AK", factory_desc: "AIR CONDITIONING", additional_desc: "Automatic, 2-zone" },
      { factory_code: "PR3L", factory_desc: "PANORAMIC ROOF" },
    ],
  },
};

describe("OE Build Sheet (Europe) no API līdz dīlera laukiem un PDF", () => {
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv("ONEAUTO_API_KEY", "test-key");
    vi.stubEnv("ONEAUTO_API_BASE_URL", "");
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        calls.push(url);
        n += 1;
        if (n === 1) {
          return new Response(JSON.stringify({ success: true, result: null, message: "processing" }), {
            status: 202,
          });
        }
        return new Response(JSON.stringify(EUROPE_BUILD_SHEET), { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sauc /v2 ar VIN, gaida 202, ielādē opcijas, krāsu un dzinēju", async () => {
    const pending = fetchOneautoProducts({ vin: VIN, products: ["oe_build_sheet"] });
    await vi.runAllTimersAsync();
    const fetched = await pending;

    expect(calls).toHaveLength(2);
    for (const url of calls) {
      const u = new URL(url);
      expect(u.origin + u.pathname).toBe("https://api.oneautoapi.com/oneauto/oebuildsheeteuropefromvin/v2");
      expect(u.searchParams.get("vehicle_identification_number")).toBe(VIN);
    }

    const result = fetched.results.oe_build_sheet;
    expect(result).toMatchObject({ ok: true, httpStatus: 200 });
    expect(fetched.costCents).toBe(195);

    const equip = fetched.display.equipment.map((r) => `${r.label} ${r.value}`).join("\n");
    expect(equip).toMatch(/9AK AIR CONDITIONING\. Automatic, 2-zone/);
    expect(equip).toMatch(/PR3L PANORAMIC ROOF/);
    const pt = fetched.display.powertrain.map((r) => `${r.label}: ${r.value}`).join("\n");
    expect(pt).toMatch(/CULB/);
    expect(pt).toMatch(/Metallic mythical black \(0E\)/);

    const ingest = {
      ...emptyOneautoIngest(),
      lastFetchedVin: VIN,
      selectedProducts: ["oe_build_sheet" as const],
      results: fetched.results,
    };
    const records = applyOneautoToAutoRecords({}, { display: fetched.display, ingest });
    const codes = records.outvinReport?.equipment.map((e) => e.code) ?? [];
    expect(codes).toEqual(expect.arrayContaining(["9AK", "PR3L"]));

    const payloads = collectOemOneautoPayloads(records as AutoRecordsBlockState, null);
    const pdfDisplay = oemDisplayFromRawPayloads(payloads);
    expect(pdfDisplay.equipment.length).toBe(2);
  });
});
