import { describe, expect, it } from "vitest";
import { canonicalTemplateId, LEGACY_TO_CANONICAL_TEMPLATE_ID } from "@/lib/messages/template-aliases";
import { getMessageTemplateDef } from "@/lib/messages/registry";

describe("template aliases", () => {
  it("maps legacy ids to canonical defs", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_TO_CANONICAL_TEMPLATE_ID)) {
      expect(canonicalTemplateId(legacy)).toBe(canonical);
      expect(getMessageTemplateDef(legacy)?.id).toBe(canonical);
    }
  });

  it("does not expose removed duplicate as separate def", () => {
    expect(getMessageTemplateDef("email.dealer.no_data_refunded")).toBeDefined();
    expect(getMessageTemplateDef("email.dealer.no_data_refunded")?.id).toBe("email.dealer.no_data");
    expect(getMessageTemplateDef("wa.upsell.mini_to_audit")?.id).toBe("email.upsell.mini_to_audit");
  });
});
