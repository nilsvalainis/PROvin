import { describe, expect, it } from "vitest";
import {
  LISTING_PEEK_COMMENT_CLOSER,
  LISTING_PEEK_COMMENT_GREETING,
  LISTING_PEEK_TOPICS,
  assembleListingPeekCustomerComment,
  insertListingPeekLetterSentence,
  joinListingPeekSentences,
  listingPeekPhraseById,
  listingPeekPhraseByTone,
  listingPeekSelectedPhraseIds,
  parseListingPeekAiPayload,
  parseListingPeekCustomerComment,
  removeListingPeekSentence,
  stripListingPeekMarkdown,
  toggleListingPeekSentence,
} from "@/lib/listing-peek-comment-presets";

describe("joinListingPeekSentences", () => {
  it("continues the same paragraph after a period and one space", () => {
    expect(joinListingPeekSentences("Pirmais teikums.", "Otrais teikums.")).toBe(
      "Pirmais teikums. Otrais teikums.",
    );
    expect(joinListingPeekSentences("Sveiki!", "Ticamība ir augsta.")).toBe(
      "Sveiki! Ticamība ir augsta.",
    );
    expect(joinListingPeekSentences("Bez punkta", "Nākamais.")).toBe("Bez punkta. Nākamais.");
  });
});

describe("toggleListingPeekSentence", () => {
  it("allows multiple phrases from the same topic in order", () => {
    const labs = listingPeekPhraseByTone("odometer", "positive");
    const kritisks = listingPeekPhraseByTone("odometer", "critical");
    const once = toggleListingPeekSentence("", labs);
    const twice = toggleListingPeekSentence(once, kritisks);
    expect(twice).toBe(`${labs} ${kritisks}`);
    expect(listingPeekSelectedPhraseIds("odometer", twice)).toEqual([
      "odometer-labs",
      "odometer-kritisks",
    ]);
    const off = toggleListingPeekSentence(twice, labs);
    expect(off).toBe(kritisks);
  });

  it("removeListingPeekSentence cleans leftover spaces", () => {
    const a = listingPeekPhraseById("photos-tiras");
    const b = listingPeekPhraseById("photos-lietosanas");
    const joined = joinListingPeekSentences(a, b);
    expect(removeListingPeekSentence(joined, a)).toBe(b);
  });
});

describe("assembleListingPeekCustomerComment", () => {
  it("joins templates in one paragraph after Sveiki", () => {
    const comment = assembleListingPeekCustomerComment({
      lines: {
        odometer: listingPeekPhraseByTone("odometer", "positive"),
        incidents: listingPeekPhraseByTone("incidents", "caution"),
        technical: listingPeekPhraseByTone("technical", "caution"),
        seller: listingPeekPhraseByTone("seller", "positive"),
        photos: listingPeekPhraseByTone("photos", "positive"),
        dealer: listingPeekPhraseByTone("dealer", "positive"),
      },
    });
    expect(comment.startsWith(`${LISTING_PEEK_COMMENT_GREETING} `)).toBe(true);
    expect(comment).not.toMatch(/\n(?!\n)/);
    expect(comment).not.toContain("1. ");
    expect(comment).toContain("Sākotnējie dati norāda uz augstu odometra rādījumu ticamību");
    expect(comment).toContain(". Tāpat caur šiem avotiem ir nepieciešams padziļināti pārbaudīt");
    expect(comment).toContain(". Tehniski, šim modelim ir raksturīgas specifiskas nianses");
    expect(comment).toContain(". Attiecībā uz pārdevēju - tam ir salīdzinoši laba reputācija");
    expect(comment).toContain(". Virspusēji izvērtējot sludinājuma fotogrāfijas, būtiski vizuālie defekti netika novēroti.");
    expect(comment).toContain(". Pie nosacījuma, ka šis auto ir ticis apkopts pie oficiālā dīlera");
    expect(comment).not.toContain(LISTING_PEEK_COMMENT_CLOSER);
  });

  it("skips empty topics and still stays in one paragraph", () => {
    const comment = assembleListingPeekCustomerComment({
      greeting: false,
      lines: {
        incidents: listingPeekPhraseByTone("incidents", "caution"),
        photos: listingPeekPhraseByTone("photos", "concern"),
      },
    });
    expect(comment).toBe(
      `${listingPeekPhraseByTone("incidents", "caution")} ${listingPeekPhraseByTone("photos", "concern")}`,
    );
  });

  it("appends the optional closer after the points", () => {
    const comment = assembleListingPeekCustomerComment({
      closer: true,
      lines: { technical: listingPeekPhraseByTone("technical", "caution") },
    });
    const [body, closerBlock] = comment.split("\n\n");
    expect(body).toBe(
      `${LISTING_PEEK_COMMENT_GREETING} ${listingPeekPhraseByTone("technical", "caution")}`,
    );
    expect(body).not.toContain("\n");
    expect(closerBlock).toBe(LISTING_PEEK_COMMENT_CLOSER);
  });

  it("still reads an older numbered letter back into topic fields", () => {
    const incidents = listingPeekPhraseByTone("incidents", "caution");
    const photos = listingPeekPhraseByTone("photos", "concern");
    const parsed = parseListingPeekCustomerComment(
      `${LISTING_PEEK_COMMENT_GREETING}\n\n1. ${incidents}\n2. ${photos}\n\n${LISTING_PEEK_COMMENT_CLOSER}`,
    );
    expect(parsed.closer).toBe(true);
    expect(parsed.lines.incidents).toBe(incidents);
    expect(parsed.lines.photos).toBe(photos);
  });

  it("maps known phrases even when some topics were skipped", () => {
    const parsed = parseListingPeekCustomerComment(
      assembleListingPeekCustomerComment({
        lines: {
          incidents: listingPeekPhraseByTone("incidents", "caution"),
          photos: listingPeekPhraseByTone("photos", "concern"),
        },
      }),
    );
    expect(parsed.lines.incidents).toBe(listingPeekPhraseByTone("incidents", "caution"));
    expect(parsed.lines.photos).toBe(listingPeekPhraseByTone("photos", "concern"));
    expect(parsed.lines.odometer).toBe("");
  });

  it("round-trips a sent letter back into topic fields including dealer", () => {
    const lines = {
      odometer: listingPeekPhraseByTone("odometer", "positive"),
      incidents: listingPeekPhraseByTone("incidents", "caution"),
      technical: listingPeekPhraseByTone("technical", "caution"),
      seller: listingPeekPhraseByTone("seller", "positive"),
      photos: listingPeekPhraseByTone("photos", "positive"),
      dealer: listingPeekPhraseByTone("dealer", "caution"),
    };
    const parsed = parseListingPeekCustomerComment(
      assembleListingPeekCustomerComment({ closer: true, lines }),
    );
    expect(parsed.closer).toBe(true);
    expect(parsed.lines).toEqual(lines);
  });
});

describe("parseListingPeekAiPayload", () => {
  it("reads Flash/Gemini JSON including a fenced block", () => {
    const parsed = parseListingPeekAiPayload(
      "```json\n" +
        JSON.stringify({
          odometer: listingPeekPhraseByTone("odometer", "caution"),
          incidents: "",
          technical: listingPeekPhraseByTone("technical", "positive"),
          seller: "",
          photos: listingPeekPhraseByTone("photos", "caution"),
          dealer: listingPeekPhraseByTone("dealer", "critical"),
          closer: true,
        }) +
        "\n```",
    );
    expect(parsed?.closer).toBe(true);
    expect(parsed?.lines.odometer).toBe(listingPeekPhraseByTone("odometer", "caution"));
    expect(parsed?.lines.technical).toBe(listingPeekPhraseByTone("technical", "positive"));
    expect(parsed?.lines.photos).toBe(listingPeekPhraseByTone("photos", "caution"));
    expect(parsed?.lines.dealer).toBe(listingPeekPhraseByTone("dealer", "critical"));
    expect(parsed?.lines.incidents).toBe("");
  });

  it("strips Gemini markdown bold from letter and topic lines", () => {
    const parsed = parseListingPeekAiPayload({
      technical: "**Tehniskais salikums.** Šai automašīnai ir nianses.",
      closer: true,
      letter: [
        LISTING_PEEK_COMMENT_GREETING,
        "",
        "1. **Tehniskais salikums.** Šai automašīnai ir nianses.",
        "2. **Vēsture un pārdevējs.** Jāpēta, kā auto nonācis tirgū.",
        "",
        LISTING_PEEK_COMMENT_CLOSER,
      ].join("\n"),
    });
    expect(parsed?.lines.technical).toBe("Tehniskais salikums. Šai automašīnai ir nianses.");
    expect(parsed?.letter).toContain("1. Tehniskais salikums. Šai automašīnai ir nianses.");
    expect(parsed?.letter).toContain("2. Vēsture un pārdevējs. Jāpēta, kā auto nonācis tirgū.");
    expect(parsed?.letter).not.toContain("**");
  });

  it("keeps the full letter field so Gemini can process operator extras", () => {
    const letter = [
      LISTING_PEEK_COMMENT_GREETING,
      "",
      listingPeekPhraseByTone("odometer", "positive"),
      "",
      "VIN no Vācijas, 2018. gads, 189 000 km.",
      "",
      LISTING_PEEK_COMMENT_CLOSER,
    ].join("\n");
    const parsed = parseListingPeekAiPayload({
      odometer: listingPeekPhraseByTone("odometer", "positive"),
      closer: true,
      letter,
    });
    expect(parsed?.letter).toBe(letter);
    expect(parsed?.closer).toBe(true);
  });
});

describe("insertListingPeekLetterSentence", () => {
  it("inserts a specific sentence before the closer in the same paragraph", () => {
    const base = assembleListingPeekCustomerComment({
      closer: true,
      lines: { technical: listingPeekPhraseByTone("technical", "caution") },
    });
    const next = insertListingPeekLetterSentence(base, "VIN no Vācijas, 2018. gads.");
    expect(next).toContain(". VIN no Vācijas, 2018. gads.\n\n");
    expect(next.endsWith(LISTING_PEEK_COMMENT_CLOSER)).toBe(true);
    expect(next.indexOf("VIN no Vācijas")).toBeLessThan(next.indexOf(LISTING_PEEK_COMMENT_CLOSER));
    expect(next.split("\n\n")).toHaveLength(2);
  });
});

describe("stripListingPeekMarkdown", () => {
  it("removes paired and leftover bold markers", () => {
    expect(stripListingPeekMarkdown("1. **Tehniskais salikums.** Teksts.")).toBe(
      "1. Tehniskais salikums. Teksts.",
    );
    expect(stripListingPeekMarkdown("Atlikušas ** zvaigznes")).toBe("Atlikušas  zvaigznes");
  });
});

describe("LISTING_PEEK_TOPICS", () => {
  it("keeps operator phrases without repair EUR, panic, or em dashes", () => {
    const all = LISTING_PEEK_TOPICS.flatMap((t) => t.phrases.map((p) => p.text)).join("\n");
    expect(all).not.toMatch(/€|EUR|anomālij|nepērc|katastrof/i);
    expect(all).not.toContain("\u2014");
    expect(all).not.toContain("\u2013");
    expect(LISTING_PEEK_COMMENT_CLOSER).not.toContain("\u2014");
    expect(LISTING_PEEK_TOPICS).toHaveLength(6);
    expect(LISTING_PEEK_TOPICS.map((t) => t.phrases.length)).toEqual([7, 5, 4, 4, 5, 4]);
    for (const topic of LISTING_PEEK_TOPICS) {
      const ids = topic.phrases.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(topic.phrases[0]?.tone).toBe("positive");
    }
    expect(listingPeekPhraseByTone("odometer", "critical")).toContain("manipulāciju");
    expect(listingPeekPhraseByTone("incidents", "info")).toContain("Latvijas OCTA datubāzē");
    expect(listingPeekPhraseByTone("photos", "info")).toContain("leņķu dēļ");
    expect(listingPeekPhraseByTone("dealer", "critical")).toContain("nav iespējams");
  });
});
