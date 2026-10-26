import { describe, expect, it } from "vitest";
import {
  applyIrissPdPatch,
  buildIrissPdPublicView,
  irissPdMargin,
  normalizeIrissPiedavajums,
  rebaseIrissPd,
} from "@/lib/iriss-piedavajumi";
import { irissPdAuto1Brief, type IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import { emptyIrissPiedavajums, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = Date.parse("2026-10-26T10:00:00.000Z");
const AT = new Date(NOW).toISOString();
const ctx = { by: "Nils", at: AT, nowMs: NOW };
const sp = (s: unknown) => String(s).replace(/ /g, " ");

function rec(over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
  return { ...emptyIrissPiedavajums(ID, AT), number: 218, status: "sent", validUntil: "2026-11-02", vehicle: { ...emptyIrissPiedavajums(ID, AT).vehicle, title: "Volvo XC70 2.4 D5 AWD" }, ...over };
}

describe("j75 saturs: noklusējumi un vecie ieraksti", () => {
  it("jaunam piedāvājumam ir šabloni un visas sadaļas rāda klientam; fakti nav ieķeksēti", () => {
    const c = emptyIrissPiedavajums(ID, AT).content;
    expect([c.highlightsOn, c.summaryOn, c.assessmentOn]).toEqual([true, true, true]);
    expect(c.included.filter((x) => x.on).map((x) => x.text)).toEqual(["Pilna pirmspārdošanas sagatavošana", "Pārbaudes serviss", "Atvešana uz Latviju"]);
    expect(c.excluded.map((x) => x.text)).toContain("CSDD reģistrācija");
    expect(c.facts.map((x) => x.text)).toEqual(["2 atslēgas", "Servisa grāmatiņa", "TA derīga", "Nav avārijas vēstures", "Otrs riteņu komplekts", "Pārkrāsots (kosmētiski)"]);
    expect(c.facts.every((x) => !x.on)).toBe(true);
  });

  it("ieraksts pirms j75 (bez content) netiek mainīts klientam: sadaļas izslēgtas, klienta skatā nav jauna satura", () => {
    const old = { ...rec(), content: undefined } as unknown as Record<string, unknown>;
    delete old.content;
    delete old.logisticsCost;
    const n = normalizeIrissPiedavajums(JSON.parse(JSON.stringify(old)))!;
    expect([n.content.highlightsOn, n.content.summaryOn, n.content.assessmentOn]).toEqual([false, false, false]);
    expect(n.content.included.length).toBeGreaterThan(0);
    expect(n.logisticsCost).toBe("");
    expect(buildIrissPdPublicView(n, "link", NOW).content).toBeNull();
  });

  it("saglabātais saturs izdzīvo JSON ciklu (dublikāti un tukšās rindas izmestas)", () => {
    const raw = JSON.parse(
      JSON.stringify({
        ...rec(),
        content: { highlights: ["AWD", " awd ", "", "Āķis"], highlightsOn: true, included: [{ text: "Garantija", on: true }, { text: "garantija", on: false }, { text: " " }], excluded: [], summaryOn: true, facts: "x", visual: "Buktes", technical: "", note: "", assessmentOn: true },
      }),
    );
    const n = normalizeIrissPiedavajums(raw)!;
    expect(n.content.highlights).toEqual(["AWD", "Āķis"]);
    expect(n.content.included).toEqual([{ text: "Garantija", on: true }]);
    expect(n.content.excluded).toEqual([]);
    expect(n.content.facts.length).toBe(6);
    expect(n.content.visual).toBe("Buktes");
  });
});

describe("j75 saturs: labojumi", () => {
  it("PATCH content saglabā un ieraksta vēsturē; atkārtots tas pats - bez izmaiņām", () => {
    const r = rec({ status: "draft" });
    const res = applyIrissPdPatch(r, { content: { highlights: ["Xenon lukturi"], visual: "Pārkrāsots motora pārsegs (kosmētiski)." } }, ctx);
    if (!res.ok) throw new Error(res.error);
    expect(res.record.content.highlights).toEqual(["Xenon lukturi"]);
    expect(res.record.content.included).toEqual(r.content.included);
    expect(res.record.history.at(-1)?.text).toBe("Klienta apraksts mainīts");
    const again = applyIrissPdPatch(res.record, { content: { highlights: ["Xenon lukturi"] } }, ctx);
    expect(again.ok && again.record).toBe(res.record);
  });

  it("apstiprinātam saturu labot nevar", () => {
    const res = applyIrissPdPatch(rec({ status: "approved" }), { content: { note: "x" } }, ctx);
    expect(res.ok).toBe(false);
  });

  it("loģistikas un sagatavošanas izmaksas: saglabā un ieskaita maržā", () => {
    const res = applyIrissPdPatch(rec({ status: "draft", price: "10800", purchasePrice: "8450" }), { logisticsCost: "650", prepCost: "480" }, ctx);
    if (!res.ok) throw new Error(res.error);
    expect([res.record.logisticsCost, res.record.prepCost]).toEqual(["650", "480"]);
    expect(sp(irissPdMargin(res.record.price, res.record.purchasePrice, res.record.logisticsCost, res.record.prepCost))).toBe("1 220 €");
    expect(sp(irissPdMargin("10800", "8450"))).toBe("2 350 €");
    expect(sp(irissPdMargin("10800", "8450", "", "nav"))).toBe("2 350 €");
  });

  it("jauns uz bāzes kopē saturu (neatkarīga kopija)", () => {
    const base = rec({ status: "expired" });
    base.content.highlights = ["AWD"];
    const next = rebaseIrissPd(base, { id: ID2, number: 219, at: AT, by: "Nils" });
    expect(next.content.highlights).toEqual(["AWD"]);
    next.content.highlights.push("Āķis");
    expect(base.content.highlights).toEqual(["AWD"]);
  });
});

describe("j75 saturs: klienta skats", () => {
  it("rāda tikai ieslēgtās sadaļas un ieķeksētās rindas; atrašanās vieta auto datos", () => {
    const r = rec({ vehicle: { ...rec().vehicle, location: "Vācija" } });
    r.content = {
      ...r.content,
      highlights: ["AWD"],
      facts: r.content.facts.map((f) => ({ ...f, on: f.text === "2 atslēgas" })),
      visual: "Buktes",
      note: "",
    };
    const v = buildIrissPdPublicView(r, "link", NOW);
    expect(v.content?.highlights).toEqual(["AWD"]);
    expect(v.content?.facts).toEqual(["2 atslēgas"]);
    expect(v.content?.included).not.toContain("Garantija 3 mēn.");
    expect(v.content?.excluded).toContain("Ceļa nodoklis");
    expect(v.facts).toContainEqual({ label: "Atrašanās vieta", value: "Vācija" });

    const off = buildIrissPdPublicView({ ...r, content: { ...r.content, summaryOn: false, assessmentOn: false } }, "pdf", NOW);
    expect(off.content).toEqual({ highlights: ["AWD"], included: [], excluded: [], facts: [], visual: "", technical: "", note: "" });
  });
});

describe("j75: Auto1 īsais kopsavilkums", () => {
  const A: IrissPdAuto1Blocks = {
    paint: { zones: [{ id: "front", readings: [276], warning: true }, { id: "roof", readings: [], warning: false }, { id: "rear", readings: [], warning: false }, { id: "left", readings: [], warning: false }, { id: "right", readings: [], warning: false }], unassigned: [] },
    tech: [{ label: "Jauda", value: "136 kW / 185 ZS" }],
    equipment: [],
    service: [{ label: "Servisa grāmata", value: "Pieejams" }, { label: "Pēdējais serviss", value: "10/2017" }],
    inspection: [{ label: "Pēdējās TA datums", value: "12/2024" }],
    damage: [
      { area: "exterior", damage: "Scratch", severity: "", description: "", quantity: "25", parts: "" },
      { area: "exterior", damage: "Dent", severity: "", description: "", quantity: "4", parts: "" },
      { area: "interior", damage: "Stain", severity: "", description: "", quantity: "", parts: "" },
      { area: "other", damage: "Warning light", severity: "", description: "ABS", quantity: "1", parts: "" },
    ],
    vinData: [],
  };
  it("auto kolonna un bojājumu skaits pēc zonas", () => {
    const b = irissPdAuto1Brief(A);
    expect(b.car).toEqual([
      { label: "Jauda", value: "136 kW / 185 ZS" },
      { label: "Pēdējā TA", value: "12/2024" },
      { label: "Serviss", value: "Pieejams · 10/2017" },
    ]);
    expect(b.damage).toEqual([
      { label: "Bojājumi ārpusē", value: "29" },
      { label: "Salonā", value: "1" },
      { label: "Kļūdas paziņojumi", value: "1" },
      { label: "Pārkrāsotas zonas", value: "1" },
    ]);
    expect(irissPdAuto1Brief(null)).toEqual({ car: [], damage: [] });
  });
});
