import { describe, expect, it } from "vitest";
import type { AutoparksFile } from "@/lib/iriss-autoparks";
import { emptyCarV2 } from "@/lib/iriss-autoparks-v2";
import { applyProblemPatch, emptyInvoice, problemsDone, servissFileIds, servissView } from "@/lib/iriss-autoparks-v2-serviss";

const f = (id: string) => ({ id, carId: "c", stage: "service", kind: "invoice", title: id, fileName: "", contentType: "application/pdf", size: 1, blobPath: "", sha256: "", scanned: true, uploadedBy: "", uploadedByName: "", createdAt: "2026-10-20T10:00:00Z", deletedAt: "" }) as AutoparksFile;

function car() {
  const c = emptyCarV2();
  c.numberCheck.fileId = "akts";
  c.service.diagFileIds = ["diag"];
  c.service.invoices = [{ ...emptyInvoice("i1", "r1", 2, "2026-10-23"), amountEur: 258.4, ai: { amountEur: 260, currency: "EUR", withVat: true, date: "", confidence: 0.9, at: "", model: "m", error: "" } }, emptyInvoice("i2", "r2", 1, "2026-10-18")];
  return c;
}

describe("Serviss skats", () => {
  it("kolēģis bez Summām (T7): nav summu, AI ieteikuma un kopsummas", () => {
    const v = servissView(car(), [f("akts"), f("diag"), f("r1"), f("r2")], { canSums: false, canConfirm: false });
    expect(v.invoices.map((i) => [i.id, i.amountEur, i.ai])).toEqual([
      ["i1", null, null],
      ["i2", null, null],
    ]);
    expect(v.totalEur).toBeNull();
    expect(JSON.stringify(v)).not.toContain("258");
  });

  it("ar Summām: summa, AI ieteikums, kopā (rēķins bez summas = 0)", () => {
    const v = servissView(car(), [f("akts"), f("r1"), f("r2")], { canSums: true, canConfirm: true });
    expect(v.invoices[0]).toMatchObject({ amountEur: 258.4, ai: { amountEur: 260 } });
    expect(v.totalEur).toBe(258.4);
    expect(v.numberCheck.files.map((x) => x.id)).toEqual(["akts"]);
  });

  it("failu proxy: Servisam pieder tikai akts, diagnostika un rēķinu faili", () => {
    const ids = servissFileIds(car());
    expect([...ids].sort()).toEqual(["akts", "diag", "r1", "r2"]);
    expect(ids.has("iegades-rekins")).toBe(false);
  });
});

describe("Problēmas", () => {
  const ctx = (canConfirm: boolean) => ({ canConfirm, actorName: "Kolēģis", now: "t", newId: () => "pX" });

  it("jauna problēma, teksts ar rindām, novērsa", () => {
    let r = applyProblemPatch([], { text: "Bremzes\nNomainīt" }, ctx(false));
    expect(r.problems).toMatchObject([{ id: "pX", text: "Bremzes\nNomainīt" }]);
    r = applyProblemPatch(r.problems, { id: "pX", fixedByService: true }, ctx(false));
    expect(r.problems[0]!.fixedByService).toBe(true);
  });

  it("'Mēs apstiprinām' bez tiesības netiek mainīts; ar tiesību - jā, ar vārdu", () => {
    const base = applyProblemPatch([], { text: "x" }, ctx(true)).problems;
    expect(applyProblemPatch(base, { id: "pX", confirmedByUs: true }, ctx(false)).problems[0]!.confirmedByUs).toBe(false);
    const ok = applyProblemPatch(base, { id: "pX", confirmedByUs: true }, ctx(true)).problems[0]!;
    expect(ok).toMatchObject({ confirmedByUs: true, confirmedBy: "Kolēģis" });
  });

  it("tukšu jaunu neizveido; dzēšana; skaitītājs 1 / 2", () => {
    expect(applyProblemPatch([], { text: "  " }, ctx(true)).problems).toEqual([]);
    const two = [
      { id: "a", text: "a", fixedByService: true, confirmedByUs: true, confirmedBy: "", at: "", photoIds: [] },
      { id: "b", text: "b", fixedByService: true, confirmedByUs: false, confirmedBy: "", at: "", photoIds: [] },
    ];
    expect(problemsDone(two)).toEqual({ done: 1, total: 2 });
    expect(applyProblemPatch(two, { id: "a", remove: true }, ctx(true)).problems.map((p) => p.id)).toEqual(["b"]);
  });
});
