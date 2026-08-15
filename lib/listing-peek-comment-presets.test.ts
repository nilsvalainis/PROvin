import { describe, expect, it } from "vitest";
import {
  LISTING_PEEK_COMMENT_CLOSER,
  LISTING_PEEK_COMMENT_GREETING,
  LISTING_PEEK_TOPICS,
  assembleListingPeekCustomerComment,
  listingPeekPhraseByTone,
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
    expect(comment).toContain("1. Ticamība odometra rādījumiem");
    expect(comment).toContain("2. Negadījumi padziļināti jāpēta maksas datubāzēs.");
    expect(comment).toContain("3. Tehniski ir nianses, kas būs jāpēta klātienē.");
    expect(comment).toContain("4. Pārdevējs ar salīdzinoši labu reputāciju");
    expect(comment).toContain("5. Bildēs būtiski trūkumi netika konstatēti");
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
        "1. Negadījumi padziļināti jāpēta maksas datubāzēs.",
        "2. Bildēs ir vietas, kuras gribētos redzēt tuvāk — to var salīdzināt ar izsoļu arhīvu.",
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
