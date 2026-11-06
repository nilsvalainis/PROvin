import { describe, expect, it } from "vitest";
import { AdminDealerMajorWorksEditor } from "@/components/admin/AdminDealerMajorWorksEditor";
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import {
  BMW_D17_HOOD_DATE,
  BMW_D17_HOOD_LV,
  bmwD17HoodServiceRows,
} from "@/lib/dealer-major-works.prod-corpus.fixture";
import { renderText } from "@/lib/test-render";

describe("AdminDealerMajorWorksEditor", () => {
  it("rāda D17 kapoti kā Virsbūve / stikls, ne Dzinējs", () => {
    const facts = extractDealerFactsFromServiceWorks(bmwD17HoodServiceRows(BMW_D17_HOOD_LV));
    const text = renderText(
      <AdminDealerMajorWorksEditor facts={facts} overrides={[]} onChange={() => undefined} />,
    );
    expect(text).toContain("Lielie darbi PDF");
    expect(text).toContain("D17");
    expect(text).toContain("Virsbūve / stikls");
    expect(text).toContain(BMW_D17_HOOD_DATE);
    expect(text).not.toMatch(/Dzinējs 12\.05\.2014/);
  });

  it("rāda slēpto rindu pēc manuāla hide", () => {
    const facts = extractDealerFactsFromServiceWorks(bmwD17HoodServiceRows(BMW_D17_HOOD_LV));
    const text = renderText(
      <AdminDealerMajorWorksEditor
        facts={facts}
        overrides={[{ key: "body_glass@D17", action: "hide" }]}
        onChange={() => undefined}
      />,
    );
    expect(text).toContain("slēpts");
    expect(text).toContain("Rādīt");
    expect(text).toContain("Automātiski");
  });
});
