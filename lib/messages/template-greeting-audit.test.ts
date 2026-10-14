import { describe, expect, it } from "vitest";
import { MESSAGE_TEMPLATE_DEFS } from "@/lib/messages/registry-data";
import { templateSampleVars } from "@/lib/messages/registry";
import { stripListingPeekCommentLeadingGreeting } from "@/lib/listing-peek-comment-presets";

const OPENING_GREETING_LINE = /^(Labdien|Sveiki)\b/i;

const QUICK_ASSESSMENT_IDS = new Set(["email.listing_peek", "wa.listing_peek"]);

function firstBodyLine(body: string): string {
  return body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0) ?? "";
}

const GREETING_IN_VAR = /^(Labdien|Sveiki)\b/i;

describe("message template greeting audit", () => {
  it("templates with fixed opening greeting do not use sample vars that repeat it", () => {
    const offenders: string[] = [];
    for (const def of MESSAGE_TEMPLATE_DEFS) {
      const first = firstBodyLine(def.body);
      if (!OPENING_GREETING_LINE.test(first)) continue;
      const samples = templateSampleVars(def);
      for (const [key, value] of Object.entries(samples)) {
        const v = value.trim();
        if (!v) continue;
        if (GREETING_IN_VAR.test(v)) {
          offenders.push(`${def.id} var ${key}`);
        }
      }
      if (def.id === "email.listing_peek" && GREETING_IN_VAR.test(samples.komentars ?? "")) {
        offenders.push(`${def.id} komentars sample`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("stripListingPeekCommentLeadingGreeting removes common duplicate openers", () => {
    expect(stripListingPeekCommentLeadingGreeting("Sveiki! Odometrs izskatās labi.")).toBe(
      "Odometrs izskatās labi.",
    );
    expect(stripListingPeekCommentLeadingGreeting("Labdien!\n\nTeksts.")).toBe("Teksts.");
    expect(stripListingPeekCommentLeadingGreeting("Sveiki, teksts.")).toBe("teksts.");
  });
});
