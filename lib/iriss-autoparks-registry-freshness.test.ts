import { describe, expect, it } from "vitest";
import { lvDaysAccusative, registryFreshness, registryImportStampFromMeta } from "@/lib/iriss-autoparks-registry-freshness";

// 17.11.2026 22:00 Rīgā (UTC+2).
const NOW = new Date("2026-11-17T20:00:00Z");

describe("CSDD reģistra svaigums", () => {
  it("šodienas nolasījums - zaļš ar importa laiku Rīgā", () => {
    const f = registryFreshness({ registryDate: "2026-11-17", importedAt: "2026-11-17T01:41:00Z" }, NOW);
    expect(f).toEqual({ tone: "ok", ageDays: 0, label: "šodien 03:41", lastLabel: "17.11. 03:41" });
  });

  it("vakar - vēl zaļš", () => {
    const f = registryFreshness({ registryDate: "2026-11-16", importedAt: "2026-11-16T01:41:00Z" }, NOW);
    expect(f.tone).toBe("ok");
    expect(f.label).toBe("vakar 03:41");
  });

  it("2-7 dienas - dzeltens, 8+ - sarkans", () => {
    expect(registryFreshness({ registryDate: "2026-11-15", importedAt: "" }, NOW)).toMatchObject({ tone: "warn", ageDays: 2, label: "pirms 2 d. (15.11.)" });
    expect(registryFreshness({ registryDate: "2026-11-10", importedAt: "" }, NOW).tone).toBe("warn");
    expect(registryFreshness({ registryDate: "2026-11-09", importedAt: "" }, NOW)).toMatchObject({ tone: "bad", ageDays: 8 });
  });

  it("vecumu skaita no nolasījuma, ne no importa (vecs fails importēts šodien)", () => {
    const f = registryFreshness({ registryDate: "2026-10-28", importedAt: "2026-11-17T04:40:00Z" }, NOW);
    expect(f).toMatchObject({ tone: "bad", ageDays: 20, label: "pirms 20 d. (28.10.)", lastLabel: "28.10." });
  });

  it("dienas robeža pēc Rīgas laika, ne UTC", () => {
    // 00:30 Rīgā 18.11 = 22:30 UTC 17.11; nolasījums 17.11 -> vakar.
    expect(registryFreshness({ registryDate: "2026-11-17", importedAt: "" }, new Date("2026-11-17T22:30:00Z")).label).toBe("vakar");
  });

  it("bez nolasījuma datuma ņem importa brīdi; bez abiem - nav datu", () => {
    expect(registryFreshness({ registryDate: "", importedAt: "2026-11-17T01:41:00Z" }, NOW).label).toBe("šodien 03:41");
    expect(registryFreshness(null, NOW)).toMatchObject({ tone: "none", ageDays: null, label: "nav datu" });
    expect(registryFreshness({ registryDate: "x", importedAt: "y" }, NOW).tone).toBe("none");
  });

  it("dienu locījums joslai", () => {
    expect(lvDaysAccusative(20)).toBe("20 dienas");
    expect(lvDaysAccusative(21)).toBe("21 dienu");
    expect(lvDaysAccusative(11)).toBe("11 dienas");
  });

  it("no importa atzīmes paņem tikai datumus", () => {
    const meta = { file: "registrs-auto.json", contentHash: "abc", registryDate: "2026-10-28", importedAt: "2026-10-28T09:14:00Z", unmatched: 3 };
    expect(registryImportStampFromMeta(meta)).toEqual({ registryDate: "2026-10-28", importedAt: "2026-10-28T09:14:00Z" });
    expect(registryImportStampFromMeta(null)).toBeNull();
    expect(registryImportStampFromMeta({ file: "x" })).toBeNull();
  });
});
