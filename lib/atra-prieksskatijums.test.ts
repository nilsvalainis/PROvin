import { describe, expect, it } from "vitest";

import { atraStoryScore, atraSummaryText, buildAtraFacts, type AtraFactRow } from "@/lib/atra-parbaude-facts";
import { atraPreviewPhotoSources, buildAtraPreviews } from "@/lib/atra-prieksskatijums";
import { AUTODNA_PENDING_SUMMARY } from "@/lib/vin-scan/autodna-precheck";

const VIN = "WAUZZZ8K4EA139196";

const AUTODNA_DETAIL = [
  "Kopā: 31",
  "Auto: Audi A4 Allroad",
  "Transportlīdzekļa tehniskie dati: ir · 10",
  "Transportlīdzekļa vēsture: ir · 5",
  "Auto arhīva fotogrāfijas: nav · 0",
  "Auto zādzības pārbaude: ir · 14/14",
  "VIN koda pārbaude: ir",
].join("\n");

function row(id: string, status: string, summary = "", detail = ""): AtraFactRow {
  return { id, label: id, country: "EU", status, summary, detail };
}

describe("maksas atskaišu priekšskatījums", () => {
  it("AutoDNA: kopskaits, izceltās sadaļas pirmās, pārējās mazāk", () => {
    const [a] = buildAtraPreviews(VIN, [row("autodna_precheck", "found", "AutoDNA priekšskatījums: 31", AUTODNA_DETAIL)]);
    expect(a!.tone).toBe("ok");
    expect(a!.headline).toBe("31 ieraksts");
    expect(a!.items.slice(0, 2)).toEqual([
      { label: "Transportlīdzekļa vēsture", value: "5", key: true, tone: "ok" },
      { label: "Auto arhīva fotogrāfijas", value: "0", key: true, tone: "none" },
    ]);
    expect(a!.items.filter((i) => !i.key).map((i) => `${i.label}=${i.value}`)).toEqual([
      "Transportlīdzekļa tehniskie dati=10",
      "Auto zādzības pārbaude=14/14",
      "VIN koda pārbaude=ir",
    ]);
    expect(a!.openUrl).toBe(`https://www.autodna.lv/vin/${VIN}`);
    expect(a!.photos).toBe(0);
  });

  it("toņi: gaida, kļūda, nav", () => {
    const p = buildAtraPreviews(VIN, [
      row("autodna_precheck", "unknown", AUTODNA_PENDING_SUMMARY),
      row("checkcar_vin", "browser_only", "checkcar.vin: no pārlūka (from browser)"),
      row("carfax_eu", "blocked", "Cloudflare"),
    ]);
    expect(p.map((x) => [x.id, x.tone, x.headline])).toEqual([
      ["autodna_precheck", "wait", "Vēl nav sagatavots"],
      ["checkcar_vin", "wait", "Gaida pārlūku"],
      ["carfax_eu", "error", "Kļūda"],
    ]);
    const none = buildAtraPreviews(VIN, [row("checkcar_vin", "none", "Atskaitē nav foto"), row("carfax_eu", "none", "CARFAX priekšskatījumā ierakstu nav")]);
    expect(none.map((x) => [x.tone, x.headline])).toEqual([
      ["none", "Bilžu nav"],
      ["none", "Datu nav"],
    ]);
  });

  it("CheckCar bildes un CARFAX ierakstu skaits no kopsavilkuma", () => {
    const p = buildAtraPreviews(VIN, [row("checkcar_vin", "found", "12 foto"), row("carfax_eu", "found", "7 ieraksti CARFAX priekšskatījumā")]);
    expect(p.map((x) => x.headline)).toEqual(["Bildes ir: 12", "Dati ir: 7 ieraksti"]);
    expect(atraPreviewPhotoSources(p)).toEqual(["CheckCar.vin"]);
  });

  it("neieķeksēts avots baneri nerāda", () => {
    expect(buildAtraPreviews(VIN, [row("csdd", "found")])).toEqual([]);
  });
});

describe("stāsta potenciāls ar priekšskatījumu", () => {
  const base = { vin: VIN, plate: "", title: "Audi A4", year: "2014", dealer: null, csdd: null, hasListing: false };

  it("AutoDNA arhīva foto > 0 = +2 izsoļu bildes", () => {
    const detail = AUTODNA_DETAIL.replace("Auto arhīva fotogrāfijas: nav · 0", "Auto arhīva fotogrāfijas: ir · 3");
    const facts = buildAtraFacts({ ...base, rows: [row("autodna_precheck", "found", "x", detail)] });
    const score = atraStoryScore(facts);
    expect(score.reasons).toContainEqual({ points: 2, text: "Izsoļu bildes (AutoDNA arhīvs)" });
    expect(atraSummaryText(base, facts, score)).toContain("Priekšskatījums: AutoDNA 31 ieraksts (transportlīdzekļa vēsture 5, auto arhīva fotogrāfijas 3)");
  });

  it("nedubulto, ja izsoļu bildes jau ieskaitītas", () => {
    const facts = buildAtraFacts({
      ...base,
      rows: [
        { ...row("stat_vin", "found", "Ir"), auctions: [{ date: "2019-05-01", photoUrl: "https://x/1.jpg", photoCount: 8 }] },
        row("checkcar_vin", "found", "12 foto"),
      ],
    });
    const score = atraStoryScore(facts);
    expect(score.reasons.filter((r) => /bildes/i.test(r.text))).toHaveLength(1);
  });
});
