import { describe, expect, it } from "vitest";

import {
  applyDealerCommentReviewFindings,
  isDealerReviewFindingWithinLimits,
  DEALER_REVIEW_DEDUP_RULES,
  dealerCommentPlainCleanup,
  dropDealerCommentsDuplicatingOil,
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
    ], "Serviss 2020-05-01, nobraukums 60 000 km");
    expect(applied).toBe(1);
    expect(texts.comments).toBe("Pēdējais serviss 2020. gadā pie 60 000 km.");
    expect(texts.oilChangeIntervalNotes).toBe(fields[1]!.text);
  });
  it("garās defises -> īsā", () => {
    expect(dealerCommentPlainCleanup("Dzinējs — labs – ok")).toBe("Dzinējs - labs - ok");
  });
});

describe("dropDealerCommentsDuplicatingOil (Nils 22.11: komentāri dubulto apkopes)", () => {
  const oil = [
    "Ražotāja intervāls: 25 000 km / 12 mēn. (OM642).",
    "",
    "Eļļas maiņas intervāli",
    "Dīlera reģistrā fiksētas 7 secīgas dzinēja eļļas maiņas laika posmā no 2011. līdz 2015. gadam, soļi 17 300-26 400 km.",
  ].join("\n");

  it("izmet eļļas tēmas teikumus un tukšu lomu, atstāj kārbas eļļu un remontus", () => {
    const comments = [
      "Lielie mezgli un remonti",
      "14.03.2014 ar nobraukumu 127 829 km veikta automātiskās pārnesumkārbas eļļas un filtra maiņa. 2019. gadā nomainīts EGR dzesētājs.",
      "",
      "Servisa vēsture",
      "Regulāri veikta motoreļļas un filtra maiņa ik pēc 25 000 km.",
      "",
      "Ko pārbaudīt apskatē",
      "Pēc 2015. gada oktobra dīlera ierakstu nav, jāprasa pārdevēja dokumenti.",
    ].join("\n");
    const out = dropDealerCommentsDuplicatingOil(comments, oil);
    expect(out).toContain("pārnesumkārbas eļļas un filtra maiņa");
    expect(out).toContain("EGR dzesētājs");
    expect(out).not.toMatch(/motoreļļas un filtra maiņa/);
    expect(out).not.toContain("Servisa vēsture");
    expect(out).toContain("Ko pārbaudīt apskatē");
  });

  it("izmet teikumu, kas gandrīz vārds vārdā atkārto eļļas lauku", () => {
    const comments =
      "Kopsavilkums\nDīlera reģistrā fiksētas 7 secīgas dzinēja apkopes laika posmā no 2011. līdz 2015. gadam, soļi 17 300-26 400 km. Nomainīts kreisais lukturis.";
    const out = dropDealerCommentsDuplicatingOil(comments, oil);
    expect(out).not.toContain("7 secīgas");
    expect(out).toContain("Nomainīts kreisais lukturis.");
  });

  it("nenogriež teikuma sākumu pirms datuma (26.11 TMBJW7NX0MY127517)", () => {
    const comments = [
      "Lielie mezgli un remonti",
      "Ātrumkārbas eļļa dīlera datos mainīta 3 reizes, pēdējo reizi 03.12.2025 ar nobraukumu 187 902 km. Pēdējā servisa (03.12.2025, 187 902 km) ierakstā ir arī pozīcija: datu kopnes vadības bloks (darbība nav norādīta).",
      "",
      "Pārējie no 15 dīlera ierakstiem atspoguļo kārtējās apkopes un pārbaudes",
      "Atsaukumu vai garantijas kampaņu ierakstu datubāzē nav.",
    ].join("\n");
    const out = dropDealerCommentsDuplicatingOil(comments, oil);
    expect(out).toBe(comments);
    expect(out).toContain("Ātrumkārbas eļļa dīlera datos mainīta 3 reizes, pēdējo reizi 03.12.2025");
    expect(out).toContain("Pēdējā servisa (03.12.2025, 187 902 km)");
  });

  it("datums rindas sākumā un datums ar atstarpi paliek vesels", () => {
    const comments =
      "Lielie mezgli\n14.03.2014 ar nobraukumu 127 829 km nomainīts turbokompresors. Pēdējais ieraksts 17.07. 2024 ar nobraukumu 98 000 km.";
    expect(dropDealerCommentsDuplicatingOil(comments, oil)).toBe(comments);
  });

  it("tukšs vai bez dublikātiem paliek nemainīts", () => {
    expect(dropDealerCommentsDuplicatingOil("", oil)).toBe("");
    const clean = "Lielie mezgli\n2020. gadā nomainīts turbokompresors.";
    expect(dropDealerCommentsDuplicatingOil(clean, oil)).toBe(clean);
  });

  it("Opus pārbaudei ir atkārtojumu likums ar abu lauku lomām", () => {
    expect(DEALER_REVIEW_DEDUP_RULES).toMatch(/atkartojums/);
    expect(DEALER_REVIEW_DEDUP_RULES).toMatch(/oilChangeIntervalNotes/);
    expect(DEALER_REVIEW_DEDUP_RULES).toMatch(/vehicle-info table/);
    expect(DEALER_REVIEW_DEDUP_RULES).toMatch(/Ražotāja intervāls/);
  });

  it("atkārtojuma ieteikums ar tukšu aizvietojumu izdzēš fragmentu", () => {
    const fields = [{ id: "comments", label: "K", text: "A teikums. Eļļa mainīta 2015. gadā. B teikums." }];
    const r = applyDealerCommentReviewFindings(fields, [
      { id: "x", fieldId: "comments", kind: "atkartojums", reason: "Atkārto eļļas lauku.", find: " Eļļa mainīta 2015. gadā.", replace: "" },
    ]);
    expect(r.applied).toBe(1);
    expect(r.texts.comments).toBe("A teikums. B teikums.");
  });
});

describe("Opus automātisko labojumu robežas (drošība)", () => {
  const facts = "29.04.2019 Kopējais nobraukums 74 210 km. Nomainīta motoreļļa.";
  const f = (kind: "fakts" | "atkartojums" | "valoda", find: string, replace: string) => ({ kind, find, replace });

  it("pieņem mazu labojumu ar skaitli no avota datiem", () => {
    expect(isDealerReviewFindingWithinLimits(f("fakts", "pie 70 000 km", "pie 74 210 km"), facts)).toBe(true);
  });
  it("noraida jaunu skaitli, kura nav ne fragmentā, ne datos", () => {
    expect(isDealerReviewFindingWithinLimits(f("fakts", "pie 70 000 km", "pie 99 999 km"), facts)).toBe(false);
  });
  it("noraida saiti, e-pastu vai tālruni aizvietojumā", () => {
    expect(isDealerReviewFindingWithinLimits(f("valoda", "apkopes veiktas", "apkopes veiktas, sk. example.com"), facts)).toBe(false);
    expect(isDealerReviewFindingWithinLimits(f("valoda", "apkopes veiktas", "zvaniet +371 2000 0000"), facts)).toBe(false);
    expect(isDealerReviewFindingWithinLimits(f("valoda", "apkopes veiktas", "rakstiet a@b.lv"), facts)).toBe(false);
  });
  it("noraida pārāk garu fragmentu vai pārāk garu aizvietojumu", () => {
    expect(isDealerReviewFindingWithinLimits(f("fakts", "x".repeat(301), "y"), facts)).toBe(false);
    expect(isDealerReviewFindingWithinLimits(f("valoda", "īss teksts", "īss teksts ar daudz jauna satura klāt, ko avotā nav"), facts)).toBe(false);
  });
  it("atkārtojums drīkst dzēst rindkopu, bet nedrīkst pagarināt", () => {
    expect(isDealerReviewFindingWithinLimits(f("atkartojums", "a".repeat(800), ""), facts)).toBe(true);
    expect(isDealerReviewFindingWithinLimits(f("atkartojums", "īss", "garāks teksts"), facts)).toBe(false);
  });
  it("nedrīkst izdzēst „Ražotāja intervāls” rindu", () => {
    expect(isDealerReviewFindingWithinLimits(f("atkartojums", "Ražotāja intervāls: 15 000 km.", ""), facts)).toBe(false);
  });
  it("vienā laukā kopā nemaina vairāk par 60% teksta", () => {
    const text = "Pirmais teikums par remontu. Otrais teikums par remontu. Trešais teikums.";
    const r = applyDealerCommentReviewFindings(
      [{ id: "comments", label: "K", text }],
      [
        { id: "1", fieldId: "comments", kind: "atkartojums", reason: "r", find: "Pirmais teikums par remontu. ", replace: "" },
        { id: "2", fieldId: "comments", kind: "atkartojums", reason: "r", find: "Otrais teikums par remontu. ", replace: "" },
      ],
      facts,
    );
    expect(r.applied).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.texts.comments).toBe("Otrais teikums par remontu. Trešais teikums.");
  });
});
