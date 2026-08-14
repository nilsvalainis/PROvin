import { describe, expect, it } from "vitest";
import { buildPdfSummaryBannerTiles } from "@/lib/pdf-report-summary";
import {
  filterManualBannersForPdf,
  mergeProvinManualBanners,
  ownManualBanners,
  resolveProvinBanners,
  upsertProvinBannerOverride,
  type ProvinManualBanner,
} from "@/lib/provin-alert-banners";

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

describe("aprēķināto brīdinājumu labošana", () => {
  const inspection = { kind: "inspection", text: "Aprēķinātais teikums.", severity: "yellow" } as const;

  it("labojums pārraksta kartītes tekstu un krāsu, tukšie lauki paliek pēc noklusējuma", () => {
    const banners = upsertProvinBannerOverride([], "inspection", {
      severity: "red",
      value: "Beigusies 01.06.2026",
      text: "Apskate beigusies — pirms braukšanas jākārto atkārtoti.",
    });
    const tiles = buildPdfSummaryBannerTiles({ alertBanners: [inspection], manualBanners: banners });
    expect(tiles).toEqual([
      {
        id: "alert-inspection",
        label: "Tehniskā apskate",
        value: "Beigusies 01.06.2026",
        note: "Apskate beigusies — pirms braukšanas jākārto atkārtoti.",
        tone: "alert",
        wide: false,
      },
    ]);
  });

  it("labotais teksts maina arī admin joslu, bet noklusējumi paliek pieejami", () => {
    const banners = upsertProvinBannerOverride([], "inspection", { severity: "yellow", text: "Mans teksts." });
    const [resolved] = resolveProvinBanners({ alertBanners: [inspection], manualBanners: banners });
    expect(resolved).toMatchObject({ text: "Mans teksts.", severity: "yellow" });
    expect(resolved!.defaults.text).toBe("Aprēķinātais teikums.");
    expect(resolved!.defaults.card).toMatchObject({ label: "Tehniskā apskate" });
  });

  it("tukšs labojuma ieraksts nemaina ne tekstu, ne krāsu", () => {
    const banners = upsertProvinBannerOverride([], "inspection", { severity: "yellow" });
    const [resolved] = resolveProvinBanners({ alertBanners: [inspection], manualBanners: banners });
    expect(resolved).toMatchObject({ text: "Aprēķinātais teikums.", severity: "yellow", edited: false });
  });

  it("bez labojuma odometra brīdinājums kartīti neveido, ar aizpildītu vērtību — veido", () => {
    const banners = upsertProvinBannerOverride([], "odometer", {
      severity: "red",
      value: "2 pretrunas",
      text: "Divi rādījumi zemāki par iepriekšējiem.",
    });
    const withoutOverride = buildPdfSummaryBannerTiles({
      alertBanners: [{ kind: "odometer", text: "…", severity: "red" }],
    });
    const withOverride = buildPdfSummaryBannerTiles({
      alertBanners: [{ kind: "odometer", text: "…", severity: "red" }],
      manualBanners: banners,
    });
    expect(withoutOverride).toEqual([]);
    expect(withOverride).toEqual([
      {
        id: "alert-odometer",
        label: "Svarīgi",
        value: "2 pretrunas",
        note: "Divi rādījumi zemāki par iepriekšējiem.",
        tone: "alert",
        wide: false,
      },
    ]);
  });

  it("„atjaunot noklusējumu” dzēš labojumu, bet nesaskar manuālos ierakstus", () => {
    const manual: ProvinManualBanner = { id: "m1", text: "Atslēgas: 2 gab.", severity: "grey" };
    const withOverride = upsertProvinBannerOverride([manual], "inspection", { severity: "red", value: "X" });
    expect(withOverride).toHaveLength(2);
    const reset = upsertProvinBannerOverride(withOverride, "inspection", null);
    expect(reset).toEqual([manual]);
  });

  it("labojumi ceļo tajā pašā manualBanners sarakstā, bet nekļūst par manuālām kartītēm", () => {
    const merged = mergeProvinManualBanners([
      { id: "m1", text: "Atslēgas: 2 gab.", severity: "grey" },
      { id: "sagrozīts", kind: "inspection", value: "Beigusies", severity: "red" },
      { id: "dublikāts", kind: "inspection", value: "Otrais", severity: "yellow" },
      { id: "x", kind: "nezināms_veids", value: "Y", severity: "red" },
    ]);
    expect(merged.map((b) => b.id)).toEqual(["m1", "kind:inspection", "x"]);
    expect(ownManualBanners(merged).map((b) => b.id)).toEqual(["m1", "x"]);
    expect(filterManualBannersForPdf(merged).map((b) => b.id)).toEqual(["m1", "x"]);
  });
});
