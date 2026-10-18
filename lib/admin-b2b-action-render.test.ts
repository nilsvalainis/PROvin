import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminB2bActionLabel, AdminB2bTag } from "@/components/admin/AdminB2bAction";

describe("B2B admin action chrome", () => {
  it("renders a small B2B tag next to the label", () => {
    const html = renderToStaticMarkup(createElement(AdminB2bActionLabel, null, "Datu nav, atmaksa uz atlikumu"));
    expect(html).toContain("B2B");
    expect(html).toContain("Datu nav, atmaksa uz atlikumu");
    expect(renderToStaticMarkup(createElement(AdminB2bTag))).toContain("B2B");
  });
});
