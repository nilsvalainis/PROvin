import { describe, expect, it } from "vitest";
import { checkAiCommentLint, type AiLintContext } from "@/lib/pre-pdf-ai-lint";

const ok: AiLintContext = { totalLossFound: false };
const ids = (fields: { label: string; text: string }[], ctx = ok) => checkAiCommentLint(fields, ctx).map((f) => f.id);

const goodSummary =
  "Fakti\nAuto reģistrēts Latvijā kopš 2023. gada, nobraukums 145 254 km.\n\nMūsu ieteikums\nIesakām pārbaudīt piekari.";
const goodRisks = `${"Dzinējs OM654: ".repeat(10)}\nNākamajos 100 000 km\nIesakām pārbaudīt DPF.`;

describe("C11 AI komentāru likumi pirms PDF (PRO audits 06.11)", () => {
  it("labs kopsavilkums un riski - bez karogiem", () => {
    expect(ids([{ label: "Kopsavilkums", text: goodSummary }, { label: "Risku analīze", text: goodRisks }])).toEqual([]);
  });

  it("kopsavilkums par garu vai bez „Mūsu ieteikums” - viens karogs", () => {
    const long = `Fakti\n${"Auto ir labā stāvoklī. ".repeat(50)}\nRekomendācija\nPirkt.`;
    const flags = checkAiCommentLint([{ label: "Kopsavilkums", text: long }], ok);
    expect(flags.map((f) => f.id)).toEqual(["c11_summary_structure"]);
    expect(flags[0]!.level).toBe("E");
    expect(flags[0]!.message).toMatch(/rakstzīmes.*Mūsu ieteikums/);
  });

  it("norakstīšana avotos, bet ne kopsavilkumā (GLE FLASH MAX #1)", () => {
    expect(ids([{ label: "Kopsavilkums", text: goodSummary }], { totalLossFound: true })).toEqual([
      "c11_summary_missing_total_loss",
    ]);
    const mentioned = `${goodSummary}\nIgaunijā 2022. gadā auto norakstīts kā ekonomiski neizdevīgs remontēt.`;
    expect(ids([{ label: "Kopsavilkums", text: mentioned }], { totalLossFound: true })).toEqual([]);
  });

  it("riski bez „Nākamajos 100 000 km” vai par gariem; elektroauto bez šīs prasības", () => {
    expect(ids([{ label: "Risku analīze", text: "Dzinējs: iesakām pārbaudīt." }])).toEqual(["c11_risks_structure"]);
    expect(ids([{ label: "Risku analīze", text: "Baterija: iesakām pārbaudīt." }], { totalLossFound: false, isBev: true })).toEqual([]);
    expect(ids([{ label: "Risku analīze", text: `${goodRisks}${" Papildu teksts.".repeat(250)}` }])).toEqual([
      "c11_risks_structure",
    ]);
  });

  it("jūdzes, USD, € priekšā un angļu IRISS zīmogs jebkurā laukā", () => {
    expect(ids([{ label: "AutoDNA", text: "Nobraukums 31 000 mi ASV izsolē." }])).toEqual(["c11_units"]);
    expect(ids([{ label: "AutoDNA", text: "Izsolē pārdots par 4 500 USD." }])).toEqual(["c11_units"]);
    expect(ids([{ label: "Tirgus", text: "Cena samazināta līdz € 8 390." }])).toEqual(["c11_units"]);
    expect(ids([{ label: "Kopsavilkums", text: `${goodSummary}\nInspected by IRISS` }])).toEqual(["c11_english_stamp"]);
    expect(ids([{ label: "Tirgus", text: "Cena 8 390 €, 2 minūtes, 12 miljoni." }])).toEqual([]);
  });
});
