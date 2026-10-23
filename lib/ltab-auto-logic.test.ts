import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import {
  isPdfBytes,
  ltabAutoCanApply,
  ltabCertificateHasClaims,
  ltabCertificateMismatch,
  reduceLtabProgress,
} from "@/lib/ltab-auto-logic";
import type { LtabAutoStatus } from "@/lib/ltab-auto-types";
import { emptyLtabCertificate, type LtabCertificate } from "@/lib/ltab-report-extract";

const NOW = "2026-10-23T10:00:00.000Z";

function cert(patch: Partial<LtabCertificate> = {}): LtabCertificate {
  return {
    ...emptyLtabCertificate(),
    makeModel: "BMW 640I",
    year: "2012",
    plate: "AB1234",
    accidentCount: "1",
    claims: [{ date: "12.03.2021", time: "10:15", status: "Cietušais", amount: "2930.00" }],
    ...patch,
  };
}

describe("LTAB automātika: releja progress", () => {
  it("keeps the Smart-ID control code only while awaiting confirmation", () => {
    const waiting = reduceLtabProgress(null, { jobId: "j1", ref: "cs_x", plate: "AB1234", state: "awaiting_smartid", verificationCode: "4821" }, NOW);
    expect(waiting).toMatchObject({ state: "awaiting_smartid", verificationCode: "4821", plate: "AB1234", jobId: "j1" });
    const searching = reduceLtabProgress(waiting, { jobId: "j1", ref: "cs_x", plate: "AB1234", state: "searching" }, NOW);
    expect(searching.state).toBe("searching");
    expect(searching.verificationCode).toBeUndefined();
  });

  it("ignores a malformed control code and maps relay errors to Latvian", () => {
    expect(reduceLtabProgress(null, { jobId: "j", ref: "cs_x", plate: "AB1", state: "awaiting_smartid", verificationCode: "12a4" }, NOW).verificationCode).toBeUndefined();
    const err = reduceLtabProgress(null, { jobId: "j", ref: "cs_x", plate: "AB1", state: "error", code: "smartid_timeout" }, NOW);
    expect(err.state).toBe("error");
    expect(err.message).toMatch(/Smart-ID/);
  });
});

describe("LTAB automātika: izziņa", () => {
  it("claims are CSNg rows or a positive accident count; zero is no claims", () => {
    expect(ltabCertificateHasClaims(cert())).toBe(true);
    expect(ltabCertificateHasClaims(cert({ claims: [], accidentCount: "2" }))).toBe(true);
    expect(ltabCertificateHasClaims(cert({ claims: [], accidentCount: "0" }))).toBe(false);
  });

  it("flags a certificate for another plate or make (re-issued plates)", () => {
    expect(ltabCertificateMismatch(cert(), { plate: "AB1234", make: "BMW", year: "2012" })).toBeNull();
    expect(ltabCertificateMismatch(cert(), { plate: "AB 1234", make: "bmw" })).toBeNull();
    expect(ltabCertificateMismatch(cert({ plate: "XY999" }), { plate: "AB1234" })).toMatch(/XY999/);
    expect(ltabCertificateMismatch(cert({ makeModel: "AUDI A6" }), { plate: "AB1234", make: "BMW" })).toMatch(/AUDI/);
    expect(ltabCertificateMismatch(cert({ year: "2005" }), { plate: "AB1234", make: "BMW", year: "2012" })).toMatch(/2005/);
  });

  it("auto-applies only into an empty LTAB block, once, and never on mismatch", () => {
    const empty = createDefaultSourceBlocks().ltab;
    const filled = { ...empty, comments: "Nils jau rakstīja" };
    const claims: LtabAutoStatus = { state: "claims", updatedAt: NOW, certificate: cert() };
    expect(ltabAutoCanApply(claims, empty)).toBe(true);
    expect(ltabAutoCanApply(claims, filled)).toBe(false);
    expect(ltabAutoCanApply({ ...claims, appliedAt: NOW }, empty)).toBe(false);
    expect(ltabAutoCanApply({ ...claims, mismatch: "cits auto" }, empty)).toBe(false);
    expect(ltabAutoCanApply({ state: "no_claims", updatedAt: NOW }, empty)).toBe(true);
    expect(ltabAutoCanApply({ state: "searching", updatedAt: NOW }, empty)).toBe(false);
  });

  it("recognises PDF bytes by signature", () => {
    expect(isPdfBytes(new TextEncoder().encode("%PDF-1.7 ..."))).toBe(true);
    expect(isPdfBytes(new TextEncoder().encode("<html>"))).toBe(false);
  });
});
