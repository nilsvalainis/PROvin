import { describe, expect, it } from "vitest";
import {
  buildUnpaidOrderRows,
  compactUnpaidPendingPayload,
  isB2bUnpaidSession,
  isEligibleUnpaidCandidate,
  unpaidCheckoutProductName,
  unpaidGroupKey,
  unpaidMatchesPaidIdentity,
  type PaidOrderIdentity,
  type UnpaidReminderState,
  type UnpaidSessionCandidate,
} from "@/lib/admin-unpaid-orders-core";

const NOW = Date.parse("2026-10-19T12:00:00.000Z");
const H = 3600;
const DAY = 24 * H;

function cand(partial: Partial<UnpaidSessionCandidate> & Pick<UnpaidSessionCandidate, "id">): UnpaidSessionCandidate {
  return {
    created: Math.floor(NOW / 1000) - 26 * H,
    status: "expired",
    paymentStatus: "unpaid",
    customerEmail: "klients@example.lv",
    vin: "WVWZZZ1KZAW000123",
    amountTotal: 9999,
    currency: "eur",
    checkoutLine: "audit",
    fulfillment: null,
    partnerId: null,
    upgradeOf: null,
    reminderOf: null,
    ...partial,
  };
}

describe("unpaidMatchesPaidIdentity", () => {
  const unpaid = cand({ id: "cs_unpaid" });

  it("excludes when a paid order exists for the same email, even if the paid order is older", () => {
    expect(unpaidMatchesPaidIdentity(unpaid, [{ email: "klients@example.lv", vin: "OTHERVIN00000001" }])).toBe(true);
    expect(
      unpaidMatchesPaidIdentity(unpaid, [{ email: " KLIENTS@example.lv ", vin: null }]),
    ).toBe(true);
  });

  it("excludes when the same VIN has a paid order (before or after, other email)", () => {
    expect(
      unpaidMatchesPaidIdentity(unpaid, [{ email: "cits@example.lv", vin: "wvwzzz1kzaw000123" }]),
    ).toBe(true);
  });

  it("does not exclude a different email and different VIN", () => {
    expect(
      unpaidMatchesPaidIdentity(unpaid, [{ email: "cits@example.lv", vin: "WAUZZZF50NA000001" }]),
    ).toBe(false);
  });

  it("does not match empty VIN against other empty VINs", () => {
    const noVin = cand({ id: "cs_novin", vin: null, customerEmail: "a@b.lv" });
    expect(unpaidMatchesPaidIdentity(noVin, [{ email: "x@y.lv", vin: "" }])).toBe(false);
    expect(unpaidMatchesPaidIdentity(noVin, [{ email: "x@y.lv", vin: null }])).toBe(false);
  });

  it("treats an existing order record (manual) with VIN or email as paid identity", () => {
    const paid: PaidOrderIdentity[] = [{ email: null, vin: "WVWZZZ1KZAW000123" }];
    expect(unpaidMatchesPaidIdentity(unpaid, paid)).toBe(true);
  });
});

describe("isEligibleUnpaidCandidate / B2B", () => {
  it("rejects B2B partner, dealer, business, pack, topup", () => {
    expect(isB2bUnpaidSession(cand({ id: "a", partnerId: "ptr_0123456789abcdef" }))).toBe(true);
    expect(isB2bUnpaidSession(cand({ id: "a2", partnerId: "any-partner" }))).toBe(true);
    expect(isB2bUnpaidSession(cand({ id: "b", checkoutLine: "dealer" }))).toBe(true);
    expect(isB2bUnpaidSession(cand({ id: "c", checkoutLine: "business" }))).toBe(true);
    expect(isB2bUnpaidSession(cand({ id: "d", fulfillment: "b2b_pack" }))).toBe(true);
    expect(isB2bUnpaidSession(cand({ id: "e", fulfillment: "b2b_wallet_topup" }))).toBe(true);
    expect(isB2bUnpaidSession(cand({ id: "f", checkoutLine: "audit" }))).toBe(false);
  });

  it("rejects upsell, reminder clones, SELECT, too fresh, too old; keeps missing email", () => {
    expect(isEligibleUnpaidCandidate(cand({ id: "u", fulfillment: "order_upsell" }), NOW)).toBe(false);
    expect(isEligibleUnpaidCandidate(cand({ id: "u", upgradeOf: "cs_old" }), NOW)).toBe(false);
    expect(isEligibleUnpaidCandidate(cand({ id: "u", reminderOf: "cs_orig" }), NOW)).toBe(false);
    expect(isEligibleUnpaidCandidate(cand({ id: "u", checkoutLine: "provin_select" }), NOW)).toBe(false);
    expect(isEligibleUnpaidCandidate(cand({ id: "u", created: Math.floor(NOW / 1000) - 2 * H }), NOW)).toBe(false);
    expect(isEligibleUnpaidCandidate(cand({ id: "u", created: Math.floor(NOW / 1000) - 8 * DAY }), NOW)).toBe(false);
    expect(isEligibleUnpaidCandidate(cand({ id: "ok" }), NOW)).toBe(true);
    expect(isEligibleUnpaidCandidate(cand({ id: "noemail", customerEmail: null }), NOW)).toBe(true);
    expect(isEligibleUnpaidCandidate(cand({ id: "mini", checkoutLine: "mini" }), NOW)).toBe(true);
  });

  it("includes open sessions only after 24 h", () => {
    const openFresh = cand({ id: "o1", status: "open", created: Math.floor(NOW / 1000) - 10 * H });
    const openOld = cand({ id: "o2", status: "open", created: Math.floor(NOW / 1000) - 30 * H });
    expect(isEligibleUnpaidCandidate(openFresh, NOW)).toBe(false);
    expect(isEligibleUnpaidCandidate(openOld, NOW)).toBe(true);
  });
});

describe("buildUnpaidOrderRows", () => {
  it("drops unpaid rows when the same email or VIN is already paid, and they are not remindable", () => {
    const rows = buildUnpaidOrderRows(
      [
        cand({ id: "cs_email" }),
        cand({ id: "cs_vin", customerEmail: "cits@example.lv", vin: "WAUZZZF50NA000001" }),
        cand({ id: "cs_ok", customerEmail: "ok@example.lv", vin: "SALVA2BN6HH123456" }),
      ],
      {
        nowMs: NOW,
        paid: [
          { email: "klients@example.lv", vin: "AAAAAAAAAAAAAA001" },
          { email: "nobody@example.lv", vin: "WAUZZZF50NA000001" },
        ],
      },
    );
    expect(rows.map((r) => r.sessionId)).toEqual(["cs_ok"]);
    expect(rows[0]?.remindable).toBe(true);
    expect(compactUnpaidPendingPayload(rows).map((r) => r.sessionId)).toEqual(["cs_ok"]);
  });

  it("dedupes multiple unpaid sessions of the same email+VIN into one newest entry", () => {
    const older = cand({ id: "cs_old", created: Math.floor(NOW / 1000) - 50 * H, amountTotal: 3999 });
    const newer = cand({ id: "cs_new", created: Math.floor(NOW / 1000) - 26 * H, amountTotal: 9999 });
    const other = cand({
      id: "cs_other_vin",
      vin: "WVWZZZ1KZAW000999",
      created: Math.floor(NOW / 1000) - 27 * H,
    });
    const rows = buildUnpaidOrderRows([older, newer, other], { nowMs: NOW, paid: [] });
    expect(rows).toHaveLength(2);
    const merged = rows.find((r) => r.sessionId === "cs_new");
    expect(merged?.attemptCount).toBe(2);
    expect(merged?.aliasSessionIds).toEqual(["cs_old"]);
    expect(merged?.amountTotal).toBe(9999);
    expect(rows.find((r) => r.sessionId === "cs_other_vin")?.attemptCount).toBe(1);
  });

  it("max one reminder per email+VIN: already reminded rows stay listed but not remindable", () => {
    const reminders: UnpaidReminderState[] = [
      {
        sessionId: "cs_old",
        email: "klients@example.lv",
        vin: "WVWZZZ1KZAW000123",
        remindedAt: "2026-10-18T18:30:00.000Z",
      },
    ];
    const rows = buildUnpaidOrderRows(
      [cand({ id: "cs_new" }), cand({ id: "cs_old", created: Math.floor(NOW / 1000) - 40 * H })],
      { nowMs: NOW, paid: [], reminders },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.remindable).toBe(false);
    expect(rows[0]?.remindedAt).toBe("2026-10-18T18:30:00.000Z");
    expect(compactUnpaidPendingPayload(rows)).toEqual([]);
  });

  it("hides a group when any linked reminder is hidden", () => {
    const rows = buildUnpaidOrderRows([cand({ id: "cs_x" })], {
      nowMs: NOW,
      paid: [],
      reminders: [{ sessionId: "cs_x", email: "klients@example.lv", vin: "WVWZZZ1KZAW000123", hidden: true }],
    });
    expect(rows).toEqual([]);
  });

  it("disables send when email is invalid", () => {
    const rows = buildUnpaidOrderRows([cand({ id: "cs_bad", customerEmail: "nav-epasts" })], {
      nowMs: NOW,
      paid: [],
    });
    expect(rows[0]?.hasValidEmail).toBe(false);
    expect(rows[0]?.remindable).toBe(false);
  });

  it("lists abandoned Stripe sessions without email (VIN, product, amount, time) but they are not remindable", () => {
    const rows = buildUnpaidOrderRows(
      [
        cand({
          id: "cs_abandon",
          customerEmail: null,
          vin: "WVWZZZ1KZAW000321",
          checkoutLine: "mini",
          amountTotal: 3999,
        }),
      ],
      { nowMs: NOW, paid: [] },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("");
    expect(rows[0]?.vin).toBe("WVWZZZ1KZAW000321");
    expect(rows[0]?.productName).toBe("PROVIN MINI");
    expect(rows[0]?.amountTotal).toBe(3999);
    expect(rows[0]?.created).toBeGreaterThan(0);
    expect(rows[0]?.hasValidEmail).toBe(false);
    expect(rows[0]?.remindable).toBe(false);
    const pending = compactUnpaidPendingPayload(rows);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.email).toBe("");
    expect(pending[0]?.productName).toBe("PROVIN MINI");
    expect(pending[0]?.remindable).toBe(false);
  });

  it("dedupes no-email unpaid sessions of the same VIN, keeps separate empty identities", () => {
    const older = cand({
      id: "cs_old_abandon",
      customerEmail: null,
      vin: "WVWZZZ1KZAW000777",
      created: Math.floor(NOW / 1000) - 50 * H,
    });
    const newer = cand({
      id: "cs_new_abandon",
      customerEmail: null,
      vin: "WVWZZZ1KZAW000777",
      created: Math.floor(NOW / 1000) - 26 * H,
    });
    const otherEmpty = cand({
      id: "cs_empty_1",
      customerEmail: null,
      vin: null,
    });
    const otherEmpty2 = cand({
      id: "cs_empty_2",
      customerEmail: null,
      vin: null,
      created: Math.floor(NOW / 1000) - 27 * H,
    });
    const rows = buildUnpaidOrderRows([older, newer, otherEmpty, otherEmpty2], { nowMs: NOW, paid: [] });
    const merged = rows.find((r) => r.sessionId === "cs_new_abandon");
    expect(merged?.attemptCount).toBe(2);
    expect(merged?.aliasSessionIds).toEqual(["cs_old_abandon"]);
    expect(rows.filter((r) => r.sessionId === "cs_empty_1" || r.sessionId === "cs_empty_2")).toHaveLength(2);
  });

  it("still excludes a no-email unpaid session when the same VIN is already paid", () => {
    const rows = buildUnpaidOrderRows([cand({ id: "cs_paid_vin", customerEmail: null })], {
      nowMs: NOW,
      paid: [{ email: "cits@example.lv", vin: "WVWZZZ1KZAW000123" }],
    });
    expect(rows).toEqual([]);
  });
});

describe("unpaidGroupKey / product labels", () => {
  it("groups by VIN, then email, then session id", () => {
    expect(unpaidGroupKey({ sessionId: "cs_a", email: null, vin: "WVWZZZ1KZAW000123" })).toBe("v:WVWZZZ1KZAW000123");
    expect(unpaidGroupKey({ sessionId: "cs_a", email: "a@b.lv", vin: "" })).toBe("e:a@b.lv");
    expect(unpaidGroupKey({ sessionId: "cs_a", email: null, vin: null })).toBe("id:cs_a");
    expect(unpaidGroupKey({ sessionId: "cs_b", email: null, vin: null })).toBe("id:cs_b");
  });

  it("maps checkout lines to public product names", () => {
    expect(unpaidCheckoutProductName("mini")).toBe("PROVIN MINI");
    expect(unpaidCheckoutProductName("audit")).toBe("PROVIN AUDITS");
    expect(unpaidCheckoutProductName("premium")).toBe("PROVIN AUDITS");
    expect(unpaidCheckoutProductName(null)).toBe("PROVIN AUDITS");
  });
});
