/**
 * 24.11 atskaites audits, 1. punkts: saskaņotība pirms PDF - brīdinājumi adminam (ne bloķēšana).
 * Testos tikai izdomāti dati.
 */
import { describe, expect, it } from "vitest";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { checkSourceConsistency, countSourceIssues } from "@/lib/source-consistency";

const NOW = Date.UTC(2026, 10, 25);

function blocks(patch: Record<string, unknown>): WorkspaceSourceBlocks {
  return mergeSourceBlocksWithDefaults(patch as unknown);
}

function mileageBlocks() {
  return blocks({
    csdd: {
      makeModel: "OPEL VIVARO",
      firstRegistration: "2020-12-09",
      mileageHistory: [
        { date: "10.09.2024", odometer: "160 120", country: "Latvija" },
        { date: "15.09.2026", odometer: "210 481", country: "Latvija" },
      ],
    },
  });
}

describe("(a) skaitļi un datumi AI tekstā eksistē datos", () => {
  it("210 426 km (datos 210 481 km) -> brīdinājums ar tuvāko rādījumu", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: mileageBlocks(),
      texts: [{ label: "carVertical komentārs", text: "Nobraukums pieaudzis līdz 210 426 km 2026. gada septembrī." }],
      nowMs: NOW,
    });
    const km = issues.find((i) => i.id === "ai_numbers_km");
    expect(km?.severity).toBe("warn");
    expect(km?.values[0]?.value).toContain("210 426 km");
    expect(km?.values[0]?.value).toContain("210 481 km");
  });

  it("precīzs rādījums, starpība starp rindām, apaļš un aptuvens skaitlis - nav brīdinājuma", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: mileageBlocks(),
      texts: [
        {
          label: "Nobraukums",
          text: "Pēdējais rādījums 210 481 km (15.09.2026). Divos gados nobraukti 50 361 km. Vidēji ~25 180 km gadā, tas ir 25 181 km gadā, kopā ap 200 000 km.",
        },
      ],
      nowMs: NOW,
    });
    expect(issues.some((i) => i.kind === "ai_numbers")).toBe(false);
  });

  it("datums, kura nav datos -> brīdinājums; ±1 diena - nav", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: mileageBlocks(),
      texts: [{ label: "Kopsavilkums", text: "Apskate 16.09.2026 bija kārtībā. Remonts 03.03.2025 nav apstiprināts." }],
      nowMs: NOW,
    });
    const d = issues.find((i) => i.id === "ai_numbers_date");
    expect(d?.values.map((v) => v.value.slice(0, 12))).toEqual(["«03.03.2025»"]);
  });
});

describe("(b) viena 1. reģistrācijas valsts", () => {
  function nlDe() {
    return blocks({
      csdd: { makeModel: "AUDI A3", firstRegistration: "2016-12-01", previousRegistrationCountry: "Vācija" },
      // 26.11: valsts no datēta ieraksta pie 1. reģistrācijas (CSDD iepriekšējā valsts vien to nenosaka).
      auto_records: { serviceHistory: [{ date: "10.12.2016", odometer: "15", country: "Vācija" }] },
      finnik: {
        timeline: [{ date: "01.12.2016", event: "Pirmā reģistrācija" }],
        mileage: [{ date: "01.12.2018", odometer: "40000" }],
      },
    });
  }

  it("1. lapā Vācija, AI kopsavilkums «pirmoreiz reģistrēta Nīderlandē» -> brīdinājums; «Vācijā» - nav", () => {
    const bad = checkSourceConsistency({
      sourceBlocks: nlDe(),
      texts: [{ label: "Kopsavilkums", text: "Automašīna pirmoreiz reģistrēta Nīderlandē 2016. gadā." }],
      nowMs: NOW,
    });
    const first = bad.find((i) => i.id === "ai_first_reg_country");
    expect(first?.severity).toBe("warn");
    expect(first?.values[0]).toEqual({ source: "1. lapa", value: "Vācija" });
    expect(first?.values[1]?.source).toBe("Kopsavilkums");
    const ok = checkSourceConsistency({
      sourceBlocks: nlDe(),
      texts: [{ label: "Kopsavilkums", text: "Automašīna pirmoreiz reģistrēta Vācijā 2016. gadā." }],
      nowMs: NOW,
    });
    expect(ok.some((i) => i.id === "ai_first_reg_country")).toBe(false);
  });

  it("26.11: tikai CSDD iepriekšējā valsts - 1. reģistrācijas valsts nav zināma, AI «pirmoreiz reģistrēta Austrijā» -> brīdinājums", () => {
    const sb = blocks({
      csdd: {
        makeModel: "BMW X5",
        firstRegistration: "2004-08-20",
        firstRegistrationLatvia: "2021-11-26",
        previousRegistrationCountry: "AUSTRIJA",
      },
    });
    const issues = checkSourceConsistency({
      sourceBlocks: sb,
      texts: [{ label: "Kopsavilkums", text: "Automašīna pirmoreiz reģistrēta Austrijā 2004. gadā." }],
      nowMs: NOW,
    });
    const first = issues.find((i) => i.id === "ai_first_reg_country");
    expect(first?.severity).toBe("warn");
    expect(first?.values[0]).toEqual({ source: "1. lapa", value: "Nav zināma" });
    expect(issues.some((i) => i.id === "first_reg_vs_csdd_prev")).toBe(false);
  });

  it("«pirmā reģistrācija Latvijā» nav pretruna", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: nlDe(),
      texts: [{ label: "CSDD", text: "Pirmā reģistrācija Latvijā 2021. gadā." }],
      nowMs: NOW,
    });
    expect(issues.some((i) => i.id === "ai_first_reg_country")).toBe(false);
  });
});

describe("(c) viens īpašnieku skaits", () => {
  it("kopsavilkums «piecus īpašniekus», cits bloks «3 īpašnieki» -> brīdinājums", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: blocks({ csdd: { makeModel: "AUDI A3" } }),
      texts: [
        { label: "Kopsavilkums", text: "Kopumā reģistros uzrādot piecus īpašniekus." },
        { label: "Riski", text: "Automašīnai bijuši 3 īpašnieki." },
      ],
      nowMs: NOW,
    });
    const o = issues.find((i) => i.id === "ai_owner_count_mismatch");
    expect(o?.values.map((v) => v.value).sort()).toEqual(["3 īpašnieki", "5 īpašnieki"]);
  });

  it("«Latvijā 2 īpašnieki» un «kopā 5 īpašnieki» nav pretruna", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: blocks({ csdd: { makeModel: "AUDI A3" } }),
      texts: [
        { label: "Kopsavilkums", text: "Kopā 5 īpašnieki." },
        { label: "CSDD", text: "Latvijā 2 īpašnieki." },
      ],
      nowMs: NOW,
    });
    expect(issues.some((i) => i.id === "ai_owner_count_mismatch")).toBe(false);
  });
});

describe("(d) 1. lapas izsoļu kartīte pret izsoļu sadaļu", () => {
  it("nav izsoļu ierakstu, bet ir arhīva foto -> brīdinājums", () => {
    const b = blocks({ csdd: { makeModel: "BMW 530D" } });
    b.cc_vin = {
      ...b.cc_vin,
      photos: [
        { id: "ih_ph_aaaaaaaaaaaaaaaaaaaaaaaa" },
        { id: "ih_ph_bbbbbbbbbbbbbbbbbbbbbbbb" },
      ],
      photoGroups: [],
    };
    const issues = checkSourceConsistency({ sourceBlocks: b, nowMs: NOW });
    const c = issues.find((i) => i.id === "cover_auctions_none_vs_photos");
    expect(c?.values[1]?.value).toBe("2 arhīva foto");
    expect(countSourceIssues(issues)).toBeGreaterThan(0);
  });

  it("bez foto - nav brīdinājuma", () => {
    const issues = checkSourceConsistency({ sourceBlocks: blocks({ csdd: { makeModel: "BMW 530D" } }), nowMs: NOW });
    expect(issues.some((i) => i.kind === "cover_auctions")).toBe(false);
  });
});
