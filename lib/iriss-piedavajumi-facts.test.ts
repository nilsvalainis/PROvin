import { describe, expect, it } from "vitest";

import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import { irissPdFactsFromAuto1, irissPdPaintFact } from "@/lib/iriss-piedavajumi-facts";
import { IRISS_PD_FACTS_TEMPLATE } from "@/lib/iriss-piedavajumi-types";

// PD-0001 (Volvo V60, Auto1) reālie dati.
const volvo: IrissPdAuto1Blocks = {
  paint: null,
  tech: [
    { label: "TA līdz", value: "03/2027" },
    { label: "Atslēgas", value: "2" },
    { label: "Iepriekšējie bojājumi / avārija (pēc iepr. īpašnieka)", value: "No" },
  ],
  equipment: [],
  service: [{ label: "Servisa grāmata", value: "Available" }],
  inspection: [],
  damage: [],
  vinData: [],
};
const now = new Date("2026-10-30T12:00:00Z");
const tpl = IRISS_PD_FACTS_TEMPLATE.map((x) => ({ ...x }));

describe("Nils 30.10: Novērtējums klientam no izsoles datiem", () => {
  it("atslēgas, servisa grāmatiņa, TA un avārija aizpildās un ieķeksējas", () => {
    const out = irissPdFactsFromAuto1(volvo, tpl, now);
    expect(out).toContainEqual({ text: "2 atslēgas", on: true });
    expect(out).toContainEqual({ text: "Servisa grāmatiņa", on: true });
    expect(out).toContainEqual({ text: "TA derīga līdz 03/2027", on: true });
    expect(out).toContainEqual({ text: "Nav avārijas vēstures", on: true });
    // Bez mērījumiem krāsojuma rinda paliek kā šablonā (admins pārbauda).
    expect(out).toContainEqual({ text: "Pārkrāsots (kosmētiski)", on: false });
  });

  it("nav servisa grāmatas / TA beigusies / bija avārija - neieķeksē", () => {
    const out = irissPdFactsFromAuto1(
      {
        ...volvo,
        tech: [
          { label: "TA līdz", value: "08/2026" },
          { label: "Iepriekšējie bojājumi / avārija (pēc iepr. īpašnieka)", value: "Yes" },
        ],
        service: [{ label: "Servisa grāmata", value: "Not available" }],
      },
      tpl,
      now,
    );
    expect(out).toContainEqual({ text: "Servisa grāmatiņa: Not available", on: false });
    expect(out).toContainEqual({ text: "TA beigusies (08/2026)", on: false });
    expect(out).toContainEqual({ text: "Nav avārijas vēstures", on: false });
  });

  it("krāsojums: pārkrāsoto elementu skaits un maks. µm", () => {
    expect(irissPdPaintFact({ zones: [{ id: "front", readings: [110, 420], warning: true }, { id: "left", readings: [300], warning: true }], unassigned: [] })).toEqual({
      text: "Pārkrāsoti 2 elementi (līdz 420 µm)",
      on: true,
    });
    expect(irissPdPaintFact({ zones: [{ id: "roof", readings: [120, 140], warning: false }], unassigned: [160] })).toEqual({
      text: "Krāsojums oriģināls (3 mērījumi, līdz 160 µm)",
      on: true,
    });
  });

  it("admina mainītas rindas un paša pievienotās paliek", () => {
    const facts = [{ text: "2 atslēgas", on: true }, { text: "Jauns akumulators", on: true }];
    const out = irissPdFactsFromAuto1({ ...volvo, tech: [{ label: "Atslēgas", value: "1" }] }, facts, now);
    expect(out).toEqual(facts);
  });
});
