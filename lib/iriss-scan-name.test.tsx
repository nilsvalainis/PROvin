import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/iriss/scan",
  useSearchParams: () => new URLSearchParams(),
}));

import { IrissScanEditor } from "@/components/admin/IrissScanEditor";
import { irissListingBudgetLabel, irissListingLinkedSectionTitle } from "@/lib/iriss-listing-card-actions";
import { applyIrissScanMakeModelEdit, applyIrissScanNameSuggestion, suggestIrissScanCriteriaFromName } from "@/lib/iriss-scan-criteria";
import {
  applyIrissScanAutoName,
  applyIrissScanNameEdit,
  irissScanAutoName,
  irissScanDisplayName,
  irissScanNameIsAuto,
  irissScanShareHref,
} from "@/lib/iriss-scan-name";
import { emptyIrissScanRecord, type IrissScanRecord } from "@/lib/iriss-scan-types";
import { renderHtml, renderText } from "@/lib/test-render";

/** Tā pati plūsma kā redaktorā: kritēriju kartītes izmaiņa iet caur applyIrissScanAutoName. */
function editCriteria(rec: IrissScanRecord, key: "make" | "models", raw: string): IrissScanRecord {
  return applyIrissScanAutoName(rec, applyIrissScanMakeModelEdit(rec, key, raw));
}

describe("Radara nosaukums no kritērijiem", () => {
  it("jaunam radaram nosaukums aizpildās no markas + modeļa", () => {
    let rec = emptyIrissScanRecord("s1", "t");
    rec = editCriteria(rec, "make", "Audi");
    expect(rec.brandModel).toBe("Audi");
    rec = editCriteria(rec, "models", "A6");
    expect(rec.brandModel).toBe("Audi A6");
    rec = editCriteria(rec, "models", "A4, A6");
    expect(rec.brandModel).toBe("Audi A4, A6");
    expect(rec.nameManual).toBeUndefined();
    expect(irissScanNameIsAuto(rec)).toBe(true);
  });

  it("ar roku labotu nosaukumu automātika vairs nepārraksta", () => {
    let rec = editCriteria(editCriteria(emptyIrissScanRecord("s1", "t"), "make", "Audi"), "models", "A6");
    rec = applyIrissScanNameEdit(rec, "Audi A6 salonam");
    expect(rec.nameManual).toBe(true);
    rec = editCriteria(rec, "models", "A4");
    rec = editCriteria(rec, "make", "BMW");
    expect(rec.brandModel).toBe("Audi A6 salonam");
    expect(irissScanAutoName(rec)).toBe("BMW A4");
  });

  it("notīrīts nosaukums atgriežas pie automātikas", () => {
    let rec = editCriteria(emptyIrissScanRecord("s1", "t"), "make", "Audi");
    rec = applyIrissScanNameEdit(rec, "Mans");
    rec = applyIrissScanNameEdit(rec, "");
    expect(rec.nameManual).toBeUndefined();
    rec = editCriteria(rec, "models", "Q5");
    expect(rec.brandModel).toBe("Audi Q5");
  });

  it("vecs radars ar rakstītu nosaukumu (bez nameManual) netiek pārrakstīts", () => {
    const name = "Audi 2.0D manuālis 2009-2015, 150-330k, 3000-12000 EUR";
    const old = { ...emptyIrissScanRecord("s1", "t"), brandModel: name };
    expect(irissScanNameIsAuto(old)).toBe(false);
    const saved = applyIrissScanAutoName(old, applyIrissScanNameSuggestion(old, suggestIrissScanCriteriaFromName(name)!));
    expect(saved.brandModel).toBe(name);
    expect(editCriteria(saved, "models", "A6").brandModel).toBe(name);
  });

  it("rādīšanā tukšam nosaukumam lieto ģenerēto, saglabāto nemaina", () => {
    const withCriteria = applyIrissScanMakeModelEdit(emptyIrissScanRecord("s1", "t"), "make", "Volvo");
    const structured = applyIrissScanMakeModelEdit(withCriteria, "models", "XC60");
    expect(structured.brandModel).toBe("");
    expect(irissScanDisplayName(structured)).toBe("Volvo XC60");
    expect(irissScanDisplayName({ ...structured, brandModel: "Mans radars" })).toBe("Mans radars");
  });
});

describe("Radara darbības bez klienta", () => {
  const rec = { ...emptyIrissScanRecord("8d1f2c3a-0000-4000-8000-000000000001", "t"), brandModel: "Audi A6" };

  it("redaktorā ir «Saglabāt» un «Kopīgot saiti», nav «Nosūtīt klientam»; lauks saucas «Nosaukums»", () => {
    const html = renderText(createElement(IrissScanEditor, { initialRecord: rec }));
    expect(html).toContain("Saglabāt");
    expect(html).toContain("Kopīgot saiti");
    expect(html).not.toMatch(/Nosūtīt klientam/i);
    expect(html).not.toMatch(/klient/i);
    expect(html).not.toContain("Marka modelis");
    const raw = renderHtml(createElement(IrissScanEditor, { initialRecord: rec }));
    expect(raw).toContain('aria-label="Nosaukums"');
  });

  it("«Saglabāts» rāda tikai saglabātam radaram; jaunam nesaglabātam nav, «Kopīgot saiti» atspējota", () => {
    expect(renderText(createElement(IrissScanEditor, { initialRecord: rec }))).toContain("Saglabāts");
    const draft = renderText(createElement(IrissScanEditor, { initialRecord: rec, unsavedDraft: true }));
    expect(draft).not.toContain("Saglabāts");
    const draftHtml = renderHtml(createElement(IrissScanEditor, { initialRecord: rec, unsavedDraft: true }));
    expect(draftHtml).toMatch(/<button[^>]*disabled=""[^>]*>Kopīgot saiti<\/button>/);
  });

  it("«Kopīgot saiti» kopē admin saiti uz ierakstu; nesaglabātam saites nav", () => {
    expect(irissScanShareHref("https://provin.lv/", "abc-1")).toBe("https://provin.lv/admin/iriss/scan/abc-1");
    expect(irissScanShareHref("https://provin.lv", "")).toBe("");
  });

  it("sānu panelī Radara kontekstā nav klienta tekstu", () => {
    expect(irissListingLinkedSectionTitle("radar")).not.toMatch(/klient/i);
    expect(irissListingBudgetLabel("radar")).not.toMatch(/klient/i);
    expect(irissListingLinkedSectionTitle("order")).toBe("Klients un pasūtījums");
  });
});
