import { describe, expect, it } from "vitest";
import {
  adminOrderHref,
  collectCustomerEmails,
  collectCustomerPhoneKeys,
  customerContactsMatch,
  isTelegramGroupPayment,
  normalizeCustomerEmail,
  normalizeCustomerPhoneKey,
  paidProductLabel,
  TELEGRAM_GROUP_AMOUNT_CENTS,
} from "@/lib/admin-customer-identity";
import { buildCustomerHistory } from "@/lib/admin-customer-history";

describe("customer identity keys", () => {
  it("normalizes email case and trim", () => {
    expect(normalizeCustomerEmail("  Foo@PROVIN.lv ")).toBe("foo@provin.lv");
  });

  it("uses last 8 phone digits so +371 matches local", () => {
    expect(normalizeCustomerPhoneKey("+371 26 123 193")).toBe("26123193");
    expect(normalizeCustomerPhoneKey("26123193")).toBe("26123193");
  });

  it("does not treat empty or short phones as a match", () => {
    expect(collectCustomerPhoneKeys(["", "12345", null])).toEqual([]);
    expect(
      customerContactsMatch({ emails: [], phones: [""] }, { emails: [], phones: [""] }),
    ).toBeNull();
  });

  it("matches on email or phone and reports both when available", () => {
    expect(
      customerContactsMatch(
        { emails: ["a@provin.lv"], phones: ["+37126123193"] },
        { emails: ["A@provin.lv"], phones: ["26123193"] },
      ),
    ).toBe("email_and_phone");
    expect(
      customerContactsMatch(
        { emails: ["a@provin.lv"], phones: [] },
        { emails: ["a@provin.lv"], phones: ["26123193"] },
      ),
    ).toBe("email");
    expect(
      customerContactsMatch(
        { emails: ["other@provin.lv"], phones: ["26123193"] },
        { emails: ["a@provin.lv"], phones: ["+371 26 123 193"] },
      ),
    ).toBe("phone");
  });

  it("collects unique valid emails", () => {
    expect(collectCustomerEmails(["A@x.lv", "a@x.lv", "not-an-email", null])).toEqual(["a@x.lv"]);
  });
});

describe("telegram vs audit amounts", () => {
  it("flags 9,99 € not 99,99 €", () => {
    expect(TELEGRAM_GROUP_AMOUNT_CENTS).toBe(999);
    expect(isTelegramGroupPayment(999)).toBe(true);
    expect(isTelegramGroupPayment(1000)).toBe(true);
    expect(isTelegramGroupPayment(900)).toBe(true);
    expect(isTelegramGroupPayment(9999)).toBe(false);
    expect(isTelegramGroupPayment(3999)).toBe(false);
    expect(isTelegramGroupPayment(null)).toBe(false);
  });

  it("labels telegram before checkout_line", () => {
    expect(paidProductLabel({ checkoutLine: "audit", amountTotalCents: 999 })).toBe(
      "Telegram grupa (9,99 €)",
    );
    expect(paidProductLabel({ checkoutLine: "premium", amountTotalCents: 9999 })).toBe("PROVIN AUDITS");
    expect(paidProductLabel({ checkoutLine: "mini", amountTotalCents: 3999 })).toBe("PROVIN MINI");
    expect(paidProductLabel({ checkoutLine: "business", amountTotalCents: 6999 })).toBe("PROVIN BUSINESS");
    expect(paidProductLabel({ checkoutLine: "dealer", amountTotalCents: 1999 })).toBe("Dīlera dati");
  });

  it("routes SELECT to konsultācijas", () => {
    expect(adminOrderHref({ id: "cs_1", checkoutLine: "provin_select" })).toBe(
      "/admin/konsultacijas/cs_1",
    );
    expect(adminOrderHref({ id: "cs_2", checkoutLine: "audit" })).toBe("/admin/orders/cs_2");
  });
});

describe("buildCustomerHistory", () => {
  const peekComment = "Sveiki!\nOdometrs izskatās ticams.\nAPPROVED BY IRISS";

  it("attaches the sent listing-peek letter on email match", () => {
    const history = buildCustomerHistory({
      currentSessionId: "cs_audit",
      currentEmails: ["klients@provin.lv"],
      currentPhones: ["26123193"],
      currentAmountTotal: 9999,
      peeks: [
        {
          id: "peek-1",
          email: "klients@provin.lv",
          phone: "+37126123193",
          listingUrl: "https://ss.com/auto/1",
          createdAt: "2026-08-10T10:00:00.000Z",
          status: "completed",
          comment: peekComment,
          commentSentAt: "2026-08-10T11:00:00.000Z",
        },
        {
          id: "peek-other",
          email: "cits@provin.lv",
          phone: "20000000",
          listingUrl: "https://ss.com/auto/2",
          createdAt: "2026-08-11T10:00:00.000Z",
          status: "completed",
          comment: "cits teksts",
        },
      ],
      paid: [],
    });

    expect(history.peeks).toHaveLength(1);
    expect(history.peeks[0]?.comment).toBe(peekComment);
    expect(history.peeks[0]?.matchVia).toBe("email_and_phone");
    expect(history.flags.hasPeek).toBe(true);
    expect(history.flags.hasSentPeekComment).toBe(true);
  });

  it("matches a peek by phone when Stripe email differs", () => {
    const history = buildCustomerHistory({
      currentSessionId: "cs_audit",
      currentEmails: ["stripe@pay.lv"],
      currentPhones: ["+371 29 111 222"],
      peeks: [
        {
          id: "peek-phone",
          email: "forma@inbox.lv",
          phone: "29111222",
          listingUrl: "https://ss.com/x",
          createdAt: "2026-08-01T08:00:00.000Z",
          status: "completed",
          comment: "Nosūtītais ātrais vērtējums.",
        },
      ],
      paid: [],
    });
    expect(history.peeks[0]?.matchVia).toBe("phone");
    expect(history.peeks[0]?.comment).toBe("Nosūtītais ātrais vērtējums.");
  });

  it("lists other paid orders and telegram status without duplicating the current session", () => {
    const history = buildCustomerHistory({
      currentSessionId: "cs_audit",
      currentEmails: ["a@provin.lv"],
      currentPhones: [],
      currentAmountTotal: 9999,
      peeks: [],
      paid: [
        {
          id: "cs_audit",
          created: 200,
          amountTotal: 9999,
          currency: "EUR",
          checkoutLine: "premium",
          vin: "WBA",
          emails: ["a@provin.lv"],
          phones: [],
        },
        {
          id: "cs_tg",
          created: 100,
          amountTotal: 999,
          currency: "EUR",
          checkoutLine: "audit",
          vin: null,
          emails: ["a@provin.lv"],
          phones: [],
        },
        {
          id: "cs_mini",
          created: 150,
          amountTotal: 3999,
          currency: "EUR",
          checkoutLine: "mini",
          vin: "WVW",
          emails: ["a@provin.lv"],
          phones: [],
        },
        {
          id: "cs_demo",
          created: 180,
          amountTotal: 9999,
          currency: "EUR",
          emails: ["a@provin.lv"],
          phones: [],
          isDemo: true,
        },
      ],
    });

    expect(history.otherPaid.map((r) => r.id)).toEqual(["cs_mini", "cs_tg"]);
    expect(history.otherPaid.find((r) => r.id === "cs_tg")?.isTelegramGroup).toBe(true);
    expect(history.flags.telegramGroup).toBe(true);
    expect(history.flags.repeatPaid).toBe(true);
  });
});
