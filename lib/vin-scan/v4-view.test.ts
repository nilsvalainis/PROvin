import { describe, expect, it } from "vitest";

import { buildAtraFacts } from "@/lib/atra-parbaude-facts";
import { vinScanV4PaidServices } from "@/lib/vin-scan/v4-paid-services";
import {
  buildVinScanV4Attention,
  buildVinScanV4Layout,
  vinScanRelayRef,
  vinScanV4BlockOf,
  vinScanV4Kind,
  vinScanV4Notice,
  vinScanV4ShortText,
  vinScanV4StatusLine,
  vinScanVinFromRelayRef,
  VIN_SCAN_V4_BLOCKS,
} from "@/lib/vin-scan/v4-view";

const VIN = "WAUZZZF2XKN104417";
const r = (id: string, status: string, summary = "") => ({ id, label: id, country: "", status, summary });

describe("VIN SCAN v4 - Nila bloku kārtība", () => {
  it("bloki: izsoles -> ārvalstu reģistri -> priekšskatījumi -> pārējais -> atsaukumi (beigās)", () => {
    expect(VIN_SCAN_V4_BLOCKS.map((b) => b.id)).toEqual(["izsoles", "arvalstu", "prieksskati", "citi", "atsaukumi"]);
  });

  it("avoti nonāk pareizajā blokā", () => {
    expect(vinScanV4BlockOf("csdd")).toBe("csdd");
    expect(vinScanV4BlockOf("thecarapi_eu")).toBe("izsoles");
    expect(vinScanV4BlockOf("bid_cars")).toBe("izsoles");
    expect(vinScanV4BlockOf("checkcar_vin")).toBe("prieksskati");
    expect(vinScanV4BlockOf("autodna_precheck")).toBe("prieksskati");
    expect(vinScanV4BlockOf("carfax_eu")).toBe("prieksskati");
    expect(vinScanV4BlockOf("mnt_ee")).toBe("arvalstu");
    expect(vinScanV4BlockOf("carinfo")).toBe("arvalstu");
    expect(vinScanV4BlockOf("dvsa_mot")).toBe("arvalstu");
    expect(vinScanV4BlockOf("lkf_ee")).toBe("arvalstu");
    expect(vinScanV4BlockOf("vin_decode")).toBe("citi");
    expect(vinScanV4BlockOf("nicb")).toBe("citi");
    expect(vinScanV4BlockOf("eu_safety_gate")).toBe("atsaukumi");
    expect(vinScanV4BlockOf("lt_itpr")).toBeNull();
  });

  it("blokos tikai avoti ar datiem; tukšie un kļūdas atsevišķi; tikai-saites neskaitās statusā", () => {
    const layout = buildVinScanV4Layout([
      r("eu_safety_gate", "found", "12.2022 dzesēšanas sūknis"),
      r("thecarapi_eu", "found", "1 izsole"),
      r("vin_decode", "found"),
      r("carinfo", "found"),
      r("csdd", "found", "Reģistrēts"),
      r("mnt_ee", "none"),
      r("dsb", "unknown", "kļūda 503"),
      r("bid_cars", "timeout"),
      r("stat_vin", "idle"),
      r("bidfax", "idle"),
      r("esyn", "checking"),
      r("lt_itpr", "found"),
    ]);
    expect(layout.groups.map((g) => g.id)).toEqual(["izsoles", "arvalstu", "citi", "atsaukumi"]);
    expect(layout.csdd?.id).toBe("csdd");
    expect(layout.empty.map((x) => x.id)).toEqual(["mnt_ee"]);
    expect(layout.errors.map((x) => x.id)).toEqual(["dsb", "bid_cars"]);
    expect(layout.links.map((x) => x.id)).toEqual(["stat_vin", "bidfax"]);
    expect(layout.pending.map((x) => x.id)).toEqual(["esyn"]);
    // 12 rindas - 2 saites - 1 izņemts avots = 9 skaitītas; 5 ar datiem; 8 pabeigtas.
    expect(layout.counted).toBe(9);
    expect(layout.withData).toBe(5);
    expect(layout.done).toBe(8);
    expect(vinScanV4StatusLine(layout, true)).toBe("Lasa 8 no 9");
    expect(vinScanV4StatusLine(layout, false)).toBe("Ar datiem 5 no 9");
  });

  it("tikai-saites avots ar reāliem datiem (pārlūka imports) parādās blokā", () => {
    expect(vinScanV4Kind(r("stat_vin", "found"))).toBe("data");
    expect(vinScanV4Kind(r("stat_vin", "none"))).toBe("link");
    expect(vinScanV4Kind(r("mnt_ee", "needs_input"))).toBe("empty");
    expect(vinScanV4Kind(r("mnt_ee", "blocked"))).toBe("error");
  });
});

describe("VIN SCAN v4 - «Uzmanību»", () => {
  it("km kritums, negadījumi un atsaukumi ir sarkanie karogi ar avotu", () => {
    const facts = buildAtraFacts({
      vin: VIN,
      plate: "",
      title: "Audi A6",
      year: "2019",
      dealer: null,
      csdd: null,
      hasListing: false,
      rows: [
        {
          id: "carfax_eu",
          label: "CARFAX.eu",
          country: "EU",
          status: "found",
          summary: "",
          mileage: [
            { date: "2023-10-11", odometer: "146 300 km", source: "CARFAX.eu" },
            { date: "2024-03-22", odometer: "139 500 km", source: "CARFAX.eu" },
          ],
          incidents: [{ date: "2022-03-01", summary: "Priekšpuse" }],
        },
      ],
    });
    const flags = buildVinScanV4Attention(facts, [{ text: "OCTA atlīdzība (LTAB)", source: "LTAB" }]);
    const texts = flags.map((f) => f.text);
    expect(texts).toContain("Negadījumi / bojājumi: 1");
    expect(texts[texts.length - 1]).toBe("OCTA atlīdzība (LTAB)");
    expect(buildVinScanV4Attention(null)).toEqual([]);
    const from = { date: "2024-03-14", km: 151800, source: "TheCarApi", country: "DE" };
    const to = { date: "2024-03-22", km: 139500, source: "AutoDNA", country: "LT" };
    const withDrop = { ...facts, mileage: { ...facts.mileage, drop: { from, to, km: 12300 } } };
    expect(buildVinScanV4Attention(withDrop)[0]).toEqual({ text: "Nobraukuma kritums -12 300 km", source: "22.03.2024 · AutoDNA" });
  });
});

describe("VIN SCAN v4 - Smart-ID atsauce un maksas pakalpojumi", () => {
  it("`vs_<vin>` atsauce: derīga releja ref, atpakaļ VIN; pasūtījumi un ātrie vērtējumi nav VIN SCAN", () => {
    const ref = vinScanRelayRef(VIN);
    expect(ref).toBe("vs_wauzzzf2xkn104417");
    expect(/^[a-zA-Z0-9_]+$/.test(ref)).toBe(true);
    expect(vinScanVinFromRelayRef(ref)).toBe(VIN);
    expect(vinScanVinFromRelayRef("qe_abc")).toBeNull();
    expect(vinScanVinFromRelayRef("cs_live_a1b2")).toBeNull();
  });

  it("maksas pakalpojumi: AutoDNA, carVertical, CARFAX ar cenu un VIN saiti; bez derīga VIN - nekas", () => {
    const list = vinScanV4PaidServices(VIN);
    expect(list.map((s) => s.id)).toEqual(["autodna_full", "carvertical", "carfax_full"]);
    for (const s of list) {
      expect(s.price).toBeTruthy();
      expect(s.href).toContain(VIN);
    }
    expect(vinScanV4PaidServices("ABC")).toEqual([]);
  });
});

describe("VIN SCAN v4 - saliktais saraksts (26.11, Nila ekrānuzņēmums S 320 CDI)", () => {
  const CARFAX =
    "CARFAX.eu: no pārlūka (from browser) · relejs: CARFAX.eu: pēc reCAPTCHA atteikuma pauze līdz 21:09 - pārbaudi pārlūka joslā";

  it("CARFAX reCAPTCHA pauze: kļūda ar īsu latvisku tekstu bez «from browser»", () => {
    const row = { ...r("carfax_eu", "browser_only", CARFAX), label: "CARFAX.eu" };
    expect(vinScanV4Kind(row)).toBe("error");
    const n = vinScanV4Notice(row);
    expect(n.error).toBe(true);
    expect(n.status).toBe("kļūda");
    expect(n.detail).toBe("pauze līdz 21:09 (reCAPTCHA) - izmanto pārlūka joslu");
    expect(n.detail).not.toMatch(/from browser|relejs/);
  });

  it("NHTSA ASV tirgus un Safety Gate «nav starp jaunākajiem» nav kļūdas", () => {
    const nhtsa = r("nhtsa_recalls", "browser_only", "ASV tirgus, var neattiekties");
    const sg = r("eu_safety_gate", "unknown", "ES Safety Gate: Mercedes-Benz nav starp 100 jaunākajiem no 174 rezultātiem, pārbaudi saitē");
    expect(vinScanV4Kind(nhtsa)).toBe("empty");
    expect(vinScanV4Kind(sg)).toBe("empty");
    expect(vinScanV4Notice(nhtsa)).toMatchObject({ status: "nav piemērojams", error: false });
    expect(vinScanV4Notice(sg)).toMatchObject({ status: "nav atrasts", detail: "pārbaudi saitē", error: false });
  });

  it("teksts netiek dublēts: kreisajā nosaukums, labajā īss statuss", () => {
    expect(vinScanV4Notice(r("rdw", "needs_input", "Vajag NL reģ. nr."))).toMatchObject({ status: "vajag numuru", detail: "" });
    expect(vinScanV4Notice(r("dvsa_mot", "needs_input", "Vajag UK reģ. nr."))).toMatchObject({ status: "vajag numuru", detail: "" });
    expect(vinScanV4Notice(r("listing_history", "needs_input", "Vajag sludinājumu"))).toMatchObject({ status: "vajag sludinājumu", detail: "" });
    expect(vinScanV4Notice(r("nicb", "skipped", "NICB attiecas tikai uz ASV auto"))).toMatchObject({ status: "nav piemērojams", detail: "" });
    expect(vinScanV4Notice(r("mnt_ee", "none", "VIN nav Igaunijas transportlīdzekļu reģistrā"))).toMatchObject({ status: "nav atrasts", detail: "" });
  });

  it("kļūdu skaitā tikai īstas kļūdas (tīkls, 5xx, captcha, taimauts); kfz_at nekad nav kļūda", () => {
    const layout = buildVinScanV4Layout([
      r("carfax_eu", "browser_only", CARFAX),
      r("nhtsa_recalls", "browser_only", "ASV tirgus, var neattiekties"),
      r("eu_safety_gate", "unknown", "ES Safety Gate: Mercedes-Benz nav starp 100 jaunākajiem no 174 rezultātiem, pārbaudi saitē"),
      r("kfz_at", "browser_only", "kfzgutachten.at: saraksts bez maksas, bet tikai pārlūkā (reCAPTCHA)."),
      r("dsb", "unknown", "Avotu neizdevās nolasīt"),
      r("mnt_ee", "timeout", "Avots neatbildēja laikā"),
      r("cz_rsv", "unknown", "HTTP 503"),
      r("bid_cars", "browser_only", "bid.cars: no pārlūka (from browser) · relejs: lapa bez šī VIN"),
    ]);
    expect(layout.errors.map((x) => x.id)).toEqual(["carfax_eu", "dsb", "mnt_ee", "cz_rsv"]);
    expect(layout.empty.map((x) => x.id)).toEqual(["nhtsa_recalls", "eu_safety_gate", "kfz_at", "bid_cars"]);
  });

  it("īsais teksts noņem avota prefiksu un garumu ierobežo", () => {
    expect(vinScanV4ShortText("mnt.ee relejs: Chrome neatbildēja", "Igaunija · mnt.ee")).toBe("Chrome neatbildēja");
    expect(vinScanV4ShortText("x".repeat(400)).length).toBeLessThanOrEqual(140);
  });
});
