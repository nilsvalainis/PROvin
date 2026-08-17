import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("aiMaxLenForOperatorNotes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("keeps base max for short notes", async () => {
    const { aiMaxLenForOperatorNotes } = await import("@/lib/admin-ai-operator-notes");
    expect(aiMaxLenForOperatorNotes("īss", 2400)).toBe(2400);
    expect(aiMaxLenForOperatorNotes(null, 2400)).toBe(2400);
  });

  it("raises maxLen for substantial operator paste", async () => {
    const { aiMaxLenForOperatorNotes } = await import("@/lib/admin-ai-operator-notes");
    const long = "x".repeat(5000);
    const max = aiMaxLenForOperatorNotes(long, 2400);
    expect(max).toBeGreaterThan(5000);
    expect(max).toBeLessThanOrEqual(16_000);
  });

  it("raises maxLen for a long existing draft even with short notes", async () => {
    const { aiMaxLenForOperatorNotes } = await import("@/lib/admin-ai-operator-notes");
    const max = aiMaxLenForOperatorNotes("īss", 2400, "x".repeat(5000));
    expect(max).toBeGreaterThan(5000);
    expect(max).toBeLessThanOrEqual(16_000);
  });
});
