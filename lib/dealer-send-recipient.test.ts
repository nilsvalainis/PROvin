import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const partnerByEmail = vi.fn<(email: string) => Promise<{ id: string } | null>>(async () => null);
vi.mock("@/lib/b2b-partner-store", () => ({ getB2bPartnerByEmail: (e: string) => partnerByEmail(e) }));

import { resolveDealerSendRecipient } from "@/lib/dealer-send-recipient";

const base = {
  logTag: "test",
  sessionId: "cs_test_1",
  confirmOverride: false,
  draftEmail: "",
  orderEmail: "klients@example.com",
  order: { partnerId: null, notes: null },
};

describe("resolveDealerSendRecipient", () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    partnerByEmail.mockResolvedValue(null);
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    delete process.env.REPORT_RECIPIENT_BLOCKLIST;
  });
  afterEach(() => warn.mockRestore());

  it("bez adreses pieprasījumā sūta uz pasūtījuma adresi", async () => {
    const r = await resolveDealerSendRecipient({ ...base, requested: "" });
    expect(r).toMatchObject({ ok: true, to: "klients@example.com", recipientOverride: false });
  });

  it("melnraksta adrese ir pirms pasūtījuma adreses", async () => {
    const r = await resolveDealerSendRecipient({ ...base, requested: "", draftEmail: "labots@example.com" });
    expect(r).toMatchObject({ ok: true, to: "labots@example.com" });
  });

  it("tā pati adrese pieprasījumā der (reģistrs un atstarpes neietekmē)", async () => {
    const r = await resolveDealerSendRecipient({ ...base, requested: " Klients@Example.com " });
    expect(r).toMatchObject({ ok: true, recipientOverride: false });
  });

  it("cita adrese bez apstiprinājuma tiek noraidīta", async () => {
    const r = await resolveDealerSendRecipient({ ...base, requested: "cits@example.org" });
    expect(r).toMatchObject({ ok: false, status: 409, error: "recipient_mismatch" });
  });

  it("cita adrese ar apstiprinājumu der, un žurnālā nav pilnas adreses", async () => {
    const r = await resolveDealerSendRecipient({ ...base, requested: "cits@example.org", confirmOverride: true });
    expect(r).toMatchObject({ ok: true, to: "cits@example.org", recipientOverride: true });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("recipient override");
    expect(logged).not.toContain("cits@example.org");
    expect(logged).not.toContain("klients@example.com");
    expect(logged).toContain("ci***@example.org");
  });

  it("nederīga adrese pieprasījumā", async () => {
    const r = await resolveDealerSendRecipient({ ...base, requested: "nav-epasts" });
    expect(r).toMatchObject({ ok: false, status: 400, error: "invalid_customer_email" });
  });

  it("bloķēto saraksts darbojas arī ar apstiprinājumu", async () => {
    process.env.REPORT_RECIPIENT_BLOCKLIST = "blocked.example";
    const r = await resolveDealerSendRecipient({ ...base, requested: "x@blocked.example", confirmOverride: true });
    expect(r).toMatchObject({ ok: false, status: 409, error: "recipient_blocked" });
  });

  it("cita partnera adrese klienta pasūtījumam tiek noraidīta", async () => {
    partnerByEmail.mockResolvedValue({ id: "partneris-1" });
    const r = await resolveDealerSendRecipient({ ...base, requested: "p@example.org", confirmOverride: true });
    expect(r).toMatchObject({ ok: false, status: 409, error: "partner_email_on_client_order" });
  });

  it("nav nevienas adreses", async () => {
    const r = await resolveDealerSendRecipient({ ...base, requested: "", orderEmail: "" });
    expect(r).toMatchObject({ ok: false, status: 400, error: "no_customer_email" });
  });
});
