import { describe, expect, it } from "vitest";
import { irissPdOpenQuestionCount, irissPdQuestionAnswer, normalizeIrissPdMessages } from "@/lib/iriss-piedavajumi-messages";
import type { IrissPdMessage } from "@/lib/iriss-piedavajumi-types";

const q = (id: string, at: string, extra: Partial<IrissPdMessage> = {}): IrissPdMessage => ({
  id,
  at,
  from: "client",
  kind: "question",
  by: "Klients",
  text: "Jautājums?",
  ...extra,
});
const note = (id: string, at: string): IrissPdMessage => ({ id, at, from: "admin", kind: "note", by: "Nils", text: "Atbilde" });

describe("PD klienta jautājumi: atbildēts / neatbildēts", () => {
  it("veci ieraksti bez answeredAt: kā līdz šim - neatbildēti, ja pēc tiem nav admina ziņas", () => {
    const msgs = normalizeIrissPdMessages([q("a", "2026-11-01T10:00:00.000Z"), q("b", "2026-11-01T11:00:00.000Z")]);
    expect(irissPdOpenQuestionCount(msgs)).toBe(2);
    const answered = [...msgs, note("n", "2026-11-02T08:22:00.000Z")];
    expect(irissPdOpenQuestionCount(answered)).toBe(0);
    expect(irissPdQuestionAnswer(answered, 0)).toEqual({ at: "2026-11-02T08:22:00.000Z", by: "Nils" });
  });

  it("answeredAt / reopenedAt saglabājas pēc normalizācijas; nederīgi lauki izmesti", () => {
    const msgs = normalizeIrissPdMessages([
      q("a", "2026-11-01T10:00:00.000Z", { answeredAt: "2026-11-14T08:22:00.000Z", answeredBy: "Nils" }),
      q("b", "2026-11-01T11:00:00.000Z", { reopenedAt: "2026-11-14T09:00:00.000Z" }),
      q("c", "2026-11-01T12:00:00.000Z", { answeredAt: "nav datums" }),
      note("n", "2026-11-02T08:00:00.000Z"),
    ]);
    expect(irissPdQuestionAnswer(msgs, 0)).toEqual({ at: "2026-11-14T08:22:00.000Z", by: "Nils" });
    // Atjaunots - neatbildēts, kaut pēc tā ir admina ziņa.
    expect(irissPdQuestionAnswer(msgs, 1)).toBeNull();
    expect(msgs[2]!.answeredAt).toBeUndefined();
    expect(irissPdOpenQuestionCount(msgs)).toBe(1);
  });
});
