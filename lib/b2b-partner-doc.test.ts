import { describe, expect, it } from "vitest";

import { emptyB2bPartnerDoc, parseB2bPartnerDoc } from "@/lib/b2b-partner-store";
import { emptyB2bInviteDoc, parseB2bInviteDoc } from "@/lib/b2b-partner-invite-store";

describe("partner / invite JSON docs", () => {
  it("rejects a non-object partner document instead of treating it as empty", () => {
    expect(() => parseB2bPartnerDoc(null)).toThrow(/invalid_partner_doc/);
    expect(() => parseB2bPartnerDoc("[]")).toThrow(/invalid_partner_doc/);
    expect(parseB2bPartnerDoc({ partners: [] }).partners).toEqual([]);
    expect(emptyB2bPartnerDoc().partners).toEqual([]);
  });

  it("rejects a non-object invite document instead of treating it as empty", () => {
    expect(() => parseB2bInviteDoc(undefined)).toThrow(/invalid_invite_doc/);
    expect(parseB2bInviteDoc({ invites: [] }).invites).toEqual([]);
    expect(emptyB2bInviteDoc().invites).toEqual([]);
  });

  it("keeps custom invite prices and fills defaults for old invite rows", () => {
    const doc = parseB2bInviteDoc({
      invites: [
        {
          token: "inv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          createdAt: "2026-09-01T00:00:00.000Z",
          expiresAt: "2026-09-20T00:00:00.000Z",
        },
        {
          token: "inv_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          createdAt: "2026-09-01T00:00:00.000Z",
          expiresAt: "2026-09-20T00:00:00.000Z",
          walletPrices: { business: 6999, dealer_raw: null, dealer_pro: 1999 },
          prices: { business1: 5000 },
        },
      ],
    });
    expect(doc.invites[0]?.walletPrices.business).toBeNull();
    expect(doc.invites[0]?.prices.business1).toBeNull();
    expect(doc.invites[1]?.walletPrices).toEqual({ business: 6999, dealer_raw: null, dealer_pro: 1999 });
    expect(doc.invites[1]?.prices.business1).toBe(5000);
    expect(doc.invites[1]?.prices.dealer10).toBeNull();
  });
});
