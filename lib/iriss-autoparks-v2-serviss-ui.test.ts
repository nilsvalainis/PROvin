import { describe, expect, it } from "vitest";
import type { V2ServissInvoiceView, V2ServissView } from "@/lib/iriss-autoparks-v2-serviss";
import {
  invoiceCardMeta,
  nextMissingServissDoc,
  problemPhotoHint,
  SERVISS_DOC_ORDER,
  SERVISS_DOC_TITLE,
  SERVISS_EMPTY_PROBLEMS_HINT,
  servissDocProgress,
  servissDocReady,
} from "@/lib/iriss-autoparks-v2-serviss-ui";

function inv(over: Partial<V2ServissInvoiceView> = {}): V2ServissInvoiceView {
  return { id: "i1", date: "2026-10-21", pages: 1, files: [], amountEur: 484, ai: null, ...over };
}

function view(over: Partial<V2ServissView> = {}): Pick<V2ServissView, "numberCheck" | "diag" | "invoices"> {
  return {
    numberCheck: { files: [], date: "" },
    diag: { files: [], date: "" },
    invoices: [],
    ...over,
  };
}

const file = { id: "f", date: "2026-10-21", contentType: "application/pdf", title: "x" };

describe("Serviss dokumentu secība A", () => {
  it("tukšā skatā nākamais ir akts, progress 0/3", () => {
    const v = view();
    expect(SERVISS_DOC_ORDER).toEqual(["number_check", "diag", "invoice"]);
    expect(nextMissingServissDoc(v)).toBe("number_check");
    expect(servissDocProgress(v)).toEqual({ done: 0, total: 3 });
    expect(SERVISS_DOC_TITLE.number_check).toBe("Numuru salīdzināšanas akts");
    expect(SERVISS_DOC_TITLE.diag).toBe("CSDD diagnostika");
  });

  it("ar aktu nākamais ir diagnostika; ar aktu un rēķinu joprojām diagnostika", () => {
    const withAkts = view({ numberCheck: { files: [file], date: "2026-10-21" } });
    expect(servissDocReady(withAkts, "number_check")).toBe(true);
    expect(nextMissingServissDoc(withAkts)).toBe("diag");
    expect(servissDocProgress(view({
      numberCheck: { files: [file], date: "2026-10-21" },
      invoices: [inv()],
    }))).toEqual({ done: 2, total: 3 });
    expect(nextMissingServissDoc(view({
      numberCheck: { files: [file], date: "2026-10-21" },
      invoices: [inv()],
    }))).toBe("diag");
  });

  it("kad visi trīs ir, nākamā nav", () => {
    const full = view({
      numberCheck: { files: [file], date: "2026-10-21" },
      diag: { files: [file], date: "2026-10-22" },
      invoices: [inv()],
    });
    expect(servissDocProgress(full)).toEqual({ done: 3, total: 3 });
    expect(nextMissingServissDoc(full)).toBeNull();
  });
});

describe("Problēmu un rēķina teksti", () => {
  it("foto skaits un tukšais mājiens bez garās svītras", () => {
    expect(problemPhotoHint(0)).toBe("Bez foto");
    expect(problemPhotoHint(1)).toBe("1 foto");
    expect(problemPhotoHint(2)).toBe("2 foto");
    expect(SERVISS_EMPTY_PROBLEMS_HINT).toBe("Problēmu vēl nav. Foto - pēc izvēles.");
    expect(SERVISS_EMPTY_PROBLEMS_HINT).not.toMatch(/[\u2013\u2014]/);
  });

  it("rēķina kartīte ņem jaunāko summu; AI tikai ja summas nav", () => {
    expect(invoiceCardMeta([])).toEqual({ date: "", amountEur: null, aiAmountEur: null });
    expect(invoiceCardMeta([inv()])).toEqual({ date: "2026-10-21", amountEur: 484, aiAmountEur: null });
    expect(invoiceCardMeta([inv({ amountEur: null, ai: { amountEur: 302.5, withVat: true, confidence: 0.8, error: "" } })])).toEqual({
      date: "2026-10-21",
      amountEur: null,
      aiAmountEur: 302.5,
    });
  });
});
