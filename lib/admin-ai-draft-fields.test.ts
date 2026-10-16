import { describe, expect, it } from "vitest";
import {
  aiDraftFieldFromAiUrl,
  mergeAiDraftMaps,
  snapshotAiEditedFromFields,
} from "@/lib/admin-ai-draft-fields";

describe("ai draft vs edited revisions", () => {
  it("maps ✨ URLs to field keys", () => {
    expect(aiDraftFieldFromAiUrl("/api/admin/ai/technical-risk-analysis")).toBe("technical_risks");
    expect(aiDraftFieldFromAiUrl("/api/admin/ai/summary-analysis")).toBe("summary");
    expect(aiDraftFieldFromAiUrl("/api/admin/ai/unknown")).toBeNull();
  });

  it("keeps the newer draft per field", () => {
    const merged = mergeAiDraftMaps(
      {
        summary: { model: "old", promptVersion: "a", text: "vecs", ts: "2026-01-01T00:00:00.000Z" },
      },
      {
        summary: { model: "gemini-flash", promptVersion: "b", text: "jauns", ts: "2026-10-16T00:00:00.000Z" },
      },
    );
    expect(merged.summary?.text).toBe("jauns");
    expect(merged.summary?.model).toBe("gemini-flash");
  });

  it("snapshots final edited text against the last draft timestamp", () => {
    const edited = snapshotAiEditedFromFields(
      { summary: "Operators laboja kopsavilkumu." },
      { summary: { model: "flash", promptVersion: "x", text: "AI teksts", ts: "2026-10-16T10:00:00.000Z" } },
      "2026-10-16T12:00:00.000Z",
    );
    expect(edited.summary?.text).toMatch(/Operators/);
    expect(edited.summary?.fromDraftTs).toBe("2026-10-16T10:00:00.000Z");
  });
});
