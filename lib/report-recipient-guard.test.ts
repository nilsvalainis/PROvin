import { describe, expect, it } from "vitest";
import {
  canSubmitSendReport,
  evaluateReportRecipient,
  isRecipientBlocked,
  maskEmail,
  orderBelongsToPartner,
  parseRecipientBlocklist,
} from "@/lib/report-recipient-guard";

const valid = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const base = {
  requested: "",
  stored: "klients@example.com",
  confirmOverride: false,
  isValidEmail: valid,
  blocklist: [] as string[],
  partnerWithRecipientEmail: null,
  order: { partnerId: null, notes: null },
};

describe("adresāta aizsardzība", () => {
  it("maskē e-pastu, domēns paliek redzams", () => {
    expect(maskEmail("klients@example.com")).toBe("kl***@example.com");
    expect(maskEmail("a@b.lv")).toBe("a***@b.lv");
    expect(maskEmail("")).toBe("");
  });

  it("bloķēto saraksts: adreses un domēni", () => {
    const list = parseRecipientBlocklist(" Test@Partner.example ,@demo.example; cits.example ");
    expect(isRecipientBlocked("test@partner.example", list)).toBe(true);
    expect(isRecipientBlocked("x@demo.example", list)).toBe(true);
    expect(isRecipientBlocked("x@cits.example", list)).toBe(true);
    expect(isRecipientBlocked("klients@example.com", list)).toBe(false);
    expect(parseRecipientBlocklist(undefined)).toEqual([]);
  });

  it("partnera piederība pēc partnerId vai partner_id piezīmēs", () => {
    expect(orderBelongsToPartner({ partnerId: "ptr_0000000000000001" }, "ptr_0000000000000001")).toBe(true);
    expect(orderBelongsToPartner({ notes: "partner_id=ptr_0000000000000001" }, "ptr_0000000000000001")).toBe(true);
    expect(orderBelongsToPartner({ notes: "partner_id=ptr_0000000000000002" }, "ptr_0000000000000001")).toBe(false);
    expect(orderBelongsToPartner({}, "ptr_0000000000000001")).toBe(false);
  });

  it("bez pieprasījuma e-pasta sūta uz saglabāto", () => {
    expect(evaluateReportRecipient(base)).toEqual({ ok: true, to: "klients@example.com", recipientOverride: false });
  });

  it("atšķirība bez apstiprinājuma -> 409, ar apstiprinājumu -> override", () => {
    const miss = evaluateReportRecipient({ ...base, requested: "cits@example.org" });
    expect(miss).toMatchObject({ ok: false, status: 409, error: "recipient_mismatch", stored: "kl***@example.com", requested: "ci***@example.org" });
    const ok = evaluateReportRecipient({ ...base, requested: "cits@example.org", confirmOverride: true });
    expect(ok).toEqual({ ok: true, to: "cits@example.org", recipientOverride: true, previousRecipientMasked: "kl***@example.com" });
  });

  it("nav adreses -> 400; nederīga pieprasījuma adrese -> 400", () => {
    expect(evaluateReportRecipient({ ...base, stored: "" })).toMatchObject({ ok: false, status: 400, error: "no_customer_email" });
    expect(evaluateReportRecipient({ ...base, requested: "nav-epasts" })).toMatchObject({ ok: false, status: 400 });
  });

  it("partnera e-pasts svešā pasūtījumā -> 409 bez override iespējas", () => {
    const r = evaluateReportRecipient({
      ...base,
      requested: "partneris@test.example",
      confirmOverride: true,
      partnerWithRecipientEmail: { id: "ptr_0000000000000001" },
    });
    expect(r).toMatchObject({ ok: false, status: 409, error: "partner_email_on_client_order" });
  });

  it("«Sūtīt» aktīva tikai ar atzīmētu «Saņēmējs pārbaudīts»", () => {
    const a = { prepared: true, email: "klients@example.com", busy: false };
    expect(canSubmitSendReport({ ...a, recipientChecked: false })).toBe(false);
    expect(canSubmitSendReport({ ...a, recipientChecked: true })).toBe(true);
    expect(canSubmitSendReport({ ...a, email: " ", recipientChecked: true })).toBe(false);
    expect(canSubmitSendReport({ ...a, busy: true, recipientChecked: true })).toBe(false);
    expect(canSubmitSendReport({ ...a, prepared: false, recipientChecked: true })).toBe(false);
  });
});
