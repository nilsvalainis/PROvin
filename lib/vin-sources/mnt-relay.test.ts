import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchMntRelay, isMntRelayConfigured, mntRelayToResult, type MntRelayResponse } from "@/lib/vin-sources/mnt-relay";

/** Īsta releja atbilde 2026-10-07 (U5YH6G17GNL050102, saīsināta). */
const FOUND: MntRelayResponse = {
  ok: true,
  vin: "U5YH6G17GNL050102",
  status: "found",
  cached: false,
  data: {
    found: true,
    header: {
      regMark: "986KDX",
      makeModel: "KIA PROCEED",
      vin: "U5YH6G17GNL050102",
    },
    pairs: [
      { label: "Esmane registreerimine", value: "15.11.2021" },
      { label: "Kategooria", value: "sõiduauto" },
      { label: "Kere värvus", value: "sinine" },
      { label: "Mootori võimsus", value: "150 kW" },
      { label: "Kütus", value: "Mootoribensiin" },
      { label: "Eestis registreerimine", value: "15.11.2021" },
    ],
    inspections: [
      {
        "Tegemise kuupäev": "06.11.2025",
        "Kehtib Kuni": "11.2027",
        "Ülevaatuspunkt": "Profdiagnostik OÜ (Paldiski mnt 102, Tallinn)",
        Liik: "Korraline",
        Saasted: "OK",
        "Muu varustus": "OK",
        "Raam, kere ja sellele kinnitatavad osad": "OK",
        "Veermik ja vedrustus": "OK",
        "Tuled, helkurid ja elektriseadmed": "OK",
        Nähtavus: "OK",
        Juhtimisseade: "OK",
        Pidurisüsteem: "OK",
        Identifitseerimine: "OK",
        "Ülevaatuse otsus": "OK - Tehniliselt korras",
      },
      {
        "Tegemise kuupäev": "15.11.2021",
        "Kehtib Kuni": "11.2025",
        "Ülevaatuspunkt": "Transpordiamet",
        Liik: "Korraline",
        Saasted: "OK",
        "Muu varustus": "OK",
        "Raam, kere ja sellele kinnitatavad osad": "OK",
        "Veermik ja vedrustus": "OK",
        "Tuled, helkurid ja elektriseadmed": "OK",
        Nähtavus: "OK",
        Juhtimisseade: "OK",
        Pidurisüsteem: "OK",
        Identifitseerimine: "OK",
        "Ülevaatuse otsus": "OK - Tehniliselt korras",
      },
    ],
    operations: [
      { date: "18.05.2026", action: "Reg.märk kaotatud/varastatud, Kustutamine riigist välja" },
      { date: "15.11.2021", action: "Registreerimine Eestis, Numbrimärk" },
      { date: "15.11.2021", action: "Registreerimiseelne nõuete kontroll" },
    ],
    mileage: [
      { date: "2021-11-15", odometerKm: 10 },
      { date: "2025-11-06", odometerKm: 81312 },
    ],
    tables: [
      {
        headers: ["Kuupäev", "Toiming"],
        rows: [
          ["18.05.2026", "Reg.märk kaotatud/varastatud, Kustutamine riigist välja"],
          ["15.11.2021", "Registreerimine Eestis, Numbrimärk"],
          ["15.11.2021", "Registreerimiseelne nõuete kontroll"],
        ],
      },
    ],
    page: {
      text: "986KDX KIA PROCEED VIN: U5YH6G17GNL050102 Sõiduki põhiandmed Esmane registreerimine: 15.11.2021 Kustutamine riigist välja",
      tables: [
        {
          headers: ["Kuupäev", "Toiming"],
          rows: [
            ["18.05.2026", "Reg.märk kaotatud/varastatud, Kustutamine riigist välja"],
            ["15.11.2021", "Registreerimine Eestis, Numbrimärk"],
            ["15.11.2021", "Registreerimiseelne nõuete kontroll"],
          ],
        },
      ],
      pairs: [
        { label: "Esmane registreerimine", value: "15.11.2021" },
        { label: "Kategooria", value: "sõiduauto" },
        { label: "Kere värvus", value: "sinine" },
        { label: "Mootori võimsus", value: "150 kW" },
        { label: "Kütus", value: "Mootoribensiin" },
        { label: "Eestis registreerimine", value: "15.11.2021" },
      ],
    },
  },
};

const RELAY_ENV = {
  MNT_RELAY_URL: "https://relay.example/mnt/lookup",
  MNT_RELAY_TOKEN: "t",
} as unknown as NodeJS.ProcessEnv;

describe("isMntRelayConfigured", () => {
  it("prasa abus env", () => {
    expect(isMntRelayConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isMntRelayConfigured({ MNT_RELAY_URL: "https://x" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isMntRelayConfigured({ MNT_RELAY_TOKEN: "t" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isMntRelayConfigured(RELAY_ENV)).toBe(true);
  });
});

describe("mntRelayToResult", () => {
  it("found: nobraukums no grafika, apskates un toimingi laika joslā", () => {
    const r = mntRelayToResult(FOUND.vin, FOUND);
    expect(r.found).toBe(true);
    expect(r.source).toBe("mnt_ee");
    expect(r.mileage.map((m) => [m.date, m.odometer])).toEqual([
      ["2025-11-06", "81312"],
      ["2021-11-15", "10"],
    ]);
    expect(r.timeline.some((t) => t.date === "2026-05-18")).toBe(true);
    expect(r.timeline.some((t) => t.date === "2025-11-06" && t.odometer === "81312")).toBe(true);
    expect(r.notes.join(" ")).toMatch(/2026|18\.05\.2026/);
    expect(r.ownersSummary).toMatch(/986KDX/);
    expect(r.statusRecords).toMatch(/11\.2027/);
  });

  it("not_found → found=false", () => {
    const r = mntRelayToResult("JN1TANT31U0000001", {
      ok: true,
      vin: "JN1TANT31U0000001",
      status: "not_found",
      data: { found: false, page: null },
    });
    expect(r.found).toBe(false);
    expect(r.message).toMatch(/nav Igaunijas/);
  });
});

describe("fetchMntRelay", () => {
  it("bez env → unavailable", async () => {
    expect((await fetchMntRelay("U5YH6G17GNL050102", "", { env: {} as NodeJS.ProcessEnv })).kind).toBe("unavailable");
  });

  it("captcha_rejected HTTP 502 → unavailable (ne found/not_found)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, vin: "X", status: "captcha_rejected", error: "rejected", data: null }), {
        status: 502,
      }),
    );
    const out = await fetchMntRelay("U5YH6G17GNL050102", "", { env: RELAY_ENV });
    expect(out.kind).toBe("unavailable");
    if (out.kind === "unavailable") expect(out.reason).toMatch(/captcha_rejected/);
    spy.mockRestore();
  });

  it("HTTP 401 → unavailable (tokens)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "unauthorized", data: null }), { status: 401 }),
    );
    const out = await fetchMntRelay("U5YH6G17GNL050102", "", { env: RELAY_ENV });
    expect(out.kind).toBe("unavailable");
    if (out.kind === "unavailable") expect(out.reason).toMatch(/tokenu/);
    spy.mockRestore();
  });

  it("HTTP 503 → unavailable (aizņemts)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "busy", data: null }), { status: 503 }),
    );
    const out = await fetchMntRelay("U5YH6G17GNL050102", "", { env: RELAY_ENV });
    expect(out.kind).toBe("unavailable");
    if (out.kind === "unavailable") expect(out.reason).toMatch(/aizņemts/);
    spy.mockRestore();
  });

  it("HTTP 400 → result, found=false (nederīgs VIN, nav kļūda tīklā)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "invalid vin", data: null }), { status: 400 }),
    );
    const out = await fetchMntRelay("BAD", "", { env: RELAY_ENV });
    expect(out.kind).toBe("result");
    if (out.kind === "result") {
      expect(out.result.found).toBe(false);
      expect(out.result.message).toMatch(/Nederīgs VIN/);
    }
    spy.mockRestore();
  });

  it("not_found → result, found=false", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          vin: "JN1TANT31U0000001",
          status: "not_found",
          data: { found: false, message: "Sisestatud andmetega sõidukit registris ei ole", page: null },
        }),
        { status: 200 },
      ),
    );
    const out = await fetchMntRelay("JN1TANT31U0000001", "", { env: RELAY_ENV });
    expect(out.kind).toBe("result");
    if (out.kind === "result") {
      expect(out.result.found).toBe(false);
      expect(out.result.message).toMatch(/nav Igaunijas/);
    }
    spy.mockRestore();
  });

  it("found → result", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(FOUND), { status: 200 }));
    const out = await fetchMntRelay(FOUND.vin, "", { env: RELAY_ENV });
    expect(out.kind).toBe("result");
    if (out.kind === "result") expect(out.result.found).toBe(true);
    spy.mockRestore();
  });
});
