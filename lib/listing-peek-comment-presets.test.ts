import { describe, expect, it } from "vitest";
import {
  LISTING_PEEK_COMMENT_CLOSER,
  LISTING_PEEK_COMMENT_GREETING,
  LISTING_PEEK_TOPICS,
  assembleListingPeekCustomerComment,
  insertListingPeekLetterSentence,
  listingPeekPhraseByTone,
  parseListingPeekAiPayload,
  parseListingPeekCustomerComment,
  stripListingPeekMarkdown,
} from "@/lib/listing-peek-comment-presets";

describe("assembleListingPeekCustomerComment", () => {
  it("builds the numbered letter the operator already sends", () => {
    const comment = assembleListingPeekCustomerComment({
      lines: {
        odometer: listingPeekPhraseByTone("odometer", "positive"),
        incidents: listingPeekPhraseByTone("incidents", "caution"),
        technical: listingPeekPhraseByTone("technical", "caution"),
        seller: listingPeekPhraseByTone("seller", "positive"),
        photos: listingPeekPhraseByTone("photos", "positive"),
      },
    });
    expect(comment.startsWith(`${LISTING_PEEK_COMMENT_GREETING}\n\n`)).toBe(true);
    expect(comment).toContain("1. Pēc sākotnējo datu apstrādes odometra rādījumi");
    expect(comment).toContain("2. Negadījumu vēsturi šajā gadījumā nav iespējams izvērtēt");
    expect(comment).toContain("3. Tehniskās nianses šajā gadījumā nav iespējams pilnībā izvērtēt");
    expect(comment).toContain("4. Pēc sākotnējo datu apstrādes pārdevēja profils izskatās labs");
    expect(comment).toContain("5. Virspusēji apskatot, bildēs būtiski trūkumi netika konstatēti.");
    expect(comment).not.toContain(LISTING_PEEK_COMMENT_CLOSER);
  });

  it("skips empty topics and renumbers", () => {
    const comment = assembleListingPeekCustomerComment({
      greeting: false,
      lines: {
        incidents: listingPeekPhraseByTone("incidents", "caution"),
        photos: listingPeekPhraseByTone("photos", "concern"),
      },
    });
    expect(comment).toBe(
      [
        "1. Negadījumu vēsturi šajā gadījumā nav iespējams izvērtēt bez padziļinātas pārbaudes maksas reģistros.",
        "2. Sludinājuma bildēs tika pamanītas vietas, kuras noteikti būs padziļināti jāvērtē klātienē.",
      ].join("\n"),
    );
  });

  it("appends the optional closer after the points", () => {
    const comment = assembleListingPeekCustomerComment({
      closer: true,
      lines: { technical: listingPeekPhraseByTone("technical", "caution") },
    });
    expect(comment.endsWith(LISTING_PEEK_COMMENT_CLOSER)).toBe(true);
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

  it("round-trips a sent letter back into the five topic fields", () => {
    const lines = {
      odometer: listingPeekPhraseByTone("odometer", "positive"),
      incidents: listingPeekPhraseByTone("incidents", "caution"),
      technical: listingPeekPhraseByTone("technical", "caution"),
      seller: listingPeekPhraseByTone("seller", "positive"),
      photos: listingPeekPhraseByTone("photos", "positive"),
    };
    const parsed = parseListingPeekCustomerComment(
      assembleListingPeekCustomerComment({ closer: true, lines }),
    );
    expect(parsed.closer).toBe(true);
    expect(parsed.lines).toEqual({
      odometer: lines.odometer,
      incidents: lines.incidents,
      technical: lines.technical,
      seller: lines.seller,
      photos: lines.photos,
    });
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
          closer: true,
        }) +
        "\n```",
    );
    expect(parsed?.closer).toBe(true);
    expect(parsed?.lines.odometer).toBe(listingPeekPhraseByTone("odometer", "caution"));
    expect(parsed?.lines.technical).toBe(listingPeekPhraseByTone("technical", "positive"));
    expect(parsed?.lines.photos).toBe(listingPeekPhraseByTone("photos", "caution"));
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
      "1. Pēc sākotnējo datu apstrādes odometra rādījumi izskatās ticami, tomēr bez padziļinātas izpētes to nevaram droši apgalvot.",
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
  it("inserts a specific sentence before the closer", () => {
    const base = assembleListingPeekCustomerComment({
      closer: true,
      lines: { technical: listingPeekPhraseByTone("technical", "caution") },
    });
    const next = insertListingPeekLetterSentence(base, "VIN no Vācijas, 2018. gads.");
    expect(next).toContain("VIN no Vācijas, 2018. gads.");
    expect(next.endsWith(LISTING_PEEK_COMMENT_CLOSER)).toBe(true);
    expect(next.indexOf("VIN no Vācijas")).toBeLessThan(next.indexOf(LISTING_PEEK_COMMENT_CLOSER));
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
  it("keeps a restrained sales tone", () => {
    const all = LISTING_PEEK_TOPICS.flatMap((t) => t.phrases.map((p) => p.text)).join("\n");
    expect(all).not.toMatch(/kritisks|anomālij|nepērc|katastrof/i);
    expect(LISTING_PEEK_TOPICS).toHaveLength(5);
    for (const topic of LISTING_PEEK_TOPICS) {
      expect(topic.phrases.map((p) => p.tone)).toEqual(["positive", "caution", "concern"]);
    }
  });
});
