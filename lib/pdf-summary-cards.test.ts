import { describe, expect, it } from "vitest";
import { buildPdfSummaryBannerTiles } from "@/lib/pdf-report-summary";
import { mergeProvinManualBanners } from "@/lib/provin-alert-banners";

describe("kopsavilkuma kartītes", () => {
  it("manuālais ieraksts ar virsrakstu un vērtību kļūst par kartīti kā bāzes plāksnītes", () => {
    const tiles = buildPdfSummaryBannerTiles({
      manualBanners: [
        {
          id: "m1",
          title: "Servisa grāmatiņa",
          value: "Nav pieejama",
          text: "Pārdevējs uzrāda tikai pēdējo apkopi.",
          severity: "yellow",
        },
      ],
    });
    expect(tiles).toEqual([
      {
        id: "manual-m1",
        label: "Servisa grāmatiņa",
        value: "Nav pieejama",
        note: "Pārdevējs uzrāda tikai pēdējo apkopi.",
        tone: "warn",
        wide: false,
      },
    ]);
  });

  it("vecs ieraksts bez virsraksta: īss teksts kļūst par vērtību, garš — par platu kartīti", () => {
    const [short, long] = buildPdfSummaryBannerTiles({
      manualBanners: [
        { id: "s", text: "Atslēgas: 2 gab.", severity: "grey" },
        {
          id: "l",
          text: "Pārdevējs apstiprināja, ka automašīna pēdējos divus gadus stāvējusi neapsildītā garāžā un netika lietota ziemā.",
          severity: "red",
        },
      ],
    });
    expect(short).toMatchObject({ label: "Informācija", value: "Atslēgas: 2 gab.", note: "", tone: "neutral" });
    expect(long).toMatchObject({ label: "Svarīgi", value: "", tone: "alert", wide: true });
    expect(long!.note).toContain("neapsildītā garāžā");
  });

  it("odometra un negadījumu brīdinājumi neveido dublējošas kartītes", () => {
    const tiles = buildPdfSummaryBannerTiles({
      alertBanners: [
        { kind: "odometer", text: "…", severity: "red" },
        { kind: "incidents", text: "…", severity: "yellow" },
        { kind: "inspection", text: "…", severity: "yellow" },
      ],
    });
    expect(tiles.map((t) => t.id)).toEqual(["alert-inspection"]);
    expect(tiles[0]!.tone).toBe("warn");
  });

  it("informatīvā kartīte pārņem aprēķinātos laukus", () => {
    const tiles = buildPdfSummaryBannerTiles({
      infoBanners: [
        {
          kind: "lv_registration_tenure",
          text: "Saskaņā ar mūsu rīcībā esošajiem datiem…",
          label: "Reģistrācija Latvijā",
          value: "30 dienas",
          note: "Pēc mūsu rīcībā esošajiem datiem — kopš 14.07.2026",
        },
      ],
    });
    expect(tiles[0]).toMatchObject({ label: "Reģistrācija Latvijā", value: "30 dienas", tone: "neutral" });
  });

  it("virsraksts un vērtība saglabājas pēc hidratācijas", () => {
    const merged = mergeProvinManualBanners([
      { id: "m1", title: " Riepas ", value: " 4 ziemas ", text: "Komplekts uz diskiem.", severity: "grey" },
    ]);
    expect(merged[0]).toMatchObject({ title: "Riepas", value: "4 ziemas" });
  });
});
