import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminClientReportLinkPanelView, type AdminClientReportLinkPanelProps } from "./AdminClientReportLinkControl";

const base: AdminClientReportLinkPanelProps = {
  variant: "desktop",
  status: { pdf: { available: true, version: 1, sentAt: "2026-11-20T08:00:00Z" }, active: null, ttlDays: 30 },
  url: null,
  busy: null,
  copied: false,
  error: null,
  onCreate: () => undefined,
  onRevoke: () => undefined,
  onCopy: () => undefined,
};

describe("admin «Klienta saite» panelis", () => {
  it("nav saites: poga «Izveidot klienta saiti», derīgums", () => {
    const html = renderToStaticMarkup(<AdminClientReportLinkPanelView {...base} />);
    expect(html).toContain("Izveidot klienta saiti");
    expect(html).toContain("30 dienas");
    expect(html).not.toContain("Atsaukt saiti");
  });

  it("PDF nav nosūtīts: sarkans teksts, izveide atslēgta", () => {
    const html = renderToStaticMarkup(
      <AdminClientReportLinkPanelView {...base} status={{ ...base.status!, pdf: { available: false, version: 0, sentAt: null } }} />,
    );
    expect(html).toContain("PDF vēl nav nosūtīts klientam");
    expect(html).toMatch(/disabled=""[^>]*>Izveidot klienta saiti/);
  });

  it("tikko izveidota: saite, «Kopēt», termiņš, «Atsaukt saiti»", () => {
    const html = renderToStaticMarkup(
      <AdminClientReportLinkPanelView
        {...base}
        variant="glass"
        url="https://www.provin.lv/lv/atskaite/abc"
        status={{ ...base.status!, active: { createdAt: "2026-11-22T10:00:00Z", expiresAt: "2026-12-22T10:00:00Z", locale: "lv" } }}
      />,
    );
    expect(html).toContain("https://www.provin.lv/lv/atskaite/abc");
    expect(html).toContain("Kopēt");
    expect(html).toContain("Aktīva līdz 22.12.2026");
    expect(html).toContain("Atsaukt saiti");
    expect(html).toContain("Jauna saite");
  });

  it("aktīva, bet saite nav redzama (glabājas tikai hešs)", () => {
    const html = renderToStaticMarkup(
      <AdminClientReportLinkPanelView
        {...base}
        status={{ ...base.status!, active: { createdAt: "2026-11-22T10:00:00Z", expiresAt: "2026-12-22T10:00:00Z", locale: "lv" } }}
      />,
    );
    expect(html).toContain("saiti rāda tikai izveidojot");
    expect(html).not.toContain("Kopēt");
  });
});
