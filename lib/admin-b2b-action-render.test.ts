import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminB2bActionLabel, AdminB2bTag } from "@/components/admin/AdminB2bAction";
import { AdminB2bCompanyVerifySummary } from "@/components/admin/AdminB2bCompanyVerifyPanel";
import { AdminB2bPartnerBackLink } from "@/components/admin/AdminB2bPartnerBackLink";
import { AdminB2bPartnerCreateForm } from "@/components/admin/AdminB2bPartnerCreateForm";
import { buildCompanyVerifyReport } from "@/lib/b2b-company-verify";
import { FIXTURE_GOOD_INPUT, fixtureSourcesGood } from "@/lib/b2b-company-verify-fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

describe("B2B admin action chrome", () => {
  it("renders a small B2B tag next to the label", () => {
    const html = renderToStaticMarkup(createElement(AdminB2bActionLabel, null, "Datu nav, atmaksa uz atlikumu"));
    expect(html).toContain("B2B");
    expect(html).toContain("Datu nav, atmaksa uz atlikumu");
    expect(renderToStaticMarkup(createElement(AdminB2bTag))).toContain("B2B");
  });

  it("links back to the partner list with a plain arrow", () => {
    const html = renderToStaticMarkup(createElement(AdminB2bPartnerBackLink));
    expect(html).toContain("Atpakaļ uz partneriem");
    expect(html).toContain("/admin/partneri");
    expect(html).toContain("←");
    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });

  it("keeps the create-partner form collapsed until the open button", () => {
    const html = renderToStaticMarkup(createElement(AdminB2bPartnerCreateForm));
    expect(html).toContain("+ Jauns partneris");
    expect(html).not.toContain("Izveidot partneri");
    expect(html).not.toContain("Uzņēmums");
    expect(html).not.toContain("Aizvērt");
  });

  it("renders green/yellow/red company checks and derigs overall", () => {
    const html = renderToStaticMarkup(
      createElement(AdminB2bCompanyVerifySummary, {
        view: {
          kind: "lead",
          id: "lead_1_abc12",
          input: FIXTURE_GOOD_INPUT,
          report: buildCompanyVerifyReport(FIXTURE_GOOD_INPUT, fixtureSourcesGood()),
          decision: "pending",
          decidedAt: null,
          cached: false,
        },
      }),
    );
    expect(html).toContain("Derīgs");
    expect(html).toContain("UR: uzņēmums pastāv");
    expect(html).toContain("VIES: PVN derīgs");
    expect(html).toContain("E-pasta domēns");
    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });

  it("disables refresh/approve/reject only while busy, not after an approved decision", () => {
    const view = {
      kind: "partner" as const,
      id: "ptr_0123456789abcdef",
      input: FIXTURE_GOOD_INPUT,
      report: buildCompanyVerifyReport(FIXTURE_GOOD_INPUT, fixtureSourcesGood()),
      decision: "approved" as const,
      decidedAt: "2026-11-06T08:01:00.000Z",
      cached: true,
    };
    const idle = renderToStaticMarkup(
      createElement(AdminB2bCompanyVerifySummary, {
        view,
        busy: false,
        onRefresh: () => undefined,
        onDecision: () => undefined,
      }),
    );
    expect(idle).toContain("Apstiprināts");
    expect(idle).toContain("Atsvaidzināt");
    expect(idle).toContain("Apstiprināt");
    expect(idle).toContain("Noraidīt");
    expect(idle.includes('disabled=""') || /(?:^|\s)disabled(?:\s|>)/.test(idle)).toBe(false);

    const busy = renderToStaticMarkup(
      createElement(AdminB2bCompanyVerifySummary, {
        view,
        busy: true,
        error: "Pārbaudes pieprasījums noildza. Mēģini vēlreiz.",
        onRefresh: () => undefined,
        onDecision: () => undefined,
      }),
    );
    expect((busy.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(busy).toContain("Pārbaudes pieprasījums noildza. Mēģini vēlreiz.");
  });
});
