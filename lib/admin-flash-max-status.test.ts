import { describe, expect, it } from "vitest";
import {
  formatFlashMaxNetworkError,
  summarizeFlashMaxStatus,
  type FlashMaxJobResult,
} from "@/lib/admin-flash-max";

const ok = (id: string): FlashMaxJobResult => ({ id, label: id, status: "ok" });

/** Nila 27.11 gadījums: 7 sagatavoti, eļļa krīt, noslēguma pārbaudē 5 ieteikumi. */
const nils2711: FlashMaxJobResult[] = [
  ...["mileage", "incidents", "csdd", "autodna", "carvertical", "dealer_comments", "dealer_service"].map(ok),
  {
    id: "dealer_oil",
    label: "Eļļas maiņas intervāli",
    status: "error",
    detail: "AI nepaguva (savienojums pārtrūka) - spied ✨ šim laukam",
  },
];

describe("FLASH MAX kompaktais statuss (rīkjoslas čipa)", () => {
  it("viena īsa rinda: skaits · kļūdas · ieteikumi", () => {
    const s = summarizeFlashMaxStatus({ busy: false, results: nils2711, reviewStatus: "done", reviewPending: 5 })!;
    expect(s.chip).toBe("FLASH MAX: 7 · 1 kļūda · 5 ieteikumi");
    expect(s.chip).not.toContain("\n");
    expect(s.tone).toBe("error");
    expect(s.failed.map((f) => f.id)).toEqual(["dealer_oil"]);
    expect(s.reviewLine).toContain("5 ieteikumi");
  });

  it("latviešu skaitļa formas (1, 2, 21)", () => {
    const failed = (n: number) =>
      Array.from({ length: n }, (_, i): FlashMaxJobResult => ({ id: `e${i}`, label: `e${i}`, status: "error" }));
    expect(summarizeFlashMaxStatus({ busy: false, results: [ok("a"), ...failed(2)] })!.chip).toBe("FLASH MAX: 1 · 2 kļūdas");
    expect(summarizeFlashMaxStatus({ busy: false, results: [ok("a"), ...failed(21)] })!.chip).toBe("FLASH MAX: 1 · 21 kļūda");
    expect(
      summarizeFlashMaxStatus({ busy: false, results: [ok("a")], reviewStatus: "done", reviewPending: 1 })!.chip,
    ).toBe("FLASH MAX: 1 · 1 ieteikums");
  });

  it("bez kļūdām un ieteikumiem - zaļš; pārbaude vēl iet - «pārbauda…»", () => {
    const done = summarizeFlashMaxStatus({ busy: false, results: [ok("a"), ok("b")], reviewStatus: "done", reviewPending: 0 })!;
    expect(done.chip).toBe("FLASH MAX: 2");
    expect(done.tone).toBe("ok");
    const running = summarizeFlashMaxStatus({ busy: false, results: [ok("a")], reviewStatus: "running" })!;
    expect(running.chip).toBe("FLASH MAX: 1 · pārbauda…");
  });

  it("ģenerēšanas laikā rāda fāzi; bez rezultātiem un ne-busy - nekas", () => {
    expect(summarizeFlashMaxStatus({ busy: true, phase: "CSDD (3/9)", results: null })!.chip).toBe("FLASH MAX: CSDD (3/9)");
    expect(summarizeFlashMaxStatus({ busy: true, results: null })!.tone).toBe("busy");
    expect(summarizeFlashMaxStatus({ busy: false, results: null })).toBeNull();
  });

  it("nav ko ģenerēt - brīdinājums", () => {
    const s = summarizeFlashMaxStatus({
      busy: false,
      results: [{ id: "csdd", label: "CSDD", status: "skipped", detail: "nav avota datu" }],
    })!;
    expect(s.tone).toBe("warn");
    expect(s.chip).toContain("nav ko ģenerēt");
  });

  it("tīkla kļūdas teksts saka, ko darīt", () => {
    expect(formatFlashMaxNetworkError("Eļļas maiņas intervāli")).toBe(
      "Eļļas maiņas intervāli: AI nepaguva (savienojums pārtrūka) - spied ✨ šim laukam",
    );
  });
});
