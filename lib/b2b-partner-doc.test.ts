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
});
