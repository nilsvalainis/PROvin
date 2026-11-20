import { describe, expect, it } from "vitest";

import {
  applyDealerCommentReviewFindings,
  dealerCommentPlainCleanup,
  highlightMajorAssembliesInRichHtml,
} from "@/lib/dealer-comments-review-core";

describe("highlightMajorAssembliesInRichHtml", () => {
  it("izceļ lielos mezglus, neaiztiek virsrakstus un tagus", () => {
    const html =
      "<strong>Dzinējs un kārba</strong><br />2021. gadā nomainīta zobsiksna, ātrumkārbas eļļa un sajūgs. Dzinēja kods DLVB.";
    const out = highlightMajorAssembliesInRichHtml(html);
    expect(out).toContain("<strong>Dzinējs un kārba</strong>");
    expect(out).toContain("<strong>zobsiksna</strong>");
    expect(out).toContain("<strong>ātrumkārbas</strong>");
    expect(out).toContain("<strong>sajūgs</strong>");
    expect(out).toContain("<strong>Dzinēja</strong> kods");
    expect(out).not.toContain("<strong><strong>");
  });
  it("neizceļ vārdu daļas (motoreļļa) un eļļas pirmo rindu", () => {
    const out = highlightMajorAssembliesInRichHtml("Ražotāja intervāls: 15 000 km / 12 mēn. (DLVB). Motoreļļa mainīta.");
    expect(out).not.toContain("<strong>");
  });
  it("EN/DE", () => {
    expect(highlightMajorAssembliesInRichHtml("Timing belt replaced, gearbox ok.")).toContain(
      "<strong>Timing belt</strong>",
    );
    expect(highlightMajorAssembliesInRichHtml("Getriebe gewechselt")).toContain("<strong>Getriebe</strong>");
  });
});

describe("applyDealerCommentReviewFindings", () => {
  it("piemēro fragmentu labojumus, izlaiž risks un neesošus fragmentus", () => {
    const fields = [
      { id: "comments", label: "K", text: "Pēdējais serviss 2020. gadā pie 50 000 km." },
      { id: "oilChangeIntervalNotes", label: "E", text: "Ražotāja intervāls: 15 000 km / 12 mēn." },
    ];
    const { texts, applied } = applyDealerCommentReviewFindings(fields, [
      { id: "a", fieldId: "comments", kind: "fakts", reason: "r", find: "50 000 km", replace: "60 000 km" },
      { id: "b", fieldId: "comments", kind: "risks", reason: "r", find: "", replace: "Papildu teksts." },
      { id: "c", fieldId: "oilChangeIntervalNotes", kind: "valoda", reason: "r", find: "nav tāda", replace: "x" },
    ]);
    expect(applied).toBe(1);
    expect(texts.comments).toBe("Pēdējais serviss 2020. gadā pie 60 000 km.");
    expect(texts.oilChangeIntervalNotes).toBe(fields[1]!.text);
  });
  it("garās defises -> īsā", () => {
    expect(dealerCommentPlainCleanup("Dzinējs — labs – ok")).toBe("Dzinējs - labs - ok");
  });
});
