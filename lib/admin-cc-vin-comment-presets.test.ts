import { describe, expect, it } from "vitest";
import {
  CC_VIN_AUCTION_CHECK_BODY,
  CC_VIN_AUCTION_CHECK_HEADING,
  applyCcVinAuctionCheckTemplate,
  applyCcVinDefaultCommentPolicy,
  isCcVinAuctionCheckComment,
  seedCcVinDefaultComment,
} from "@/lib/admin-cc-vin-comment-presets";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { ccVinTrafficLevel } from "@/lib/admin-block-traffic-status";

describe("CC.VIN izsoļu sagatave", () => {
  it("jaunā pasūtījumā komentārā ir treknraksta virsraksts", () => {
    const html = createDefaultSourceBlocks().cc_vin.comments;
    expect(isCcVinAuctionCheckComment(html)).toBe(true);
    expect(html).toMatch(/<strong>Datu pārbaude izsoļu reģistros<\/strong>/);
    expect(adminRichHtmlToPlainText(html)).toContain(CC_VIN_AUCTION_CHECK_BODY);
    expect(ccVinTrafficLevel(createDefaultSourceBlocks().cc_vin)).toBe("empty");
  });

  it("pirmo datu lauku aizpildot noņem noklusējuma komentāru", () => {
    const empty = seedCcVinDefaultComment(emptyCcVinBlock());
    const filled = applyCcVinDefaultCommentPolicy(
      { ...empty, reportDate: "06.09.2026" },
      empty,
    );
    expect(filled.comments).toBe("");
  });

  it("atstāj manuāli ielikto sagatavi, ja dati jau ir", () => {
    const withData = {
      ...emptyCcVinBlock(),
      reportDate: "06.09.2026",
      comments: "",
    };
    const inserted = applyCcVinAuctionCheckTemplate(withData.comments);
    const kept = applyCcVinDefaultCommentPolicy({ ...withData, comments: inserted }, withData);
    expect(isCcVinAuctionCheckComment(kept.comments)).toBe(true);
    expect(adminRichHtmlToPlainText(kept.comments)).toContain(CC_VIN_AUCTION_CHECK_HEADING);
  });
});
