import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildDealerRefundRequestBody,
  dealerRefundConfirmMessage,
  dealerRefundEmailAlreadySentPrompt,
  dealerRefundEmailSheetHint,
  dealerRefundNeedsOverride,
  dealerRefundResultNotice,
  planDealerRefund,
  resolveDealerRefundActionKind,
  resolveDealerRefundClientEmail,
  shouldOpenDealerRefundEmailSheet,
  shouldShowDealerRefundButton,
  dealerStripeRefundButtonLabel,
  dealerRefundEmailFacts,
  parseDealerStripeRefundMessage,
} from "@/lib/admin-dealer-data-refund";

describe("parseDealerStripeRefundMessage (Nils 26.11: bez loga teksta atmaksas nav)", () => {
  it("bez kanāla / teksta / temata - atteikums (vecais «uzreiz + šablons» ceļš slēgts)", () => {
    expect(parseDealerStripeRefundMessage({})).toEqual({ ok: false, error: "channel_required" });
    expect(parseDealerStripeRefundMessage({ notifyEmail: true })).toEqual({ ok: false, error: "channel_required" });
    expect(parseDealerStripeRefundMessage({ channel: "email", subject: "S", text: "  " })).toEqual({
      ok: false,
      error: "text_required",
    });
    expect(parseDealerStripeRefundMessage({ channel: "email", subject: "", text: "T" })).toEqual({
      ok: false,
      error: "subject_required",
    });
  });

  it("e-pasts: Nila rediģētais temats + teksts nemainīti; valoda no loga", () => {
    const r = parseDealerStripeRefundMessage({ channel: "email", subject: " Mans temats ", text: "Labots teksts\r\nPROVIN.LV", lang: "en" });
    expect(r).toEqual({
      ok: true,
      message: { channel: "email", subject: "Mans temats", text: "Labots teksts\nPROVIN.LV", lang: "en" },
    });
  });

  it("WhatsApp: temats nav vajadzīgs; nezināma valoda -> LV", () => {
    expect(parseDealerStripeRefundMessage({ channel: "whatsapp", text: "Sveiki", lang: "fr" })).toEqual({
      ok: true,
      message: { channel: "whatsapp", subject: "", text: "Sveiki", lang: "lv" },
    });
  });
});

describe("dealerStripeRefundButtonLabel / dealerRefundEmailFacts", () => {
  it("poga ar summu", () => {
    expect(dealerStripeRefundButtonLabel(1749, "email")).toBe("Atgriezt 17,49 € un nosūtīt");
    expect(dealerStripeRefundButtonLabel(1749, "whatsapp")).toBe("Atgriezt 17,49 € un atvērt WhatsApp");
    expect(dealerStripeRefundButtonLabel(null, "email")).toBe("Atgriezt un nosūtīt");
  });

  it("fakti tikai LV", () => {
    expect(dealerRefundEmailFacts("lv", 1749)[0]).toEqual({ value: "17,49 €", label: "atmaksāts uz karti" });
    expect(dealerRefundEmailFacts("en", 1749)).toEqual([]);
  });
});

describe("buildDealerRefundRequestBody", () => {
  it("B2B kredīts / maks: tikai sessionId (+ override)", () => {
    expect(buildDealerRefundRequestBody({ sessionId: "manual_order_1", kind: "credit" })).toEqual({ sessionId: "manual_order_1" });
    expect(buildDealerRefundRequestBody({ sessionId: "manual_order_w", kind: "wallet" })).toEqual({ sessionId: "manual_order_w" });
    expect(buildDealerRefundRequestBody({ sessionId: "manual_order_1", kind: "credit", override: true })).toEqual({
      sessionId: "manual_order_1",
      override: true,
    });
  });
});

describe("shouldShowDealerRefundButton", () => {
  it("rāda pie no_data, failed un bez job, ja canRefund un vēl nav atmaksas", () => {
    expect(shouldShowDealerRefundButton({ canRefund: true, job: { status: "no_data" } })).toBe(true);
    expect(shouldShowDealerRefundButton({ canRefund: true, job: { status: "failed" } })).toBe(true);
    expect(shouldShowDealerRefundButton({ canRefund: true, job: null })).toBe(true);
  });

  it("nerāda pending / running / done, jau atmaksātu vai bez canRefund", () => {
    expect(shouldShowDealerRefundButton({ canRefund: true, job: { status: "pending" } })).toBe(false);
    expect(shouldShowDealerRefundButton({ canRefund: true, job: { status: "running" } })).toBe(false);
    expect(shouldShowDealerRefundButton({ canRefund: true, job: { status: "done" } })).toBe(false);
    expect(
      shouldShowDealerRefundButton({
        canRefund: true,
        job: { status: "failed", refund: { at: "2026-11-03" } },
      }),
    ).toBe(false);
    expect(shouldShowDealerRefundButton({ canRefund: false, job: { status: "no_data" } })).toBe(false);
    expect(shouldShowDealerRefundButton({ canRefund: false, job: null })).toBe(false);
    expect(shouldShowDealerRefundButton({ job: { status: "no_data" } })).toBe(false);
  });
});

describe("dealerRefundNeedsOverride / planDealerRefund", () => {
  it("tīram no_data nesūta override", () => {
    expect(dealerRefundNeedsOverride({ status: "no_data" })).toBe(false);
    const plan = planDealerRefund({
      sessionId: "manual_order_1",
      walletRefund: true,
      job: { status: "no_data" },
    });
    expect(plan.override).toBe(false);
    expect(plan.requestBody).toEqual({ sessionId: "manual_order_1" });
    expect(plan.confirmMessage).not.toMatch(/override/);
    expect(plan.confirmMessage).toMatch(/IRISS e-pastu/);
  });

  it("failed un trūkstošam job sūta override: true un prasa override apstiprinājumu", () => {
    expect(dealerRefundNeedsOverride({ status: "failed" })).toBe(true);
    expect(dealerRefundNeedsOverride(null)).toBe(true);

    const failed = planDealerRefund({
      sessionId: "manual_order_2",
      job: { status: "failed" },
    });
    expect(failed.kind).toBe("credit");
    expect(failed.override).toBe(true);
    expect(failed.requestBody).toEqual({ sessionId: "manual_order_2", override: true });
    expect(failed.confirmMessage).toMatch(/override/);
    expect(failed.confirmMessage).toMatch(/nav «nav datu»/);
    expect(failed.confirmMessage).toMatch(/kredītu/);

    const missing = planDealerRefund({
      sessionId: "manual_order_w",
      walletRefund: true,
      job: null,
    });
    expect(missing.requestBody).toEqual({ sessionId: "manual_order_w", override: true });
    expect(missing.confirmMessage).toMatch(/override/);
    expect(missing.confirmMessage).toMatch(/IRISS e-pastu/);
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
  it("Stripe apstiprinājums - neatgriezeniska darbība, bez «atsevišķi»", () => {
    const confirm = dealerRefundConfirmMessage("stripe");
    expect(confirm).toMatch(/neatgriezeniska/);
    expect(confirm).not.toMatch(/atsevišķi/);
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

  it("Stripe: poga atver logu, API sūta Nila tekstu tikai pēc atmaksas (26.11)", () => {
    // Atmaksas loģika kopīga dīlera blokam un telefona B1 blokam (22.11): `useDealerDataJobControls`.
    const strip = ["components/admin/AdminDealerDataJobStrip.tsx", "components/admin/useDealerDataJobControls.ts"]
      .map((f) => readFileSync(join(process.cwd(), f), "utf8"))
      .join("\n");
    const route = readFileSync(join(process.cwd(), "app/api/admin/dealer-data/refund/route.ts"), "utf8");
    expect(strip).toContain("planDealerRefund");
    expect(strip).toContain("shouldShowDealerRefundButton");
    expect(strip).toContain("setRefundDialog(true)");
    expect(strip).toContain("AdminDealerRefundDialog");
    expect(strip).not.toMatch(/notifyEmail/);
    // Vecais šablona e-pasts uzreiz pēc atmaksas vairs netiek izsaukts.
    expect(route).not.toContain("trySendDealerDataRefundEmail");
    expect(route).toContain("parseDealerStripeRefundMessage");
    expect(route).toContain("humanSent: true");
    // Kārtība: slēdzene -> Stripe -> e-pasts.
    const lockAt = route.indexOf("claimDealerRefundLock(sessionId");
    const stripeAt = route.indexOf("stripe.refunds.create(");
    const mailAt = route.indexOf("trySendDealerDataOperatorEmail({");
    expect(lockAt).toBeGreaterThan(0);
    expect(stripeAt).toBeGreaterThan(lockAt);
    expect(mailAt).toBeGreaterThan(stripeAt);

    const workspace = readFileSync(
      join(process.cwd(), "components/admin/OrderDetailWorkspace.tsx"),
      "utf8",
    );
    expect(workspace).toMatch(/const dealerCanRefund =\s*payload\.sessionId\.startsWith\("cs_"\)/);
    expect(workspace).toContain("canDealerRefund={dealerCanRefund}");
    expect(workspace).toContain('(payload.notes ?? "").includes("partner_id=")');
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

describe("C2 - viens e-pasts uz atmaksu (06.11)", () => {
  it("izvēle bez e-pasta - skaidrs paziņojums", () => {
    expect(dealerRefundResultNotice({ kind: "stripe", ok: true, emailSent: false, emailSkipped: true })).toBe(
      "Atmaksa veikta bez e-pasta (Tava izvēle).",
    );
  });

  it("otrs e-pasts par to pašu atmaksu prasa apstiprinājumu", () => {
    expect(dealerRefundEmailAlreadySentPrompt(null)).toBeNull();
    expect(dealerRefundEmailAlreadySentPrompt({})).toBeNull();
    expect(dealerRefundEmailAlreadySentPrompt({ emailSentAt: "2026-11-06T10:15:00.000Z" })).toMatch(
      /^E-pasts par šo atmaksu jau nosūtīts \(06\.11.*12:15\)\. Sūtīt vēlreiz\?$/,
    );
  });

  it("atmaksas ieraksts saglabā emailSentAt arī pēc nolasīšanas (B2B maka aizsardzība)", async () => {
    const { normalizeDealerDataJob } = await import("@/lib/dealer-data-job-types");
    const job = normalizeDealerDataJob(
      {
        vin: "WVWZZZ3CZME138258",
        status: "no_data",
        refund: {
          at: "2026-11-06T10:00:00.000Z",
          amountCents: 1999,
          stripeRefundId: "wallet_x",
          by: "admin",
          reason: "r",
          emailSentAt: "2026-11-06T10:01:00.000Z",
        },
      },
      "cs_1",
    );
    expect(job?.refund?.emailSentAt).toBe("2026-11-06T10:01:00.000Z");
  });
});
