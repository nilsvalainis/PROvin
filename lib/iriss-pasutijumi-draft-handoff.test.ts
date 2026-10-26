import { describe, expect, it } from "vitest";
import {
  IRISS_DRAFT_HANDOFF_PREFIX,
  IRISS_DRAFT_HANDOFF_TTL_MS,
  irissDraftFieldLabel,
  takeIrissDraftHandoff,
  writeIrissDraftHandoff,
} from "@/lib/iriss-pasutijumi-draft-handoff";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const ID = "70a6fe94-c1a8-4be5-9e84-86872ded1963";

describe("iriss draft handoff (jauns pasūtījums → /pasutijumi/{id})", () => {
  it("nodod pēdējo ierakstīto tekstu un fokusu jaunajam redaktoram", () => {
    const s = memoryStorage();
    writeIrissDraftHandoff(s, ID, { id: ID, brandModel: "Toyota" }, { label: "Marka / modelis", selectionStart: 6, selectionEnd: 6 }, 1000);
    const h = takeIrissDraftHandoff<{ id: string; brandModel: string }>(s, ID, 1500);
    expect(h?.rec.brandModel).toBe("Toyota");
    expect(h?.focus).toEqual({ label: "Marka / modelis", selectionStart: 6, selectionEnd: 6 });
  });

  it("nolasa tikai vienreiz", () => {
    const s = memoryStorage();
    writeIrissDraftHandoff(s, ID, { id: ID }, null, 1000);
    expect(takeIrissDraftHandoff(s, ID, 1001)).not.toBeNull();
    expect(takeIrissDraftHandoff(s, ID, 1002)).toBeNull();
    expect(s.m.size).toBe(0);
  });

  it("novecojusi nodošana netiek lietota (nepārraksta vēlākas izmaiņas)", () => {
    const s = memoryStorage();
    writeIrissDraftHandoff(s, ID, { id: ID }, null, 1000);
    expect(takeIrissDraftHandoff(s, ID, 1000 + IRISS_DRAFT_HANDOFF_TTL_MS + 1)).toBeNull();
    expect(s.m.size).toBe(0);
  });

  it("cita pasūtījuma ieraksts vai bojāts JSON tiek ignorēts", () => {
    const s = memoryStorage();
    writeIrissDraftHandoff(s, ID, { id: "cits" }, null, 1000);
    expect(takeIrissDraftHandoff(s, ID, 1001)).toBeNull();
    s.setItem(IRISS_DRAFT_HANDOFF_PREFIX + ID, "{bojāts");
    expect(takeIrissDraftHandoff(s, ID, 1001)).toBeNull();
    expect(takeIrissDraftHandoff(s, "", 1001)).toBeNull();
  });

  it("krātuves kļūda nesalauž saglabāšanu", () => {
    const s = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    expect(() => writeIrissDraftHandoff(s, ID, { id: ID }, null, 1)).not.toThrow();
    expect(takeIrissDraftHandoff(s, ID, 1)).toBeNull();
  });

  it("lauka etiķete: aria-label, citādi label teksts", () => {
    const el = (aria: string | null, label: string | null) => ({
      getAttribute: (n: string) => (n === "aria-label" ? aria : null),
      closest: () => (label === null ? null : { textContent: label }),
    });
    expect(irissDraftFieldLabel(el("Cena no", "Cena  no"))).toBe("Cena no");
    expect(irissDraftFieldLabel(el(null, " Vārds,\n uzvārds "))).toBe("Vārds, uzvārds");
    expect(irissDraftFieldLabel(el(null, null))).toBe("");
    expect(irissDraftFieldLabel(null)).toBe("");
  });
});
