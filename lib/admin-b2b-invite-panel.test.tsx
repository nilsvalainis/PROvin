import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminB2bInvitePanel } from "@/components/admin/AdminB2bInvitePanel";

describe("admin B2B invite panel pricing", () => {
  it("shows existing individual and pack price fields before the invite is created", () => {
    const html = renderToStaticMarkup(createElement(AdminB2bInvitePanel));
    expect(html).toContain("Ielūguma saite");
    expect(html).toContain("Publiska reģistrācija paliek slēgta");
    expect(html).toContain("Saite derīga 14 dienas");
    expect(html).toContain("Individuālās cenas");
    expect(html).toContain("PROVIN Business");
    expect(html).toContain("Dīlera dati (RAW)");
    expect(html).toContain("Dīlera dati (PRO)");
    expect(html).toContain("Veco kredītu paku cenas");
    expect(html).toContain("Audits · 1 gab.");
    expect(html).toContain("Izveidot ielūgumu");
    expect(html).not.toContain("Kopēt saiti");
    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});
