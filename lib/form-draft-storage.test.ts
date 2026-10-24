import { describe, expect, it } from "vitest";
import { clearFormDraft, loadFormDraft, saveFormDraft, type FormDraftStorage } from "@/lib/form-draft-storage";

function fakeStorage(): FormDraftStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("form-draft-storage", () => {
  it("round-trips data through save/load", () => {
    const storage = fakeStorage();
    saveFormDraft(storage, "k1", { title: "Piedāvājums 1", carPrice: "15000" }, "2026-10-24T10:00:00.000Z");
    const loaded = loadFormDraft<{ title: string; carPrice: string }>(storage, "k1");
    expect(loaded?.data).toEqual({ title: "Piedāvājums 1", carPrice: "15000" });
    expect(loaded?.savedAt).toBe("2026-10-24T10:00:00.000Z");
  });

  it("returns null when there is nothing saved", () => {
    const storage = fakeStorage();
    expect(loadFormDraft(storage, "missing")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k1", "{not json");
    expect(loadFormDraft(storage, "k1")).toBeNull();
  });

  it("returns null for well-formed JSON missing the expected shape", () => {
    const storage = fakeStorage();
    storage.setItem("k1", JSON.stringify({ foo: "bar" }));
    expect(loadFormDraft(storage, "k1")).toBeNull();
  });

  it("clears a saved draft", () => {
    const storage = fakeStorage();
    saveFormDraft(storage, "k1", { a: 1 });
    clearFormDraft(storage, "k1");
    expect(loadFormDraft(storage, "k1")).toBeNull();
  });

  it("does not throw when storage.setItem throws (quota exceeded / private mode)", () => {
    const storage: FormDraftStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(() => saveFormDraft(storage, "k1", { a: 1 })).not.toThrow();
  });
});
