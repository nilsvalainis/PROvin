import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildDealerRefundRequestBody,
  dealerRefundConfirmMessage,
  dealerRefundEmailSheetHint,
  dealerRefundResultNotice,
  resolveDealerRefundActionKind,
  resolveDealerRefundClientEmail,
  shouldOpenDealerRefundEmailSheet,
  shouldSendDealerStripeRefundEmail,
} from "@/lib/admin-dealer-data-refund";

describe("shouldSendDealerStripeRefundEmail", () => {
  it("sūta, ja karogs izlaists vai true (opt-out, ne opt-in)", () => {
    expect(shouldSendDealerStripeRefundEmail(undefined)).toBe(true);
    expect(shouldSendDealerStripeRefundEmail(true)).toBe(true);
    expect(shouldSendDealerStripeRefundEmail(null)).toBe(true);
  });

  it("nesūta tikai pie skaidra false", () => {
    expect(shouldSendDealerStripeRefundEmail(false)).toBe(false);
  });
});

describe("buildDealerRefundRequestBody", () => {
  it("B2C Stripe galvenā atmaksa prasa paziņojuma e-pastu", () => {
    expect(
      buildDealerRefundRequestBody({ sessionId: "cs_live_a1a05IWM", kind: "stripe" }),
    ).toEqual({ sessionId: "cs_live_a1a05IWM", notifyEmail: true });
  });

  it("B2B kredīts / maks paliek pie sava paziņojuma ceļa", () => {
    expect(
      buildDealerRefundRequestBody({ sessionId: "manual_order_1", kind: "credit" }),
    ).toEqual({ sessionId: "manual_order_1", notifyEmail: false });
    expect(
      buildDealerRefundRequestBody({ sessionId: "manual_order_w", kind: "wallet" }),
    ).toEqual({ sessionId: "manual_order_w", notifyEmail: false });
  });
});

describe("resolveDealerRefundActionKind", () => {
  it("atpazīst Stripe, kredītu un maku", () => {
    expect(resolveDealerRefundActionKind({ sessionId: "cs_test_1" })).toBe("stripe");
    expect(resolveDealerRefundActionKind({ sessionId: "manual_order_1" })).toBe("credit");
    expect(
      resolveDealerRefundActionKind({ sessionId: "manual_order_1", walletRefund: true }),
    ).toBe("wallet");
  });
});

describe("resolveDealerRefundClientEmail", () => {
  it("ņem pirmo derīgo adresi", () => {
    expect(
      resolveDealerRefundClientEmail([
        "",
        "nav-epasts",
        "  siatoplinecars@gmail.com  ",
        "other@example.com",
      ]),
    ).toBe("siatoplinecars@gmail.com");
  });

  it("tukšs, ja nav derīgas adreses", () => {
    expect(resolveDealerRefundClientEmail([null, " ", "foo@"])).toBe("");
  });
});

describe("dealer refund operator copy", () => {
  it("Stripe apstiprinājums sola e-pastu, ne atsevišķu pogu", () => {
    const confirm = dealerRefundConfirmMessage("stripe");
    expect(confirm).toMatch(/e-pasts/i);
    expect(confirm).not.toMatch(/atsevišķi/);
    expect(confirm).not.toMatch(/ja vajag/);
  });

  it("veiksmīga Stripe atmaksa rāda emailSent", () => {
    expect(
      dealerRefundResultNotice({ kind: "stripe", ok: true, emailSent: true }),
    ).toBe("Atmaksa veikta. E-pasts nosūtīts klientam.");
    expect(
      shouldOpenDealerRefundEmailSheet({ kind: "stripe", ok: true, emailSent: true }),
    ).toBe(false);
  });

  it("pēc veiksmīgas atmaksas, ja e-pasts neizdevās, paliek retry teksts", () => {
    expect(
      dealerRefundResultNotice({
        kind: "stripe",
        ok: true,
        emailSent: false,
        emailError: "send_failed",
      }),
    ).toMatch(/e-pastu nesanāca nosūtīt/);
    expect(
      dealerRefundResultNotice({
        kind: "stripe",
        ok: true,
        emailSent: false,
        emailError: "no_recipient",
      }),
    ).toMatch(/e-pasta nav/);
    expect(
      shouldOpenDealerRefundEmailSheet({ kind: "stripe", ok: true, emailSent: false }),
    ).toBe(true);
    expect(dealerRefundEmailSheetHint({ kind: "stripe", emailSent: false })).toMatch(
      /Atmaksa jau veikta/,
    );
  });

  it("admin strip un refund API vairs nepadara paziņojumu par atsevišķu soli", () => {
    const strip = readFileSync(
      join(process.cwd(), "components/admin/AdminDealerDataJobStrip.tsx"),
      "utf8",
    );
    const route = readFileSync(
      join(process.cwd(), "app/api/admin/dealer-data/refund/route.ts"),
      "utf8",
    );
    expect(strip).not.toMatch(/notifyEmail:\s*false/);
    expect(strip).toContain("buildDealerRefundRequestBody");
    expect(strip).not.toMatch(/Nosūti e-pastu ar „Nosūtīt e-pastu”, ja vajag/);
    expect(route).not.toMatch(/notifyEmail === true/);
    expect(route).toContain("shouldSendDealerStripeRefundEmail");
    expect(route).toContain("trySendDealerDataRefundEmail");
  });

  it("maka ceļš paliek ar IRISS e-pastu, kredīts paliek manuāls", () => {
    expect(dealerRefundConfirmMessage("wallet")).toMatch(/IRISS e-pastu/);
    expect(dealerRefundConfirmMessage("credit")).toMatch(/atsevišķi/);
    expect(
      shouldOpenDealerRefundEmailSheet({ kind: "wallet", ok: true, emailSent: true }),
    ).toBe(false);
    expect(
      shouldOpenDealerRefundEmailSheet({ kind: "credit", ok: true, emailSent: false }),
    ).toBe(true);
  });
});
