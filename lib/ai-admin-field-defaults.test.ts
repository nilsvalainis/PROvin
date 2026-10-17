import { describe, expect, it } from "vitest";
import {
  AI_ADMIN_FIELD_DEFAULT_TIER,
  aiAdminButtonOrder,
} from "@/lib/ai-admin-field-defaults";

describe("AI admin field defaults", () => {
  it("defaults every comment field to Smart; Sonnet stays only for PDF extract", () => {
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.summary).toBe("gemini-flash");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.source_comment).toBe("gemini-flash");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.extract).toBe("flash");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.sources_comparison).toBe("gemini-flash");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.mileage).toBe("gemini-flash");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.technical_risks).toBe("gemini-flash");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.seller).toBe("gemini-flash");
  });

  it("shows only Smart and PRO buttons; recommended first", () => {
    expect(aiAdminButtonOrder("gemini-flash")).toEqual(["gemini-flash", "pro"]);
    expect(aiAdminButtonOrder("flash")).toEqual(["gemini-flash", "pro"]);
    expect(aiAdminButtonOrder("pro")).toEqual(["pro", "gemini-flash"]);
  });
});
