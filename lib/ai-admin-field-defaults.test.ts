import { describe, expect, it } from "vitest";
import {
  AI_ADMIN_FIELD_DEFAULT_TIER,
  aiAdminButtonOrder,
} from "@/lib/ai-admin-field-defaults";

describe("AI admin field defaults", () => {
  it("defaults comment fields to Gemini; Sonnet stays only for PDF extract", () => {
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.summary).toBe("gemini");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.source_comment).toBe("gemini-flash");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.extract).toBe("flash");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.mileage).toBe("gemini");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.technical_risks).toBe("gemini");
    expect(AI_ADMIN_FIELD_DEFAULT_TIER.seller).toBe("gemini");
  });

  it("puts the recommended tier first without dropping Opus", () => {
    expect(aiAdminButtonOrder("gemini-flash")[0]).toBe("gemini-flash");
    expect(aiAdminButtonOrder("flash")[0]).toBe("flash");
    expect(aiAdminButtonOrder("pro")).toEqual(["pro", "gemini-flash", "gemini", "flash"]);
  });
});
