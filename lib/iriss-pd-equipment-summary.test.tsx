import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-ai", () => ({
  CLAUDE_MODEL_SONNET: "claude-sonnet-5",
  aiGenerateJsonWithSchema: vi.fn(() => {
    throw new Error("Testos īsts AI izsaukums aizliegts");
  }),
  getAnthropicApiKeyFromEnv: () => null,
}));

import { generateIrissPdEquipmentSummary } from "@/lib/iriss-pd-equipment-summary-ai";
import {
  applyIrissPdEquipmentSummaryEdit,
  buildIrissPdEqSummaryPublic,
  irissPdEqSummaryDecision,
  irissPdEqSummaryFromText,
  irissPdEqSummaryHash,
  irissPdEqSummarySource,
  irissPdEqSummaryToText,
  newIrissPdEquipmentSummary,
  normalizeIrissPdEquipmentSummary,
  parseIrissPdEqSummaryAiJson,
  sanitizeIrissPdEqSummary,
  type IrissPdEquipmentSummary,
} from "@/lib/iriss-pd-equipment-summary";
import { applyIrissPdPatch, buildIrissPdPublicView, normalizeIrissPiedavajums } from "@/lib/iriss-piedavajumi";
import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import { emptyIrissPiedavajums, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { renderHtml } from "@/lib/test-render";
import { PdEquipmentSummary } from "@/components/iriss-piedavajumi/PdEquipmentSummary";
import { irissPdEqSummaryNeedsConfirm } from "@/components/admin/iriss-piedavajumi/PdEquipmentSummaryEditor";

const AT = "2026-11-20T10:00:00.000Z";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const AUTO1: IrissPdAuto1Blocks = {
  paint: null,
  tech: [],
  equipment: Array.from({ length: 14 }, (_, i) => ({ name: `Aprīkojums ${i + 1}`, detail: i === 0 ? "Detachable" : "" })),
  service: [],
  inspection: [],
  damage: [],
  vinData: Array.from({ length: 30 }, (_, i) => `VIN opcija ${i + 1}`),
};

function rec(over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
  const r = emptyIrissPiedavajums(ID, AT);
  return { ...r, vehicle: { ...r.vehicle, title: "Škoda Superb Combi 2.0 TDI" }, auto1: AUTO1, ...over };
}

const AI_JSON = JSON.stringify({
  intro: "Bagātīgi aprīkots Škoda Superb Combi ar 2.0 TDI dzinēju un DSG kārbu — visticamāk 2019. gada.",
  groups: [
    { title: "Salons un komforts", items: ["Sēdekļi: apsilde priekšā", "", "Sēdekļi: apsilde priekšā"] },
    { title: "Tehniskie parametri un gaitas iekārta", items: ["Dzinējs: 2.0 TDI – 140 kW", "Kārba: DSG"] },
    { title: "Apgaismojums un redzamība", items: [] },
    { title: "Multimediji un savienojamība", items: ["Apple CarPlay un Android Auto", "Eksperts iesaka"] },
  ],
});

function summary(over: Partial<IrissPdEquipmentSummary> = {}): IrissPdEquipmentSummary {
  const src = irissPdEqSummarySource(rec());
  return {
    ...newIrissPdEquipmentSummary(parseIrissPdEqSummaryAiJson(AI_JSON)!, { at: AT, sourceHash: irissPdEqSummaryHash(src), model: "claude-sonnet-5" }),
    ...over,
  };
}

describe("komplektācijas kopsavilkums - avots un validācija", () => {
  it("avotā ir VISAS «Dati pēc VIN» un «Aprīkojums» pozīcijas (ne tikai pirmās)", () => {
    const src = irissPdEqSummarySource(rec());
    expect(src.vinData).toHaveLength(30);
    expect(src.equipment).toHaveLength(14);
    expect(src.equipment[0]).toBe("Aprīkojums 1: Detachable");
  });

  it("izmet tukšās grupas/punktus, dublikātus, «eksperts», minējumus; garās defises -> īsā; grupas Nila secībā", () => {
    const s = parseIrissPdEqSummaryAiJson(AI_JSON)!;
    expect(s.intro).toBe("");
    expect(s.groups.map((g) => g.title)).toEqual(["Tehniskie parametri un gaitas iekārta", "Salons un komforts", "Multimediji un savienojamība"]);
    expect(s.groups[0]!.items).toEqual(["Dzinējs: 2.0 TDI - 140 kW", "Kārba: DSG"]);
    expect(s.groups[1]!.items).toEqual(["Sēdekļi: apsilde priekšā"]);
    expect(s.groups[2]!.items).toEqual(["Apple CarPlay un Android Auto"]);
    expect(JSON.stringify(s)).not.toMatch(/[—–]/);
  });

  it("ievads bez minējuma paliek", () => {
    const s = sanitizeIrissPdEqSummary({ intro: "Bagātīgi aprīkots Škoda Superb Combi ar 2.0 TDI dzinēju un DSG kārbu.", groups: [{ title: "Salons un komforts", items: ["Isofix"] }] });
    expect(s!.intro).toBe("Bagātīgi aprīkots Škoda Superb Combi ar 2.0 TDI dzinēju un DSG kārbu.");
  });

  it("nederīgs JSON vai bez grupām - null (bloks netiek rādīts)", () => {
    expect(parseIrissPdEqSummaryAiJson("nav json")).toBeNull();
    expect(parseIrissPdEqSummaryAiJson(JSON.stringify({ intro: "x", groups: [] }))).toBeNull();
  });

  it("teksts <-> struktūra (admina labojums)", () => {
    const s = parseIrissPdEqSummaryAiJson(AI_JSON)!;
    expect(irissPdEqSummaryFromText(irissPdEqSummaryToText(s))).toEqual(s);
    const edited = irissPdEqSummaryFromText("Labots ievads.\n\n## Drošība un vadītāja asistenti\n- Lane Assist\nturpinājums\n- Front Assist");
    expect(edited).toEqual({ intro: "Labots ievads.", groups: [{ title: "Drošība un vadītāja asistenti", items: ["Lane Assist turpinājums", "Front Assist"] }] });
  });
});

describe("komplektācijas kopsavilkums - kad ģenerēt (izmaksas)", () => {
  const src = irissPdEqSummarySource(rec());
  it("nav - ģenerē; tas pats hash - patur; mainīts avots - ģenerē", () => {
    expect(irissPdEqSummaryDecision(null, src)).toBe("generate");
    expect(irissPdEqSummaryDecision(summary(), src)).toBe("keep");
    expect(irissPdEqSummaryDecision(summary({ sourceHash: "cits" }), src)).toBe("generate");
  });
  it("bez avota datiem - neko nedara", () => {
    expect(irissPdEqSummaryDecision(null, irissPdEqSummarySource(rec({ auto1: null })))).toBe("no_source");
  });
  it("labots ar roku - automātiski NEKAD nepārraksta, arī mainoties hash", () => {
    expect(irissPdEqSummaryDecision(summary({ editedByAdmin: true, sourceHash: "cits" }), src)).toBe("keep");
  });
  it("«Pārģenerēt» labotam tekstam prasa apstiprinājumu; ar apstiprinājumu - ģenerē", () => {
    expect(irissPdEqSummaryDecision(summary({ editedByAdmin: true }), src, { force: true })).toBe("confirm_required");
    expect(irissPdEqSummaryDecision(summary({ editedByAdmin: true }), src, { force: true, confirm: true })).toBe("generate");
    expect(irissPdEqSummaryDecision(summary(), src, { force: true })).toBe("generate");
  });
  it("redaktors prasa apstiprinājumu arī nesaglabātam labojumam", () => {
    const s = summary();
    expect(irissPdEqSummaryNeedsConfirm(s, s)).toBe(false);
    expect(irissPdEqSummaryNeedsConfirm(s, { ...s, text: `${s.text}\n- Jauns` })).toBe(true);
    expect(irissPdEqSummaryNeedsConfirm({ ...s, editedByAdmin: true }, { ...s, editedByAdmin: true })).toBe(true);
  });
});

describe("komplektācijas kopsavilkums - AI izsaukums (mock)", () => {
  it("viens izsaukums ar Sonnet, rezultāts ar hash; atkārtoti - bez izsaukuma", async () => {
    const generate = vi.fn(async () => AI_JSON);
    const r1 = await generateIrissPdEquipmentSummary(rec(), { at: AT }, { generate, hasKey: () => true });
    expect(r1.ok && r1.generated).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    const call = (generate.mock.calls[0] as unknown as [{ model: string; parts: Array<{ text: string }> }])[0];
    expect(call.model).toBe("claude-sonnet-5");
    expect(call.parts[0]!.text).toContain("VIN opcija 30");
    expect(call.parts[0]!.text).toContain("Aprīkojums 14");
    if (!r1.ok) throw new Error("x");
    const r2 = await generateIrissPdEquipmentSummary(rec({ equipmentSummaryLv: r1.summary }), { at: AT }, { generate, hasKey: () => true });
    expect(r2.ok && !r2.generated).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("labotu tekstu bez apstiprinājuma nepārraksta (AI netiek saukts)", async () => {
    const generate = vi.fn(async () => AI_JSON);
    const r = await generateIrissPdEquipmentSummary(rec({ equipmentSummaryLv: summary({ editedByAdmin: true }) }), { at: AT, force: true }, { generate, hasKey: () => true });
    expect(r).toEqual({ ok: false, error: "confirm_required" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("AI kļūda vai nederīga atbilde - ai_failed (PD strādā tāpat)", async () => {
    const bad = await generateIrissPdEquipmentSummary(rec(), { at: AT }, { generate: vi.fn(async () => "{}"), hasKey: () => true });
    expect(bad).toEqual({ ok: false, error: "ai_failed" });
    const thrown = await generateIrissPdEquipmentSummary(rec(), { at: AT }, { generate: vi.fn(async () => { throw new Error("529"); }), hasKey: () => true });
    expect(thrown).toEqual({ ok: false, error: "ai_failed" });
    const noKey = await generateIrissPdEquipmentSummary(rec(), { at: AT });
    expect(noKey).toEqual({ ok: false, error: "no_ai" });
  });
});

describe("komplektācijas kopsavilkums - glabāšana, labojums, klienta skats", () => {
  it("admina labojums -> editedByAdmin; klients redz laboto versiju", () => {
    const r = rec({ status: "draft", equipmentSummaryLv: summary() });
    const res = applyIrissPdPatch(r, { equipmentSummaryLv: { text: "Labots.\n\n## Salons un komforts\n- Isofix" } }, { by: "Nils", at: AT, nowMs: Date.parse(AT) });
    if (!res.ok) throw new Error(res.error);
    expect(res.record.equipmentSummaryLv!.editedByAdmin).toBe(true);
    expect(res.record.equipmentSummaryLv!.editedAt).toBe(AT);
    const view = buildIrissPdPublicView(res.record, "link", Date.parse(AT));
    expect(view.equipmentSummary).toEqual({ intro: "Labots.", groups: [{ title: "Salons un komforts", items: ["Isofix"] }] });
  });

  it("tikai «rāda klientam» pārslēgšana nepadara tekstu par labotu; izslēgts - klientam nav", () => {
    const s = summary();
    const off = applyIrissPdEquipmentSummaryEdit(s, { on: false }, AT)!;
    expect(off.editedByAdmin).toBe(false);
    expect(buildIrissPdEqSummaryPublic(off)).toBeNull();
    expect(applyIrissPdEquipmentSummaryEdit(s, { text: s.text }, AT)).toBe(s);
  });

  it("normalizē saglabāto (veciem ierakstiem lauka nav)", () => {
    const raw = { ...rec(), equipmentSummaryLv: undefined };
    expect(normalizeIrissPiedavajums(raw)!.equipmentSummaryLv).toBeNull();
    const n = normalizeIrissPdEquipmentSummary({ text: "A — B", editedByAdmin: true });
    expect(n).toMatchObject({ text: "A - B", editedByAdmin: true, on: true });
  });
});

describe("klienta bloks", () => {
  it("virsraksts, ievads, grupas ar aizzīmēm; nav datu - nerāda", () => {
    const s = parseIrissPdEqSummaryAiJson(AI_JSON)!;
    const html = renderHtml(<PdEquipmentSummary summary={{ ...s, intro: "Bagātīgi aprīkots auto." }} />);
    expect(html).toContain("Automašīnas komplektācijas kopsavilkums (pēc VIN)");
    expect(html).toContain("Bagātīgi aprīkots auto.");
    expect(html).toContain("<b class=\"font-semibold\">Dzinējs:</b>");
    expect(renderHtml(<PdEquipmentSummary summary={null} />)).toBe("");
  });
});
