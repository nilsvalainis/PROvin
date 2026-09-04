import { describe, expect, it } from "vitest";
import { parseListingPeekSendCommentInput } from "@/lib/listing-peek-send-comment-input";

describe("parseListingPeekSendCommentInput", () => {
  it("pieņem id un komentāru no 8 zīmēm", () => {
    expect(parseListingPeekSendCommentInput({ id: " abc ", comment: "Labdien!" })).toEqual({
      ok: true,
      id: "abc",
      comment: "Labdien!",
    });
  });

  it("noraida īsu komentāru un tukšu id", () => {
    expect(parseListingPeekSendCommentInput({ id: "", comment: "Labdien!" })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(parseListingPeekSendCommentInput({ id: "x", comment: "īss" })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
