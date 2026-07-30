import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("geminiMaxLenForOperatorNotes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("keeps base max for short notes", async () => {
    const { geminiMaxLenForOperatorNotes } = await import("@/lib/admin-gemini-operator-notes");
    expect(geminiMaxLenForOperatorNotes("īss", 2400)).toBe(2400);
    expect(geminiMaxLenForOperatorNotes(null, 2400)).toBe(2400);
  });

  it("raises maxLen for substantial operator paste", async () => {
    const { geminiMaxLenForOperatorNotes } = await import("@/lib/admin-gemini-operator-notes");
    const long = "x".repeat(5000);
    const max = geminiMaxLenForOperatorNotes(long, 2400);
    expect(max).toBeGreaterThan(5000);
    expect(max).toBeLessThanOrEqual(14_000);
  });
});
