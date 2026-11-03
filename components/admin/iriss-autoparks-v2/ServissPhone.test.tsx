import { describe, expect, it } from "vitest";
import { CSDD_DOC_BADGE_SRC } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Iegade";
import {
  ServissProblemSheet,
  ServissScanSheet,
  ServissStages,
} from "@/components/admin/iriss-autoparks-v2/ServissPhone";
import type { V2Problem } from "@/lib/iriss-autoparks-v2";
import type { V2ServissInvoiceView, V2ServissView } from "@/lib/iriss-autoparks-v2-serviss";
import { SERVISS_EMPTY_PROBLEMS_HINT } from "@/lib/iriss-autoparks-v2-serviss-ui";
import { renderHtml, renderText } from "@/lib/test-render";

const file = { id: "f1", date: "2026-10-21", contentType: "application/pdf", title: "Akts" };

function inv(over: Partial<V2ServissInvoiceView> = {}): V2ServissInvoiceView {
  return { id: "i1", date: "2026-10-21", pages: 1, files: [file], amountEur: 484, ai: null, ...over };
}

function problem(over: Partial<V2Problem> = {}): V2Problem {
  return {
    id: "p1",
    text: "Skrāpējums aizmugurējā buferī",
    fixedByService: false,
    confirmedByUs: false,
    confirmedBy: "",
    at: "",
    photoIds: ["ph1", "ph2"],
    ...over,
  };
}

function view(over: Partial<V2ServissView> = {}): V2ServissView {
  return {
    numberCheck: { files: [], date: "" },
    diag: { files: [], date: "" },
    problems: [],
    notes: "",
    invoices: [],
    totalEur: null,
    canSums: true,
    canConfirm: false,
    canDelete: false,
    ...over,
  };
}

const noop = () => undefined;

function stages(v: V2ServissView, extra: { canDelete?: boolean } = {}) {
  return (
    <ServissStages
      view={{ ...v, canDelete: extra.canDelete ?? v.canDelete }}
      notesEditing={false}
      notesDraft=""
      onNotesDraft={noop}
      onNotesEdit={noop}
      onNotesSave={noop}
      onNotesCancel={noop}
      onScanDoc={noop}
      onScanInvoice={noop}
      onViewFiles={noop}
      onOpenInvoice={noop}
      onAddProblem={noop}
      onEditProblem={noop}
      onAddPhotos={noop}
      onOpenPhoto={noop}
      onDeleteProblem={noop}
      onToggleFixed={noop}
      photoUrl={(id) => `/foto/${id}`}
    />
  );
}

function sectionOrder(text: string): string[] {
  return ["Dokumenti", "Problēmas", "Servisa piezīmes", "Rēķins"].filter((label) => text.includes(label));
}

describe("Serviss A «Centra +» skats", () => {
  it("tukšā skatā rāda aktu un diagnostiku, primāro skenēšanu pie akta, lielo + un rēķinu pēdējo", () => {
    const html = renderHtml(stages(view()));
    const text = renderText(stages(view()));
    expect(sectionOrder(text)).toEqual(["Dokumenti", "Problēmas", "Servisa piezīmes", "Rēķins"]);
    expect(text).toContain("Numuru salīdzināšanas akts");
    expect(text).toContain("CSDD diagnostika");
    expect(text).toContain("0/3 dokumenti");
    expect(text).toContain("Pievienot problēmu");
    expect(text).toContain(SERVISS_EMPTY_PROBLEMS_HINT);
    expect(text).toContain("Nav piezīmju");
    expect(html).toContain("ap2-sv-bigplus");
    expect(html).not.toContain("ap2-sv-cpill");
    expect(html).not.toContain("Skenēt rēķinu");
    expect(html.match(/ap2-sv-scan pri/g)?.length).toBe(1);
    expect(html.indexOf("Numuru salīdzināšanas akts")).toBeLessThan(html.indexOf("CSDD diagnostika"));
    expect(html.indexOf("CSDD diagnostika")).toBeLessThan(html.indexOf("Pievienot problēmu"));
    expect(html.lastIndexOf("Rēķins")).toBeGreaterThan(html.indexOf("Problēmas"));
    expect((html.split("Numuru salīdzināšanas akts")[1] ?? "").split("CSDD diagnostika")[0]).toContain("ap2-sv-scan pri");
  });

  it("CSDD logo ir pie akta un diagnostikas, nav pie rēķina", () => {
    const html = renderHtml(stages(view({ numberCheck: { files: [file], date: "2026-10-21" }, invoices: [inv()] })));
    const docs = (html.split('aria-label="Dokumenti"')[1] ?? "").split('aria-label="Problēmas"')[0] ?? "";
    const invoice = html.split('aria-label="Rēķins"')[1] ?? "";
    expect(docs.match(/ap2-csdd-badge/g)?.length).toBe(2);
    expect(docs).toContain(CSDD_DOC_BADGE_SRC);
    expect(invoice).not.toContain("ap2-csdd-badge");
    expect(invoice).not.toContain(CSDD_DOC_BADGE_SRC);
    expect(invoice).toContain("ap2-sv-scan");
    expect(invoice).not.toContain("Skenēt rēķinu");
  });

  it("ar aktu un rēķinu diagnostika ir nākamā primārā, problēmas kā saraksts ar pill apakšā", () => {
    const html = renderHtml(
      stages(
        view({
          numberCheck: { files: [file], date: "2026-10-21" },
          notes: "Eļļas maiņa, bremžu kluči priekšā",
          invoices: [inv()],
          totalEur: 484,
          problems: [problem(), problem({ id: "p2", text: "Klab priekšējā piekare", photoIds: [] })],
        }),
      ),
    );
    const text = renderText(
      stages(
        view({
          numberCheck: { files: [file], date: "2026-10-21" },
          notes: "Eļļas maiņa, bremžu kluči priekšā",
          invoices: [inv()],
          problems: [problem(), problem({ id: "p2", text: "Klab priekšējā piekare", photoIds: [] })],
        }),
      ),
    );
    expect(text).toContain("2/3 dokumenti");
    expect(text).toContain("Gatavs");
    expect(text).toContain("Skatīt");
    expect(text).toContain("Nākamais");
    expect(text).toContain("2 foto");
    expect(text).toContain("Bez foto");
    expect(text).toContain("Pievienot foto");
    expect(text).toContain("Eļļas maiņa, bremžu kluči priekšā");
    expect(text).toContain("484,00 €");
    expect(html).toContain("ap2-sv-cpill");
    expect(html).not.toContain("ap2-sv-bigplus");
    expect(html).not.toContain("Skenēt rēķinu");
    const diag = html.split("CSDD diagnostika")[1] ?? "";
    expect(diag.split("Problēmas")[0]).toContain("ap2-sv-scan pri");
  });

  it("dzēšanas poga ir tikai administratoram", () => {
    const v = view({ problems: [problem()] });
    expect(renderHtml(stages(v))).not.toContain("Dzēst problēmu");
    expect(renderHtml(stages(v, { canDelete: true }))).toContain('aria-label="Dzēst problēmu: Skrāpējums aizmugurējā buferī"');
  });

  it("klienta tekstā nav garās vai en svītras", () => {
    const html = renderHtml(stages(view({ problems: [problem({ photoIds: [] })] })));
    expect(html).not.toMatch(/[\u2013\u2014]/);
    expect(SERVISS_EMPTY_PROBLEMS_HINT).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("Serviss apakšlapas", () => {
  it("dokumenta lapa: kamera un fails, CSDD diagnostikai", () => {
    const html = renderHtml(
      <ServissScanSheet title="CSDD diagnostika" csdd onCamera={noop} onFiles={noop} onClose={noop} />,
    );
    const text = renderText(
      <ServissScanSheet title="CSDD diagnostika" csdd onCamera={noop} onFiles={noop} onClose={noop} />,
    );
    expect(text).toContain("CSDD diagnostika");
    expect(text).toContain("Kamera");
    expect(text).toContain("Fails");
    expect(text).toContain("Atcelt");
    expect(html).toContain(CSDD_DOC_BADGE_SRC);
    expect(html).toContain('accept="image/*"');
  });

  it("jauna problēma: apraksts, kamera, galerija, saglabāt", () => {
    const text = renderText(
      <ServissProblemSheet initialText="Klab priekšējā piekare" onSave={noop} onClose={noop} />,
    );
    expect(text).toContain("Jauna problēma");
    expect(text).toContain("Apraksts");
    expect(text).toContain("Foto (pēc izvēles)");
    expect(text).toContain("Kamera");
    expect(text).toContain("Galerija");
    expect(text).toContain("Saglabāt problēmu");
    expect(text).toContain("Klab priekšējā piekare");
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
