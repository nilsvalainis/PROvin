import { describe, expect, it } from "vitest";
import {
  addressesMatch,
  buildCompanyVerifyReport,
  classifyEmailDomain,
  companyNamesMatch,
  decideCompanyVerifyOverall,
  normalizeCompanyName,
  parseVatHint,
  personNamesMatch,
} from "@/lib/b2b-company-verify";
import {
  FIXTURE_FREE_MAIL_INPUT,
  FIXTURE_GOOD_INPUT,
  FIXTURE_LIQUIDATED_UR,
  FIXTURE_UR_DATASTORE_COMPANY,
  FIXTURE_UR_DATASTORE_OFFICERS,
  FIXTURE_VIES_HTTP,
  FIXTURE_VIES_INVALID,
  fixtureSourcesDown,
  fixtureSourcesGood,
} from "@/lib/b2b-company-verify-fixtures";
import {
  fetchCompanyVerifySources,
  parseUrCompanyRecord,
  parseViesResponse,
} from "@/lib/b2b-company-verify-sources";
import { isFreshCompanyVerifyCache, parseCompanyVerifyCacheDoc } from "@/lib/b2b-company-verify-store";
import { normalizeB2bPartnerLeadInput } from "@/lib/b2b-partner-lead";

describe("company name normalization", () => {
  it("strips SIA, quotes and case", () => {
    expect(normalizeCompanyName('SIA "Demo Auto"')).toBe("demo auto");
    expect(normalizeCompanyName("sia „DEMO AUTO”")).toBe("demo auto");
    expect(companyNamesMatch('SIA "Demo Auto"', "sia demo auto")).toBe("exact");
    expect(companyNamesMatch("Demo Auto", "Demo Auto Serviss")).toBe("close");
    expect(companyNamesMatch("Demo Auto", "Cits Nosaukums")).toBe("none");
  });
});

describe("address and person match", () => {
  it("treats street spelling and postal code as the same address", () => {
    expect(addressesMatch("Brīvības iela 1, Rīga, LV-1010", "Brivibas 1, Riga")).toBe("exact");
    expect(addressesMatch("Maskavas 10", "Brīvības 1")).toBe("none");
  });

  it("matches First Last against UR Last First", () => {
    expect(personNamesMatch("Jānis Bērziņš", "Bērziņš Jānis")).toBe(true);
    expect(personNamesMatch("Janis Berzins", "Bērziņš Jānis")).toBe(true);
    expect(personNamesMatch("Anna Kalniņa", "Bērziņš Jānis")).toBe(false);
  });
});

describe("VAT and email domain", () => {
  it("parses LV and EU VAT from the field or the registration number", () => {
    expect(parseVatHint("LV40103123456", "")).toEqual({ country: "LV", number: "40103123456" });
    expect(parseVatHint("", "40103123456")).toEqual({ country: "LV", number: "40103123456" });
    expect(parseVatHint("DE123456789", "40103123456")).toEqual({ country: "DE", number: "123456789" });
    expect(parseVatHint("", "AB")).toBeNull();
  });

  it("flags free mail and keeps company domains green", () => {
    expect(classifyEmailDomain("janis@gmail.com")).toEqual({ kind: "free", domain: "gmail.com" });
    expect(classifyEmailDomain("info@inbox.lv")).toEqual({ kind: "free", domain: "inbox.lv" });
    expect(classifyEmailDomain("janis@demo-auto.lv")).toEqual({ kind: "company", domain: "demo-auto.lv" });
    expect(classifyEmailDomain("nav-epasts")).toEqual({ kind: "invalid", domain: "" });
  });
});

describe("buildCompanyVerifyReport", () => {
  it("marks a matching active LV company as derigs with green checks", () => {
    const report = buildCompanyVerifyReport(FIXTURE_GOOD_INPUT, fixtureSourcesGood(), new Date("2026-10-18T12:00:00Z"));
    expect(report.overall).toBe("derigs");
    const byId = Object.fromEntries(report.checks.map((row) => [row.id, row]));
    expect(byId.ur_exists?.tone).toBe("green");
    expect(byId.ur_active?.tone).toBe("green");
    expect(byId.ur_name?.tone).toBe("green");
    expect(byId.ur_address?.tone).toBe("green");
    expect(byId.ur_officer?.tone).toBe("green");
    expect(byId.vies_valid?.tone).toBe("green");
    expect(byId.vies_name?.tone).toBe("green");
    expect(byId.email_domain?.tone).toBe("green");
    expect(report.fetchedAt).toBe("2026-10-18T12:00:00.000Z");
  });

  it("marks a liquidated company and invalid VAT as saubigs", () => {
    const report = buildCompanyVerifyReport(
      { ...FIXTURE_GOOD_INPUT, companyReg: "40103999999", vatNumber: "LV40103000000" },
      {
        urCompany: { status: "ok", record: FIXTURE_LIQUIDATED_UR },
        urOfficers: { status: "ok", officers: [] },
        vies: { status: "ok", record: FIXTURE_VIES_INVALID },
      },
    );
    expect(report.overall).toBe("saubigs");
    expect(report.checks.find((row) => row.id === "ur_active")?.tone).toBe("red");
    expect(report.checks.find((row) => row.id === "vies_valid")?.tone).toBe("red");
  });

  it("keeps free mail yellow without turning the whole report red", () => {
    const report = buildCompanyVerifyReport(FIXTURE_FREE_MAIL_INPUT, fixtureSourcesGood());
    expect(report.checks.find((row) => row.id === "email_domain")?.tone).toBe("yellow");
    expect(report.checks.find((row) => row.id === "email_domain")?.detail).toContain("gmail.com");
    expect(report.overall).toBe("derigs");
  });

  it("shows nepieejams when UR and VIES are down and does not invent a match", () => {
    const report = buildCompanyVerifyReport(FIXTURE_GOOD_INPUT, fixtureSourcesDown());
    expect(report.overall).toBe("saubigs");
    for (const id of ["ur_exists", "ur_active", "ur_officer", "vies_valid"] as const) {
      expect(report.checks.find((row) => row.id === id)?.tone).toBe("unavailable");
    }
    expect(report.checks.find((row) => row.id === "email_domain")?.tone).toBe("green");
    expect(decideCompanyVerifyOverall(report.checks)).toBe("saubigs");
  });
});

describe("source parsers and fetch timeouts", () => {
  it("parses UR and VIES fixture payloads", () => {
    const company = parseUrCompanyRecord(FIXTURE_UR_DATASTORE_COMPANY.result.records[0]);
    expect(company?.regcode).toBe("40103123456");
    expect(company?.name).toContain("Demo Auto");
    const vies = parseViesResponse(FIXTURE_VIES_HTTP, "LV", "40103123456");
    expect(vies?.valid).toBe(true);
  });

  it("returns unavailable when a source times out or fails", async () => {
    const sources = await fetchCompanyVerifySources(FIXTURE_GOOD_INPUT, async () => {
      throw new Error("timeout");
    });
    expect(sources.urCompany.status).toBe("unavailable");
    expect(sources.urOfficers.status).toBe("unavailable");
    expect(sources.vies.status).toBe("unavailable");
  });

  it("reads UR and VIES fixtures through the fetch adapter", async () => {
    const sources = await fetchCompanyVerifySources(FIXTURE_GOOD_INPUT, async (url) => {
      const body = url.includes("e665114a")
        ? FIXTURE_UR_DATASTORE_OFFICERS
        : url.includes("vies")
          ? FIXTURE_VIES_HTTP
          : FIXTURE_UR_DATASTORE_COMPANY;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    expect(sources.urCompany.record?.name).toContain("Demo Auto");
    expect(sources.urOfficers.officers[0]?.name).toContain("Bērziņš");
    expect(sources.vies.record?.valid).toBe(true);
  });
});

describe("cache document", () => {
  it("parses a stored report and treats stale cache as expired", () => {
    const report = buildCompanyVerifyReport(FIXTURE_GOOD_INPUT, fixtureSourcesGood(), new Date("2026-10-18T10:00:00Z"));
    const doc = parseCompanyVerifyCacheDoc({
      version: 1,
      kind: "lead",
      id: "lead_1_abc",
      input: FIXTURE_GOOD_INPUT,
      report,
      decision: "pending",
      decidedAt: null,
      cachedAt: "2026-10-18T10:00:00.000Z",
    });
    expect(doc?.report.overall).toBe("derigs");
    expect(isFreshCompanyVerifyCache(doc, Date.parse("2026-10-18T12:00:00.000Z"))).toBe(true);
    expect(isFreshCompanyVerifyCache(doc, Date.parse("2026-10-19T12:00:00.000Z"))).toBe(false);
  });
});

describe("quote lead optional company fields", () => {
  it("keeps reg, address and VAT optional", () => {
    const input = normalizeB2bPartnerLeadInput({
      contactName: "Jānis Bērziņš",
      companyName: "Demo Auto",
      companyReg: " 40103123456 ",
      companyAddress: "Brīvības iela 1",
      vatNumber: "lv40103123456",
      phone: "+371 20000000",
      email: "janis@demo-auto.lv",
      consent: true,
    });
    expect(input.companyReg).toBe("40103123456");
    expect(input.vatNumber).toBe("LV40103123456");
    expect(normalizeB2bPartnerLeadInput({ ...input, companyReg: "", vatNumber: "", companyAddress: "" }).companyReg).toBe(
      "",
    );
  });
});
