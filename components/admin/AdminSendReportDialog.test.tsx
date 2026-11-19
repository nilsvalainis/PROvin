import { describe, expect, it } from "vitest";
import { AdminSendReportDialog } from "@/components/admin/AdminSendReportDialog";
import { renderHtml, renderText } from "@/lib/test-render";

const noopAsync = async () => {
  throw new Error("test-dialog-does-not-send");
};

function dialog(
  attachments: ReadonlyArray<{ id: string; name?: string; filename?: string; mime?: string; size?: number }>,
  recipientRole?: "client" | "partner",
) {
  return (
    <AdminSendReportDialog
      open
      onClose={() => undefined}
      dark
      email="klients@example.com"
      recipientRole={recipientRole}
      defaultKind="audits"
      b2b={false}
      attachments={attachments}
      whatsappHref={null}
      prepare={noopAsync}
      send={noopAsync}
      undoComplete={noopAsync}
    />
  );
}

describe("Sūtīt atskaiti dialogs: pielikumu nosaukumi un Atcelt", () => {
  it("katrai rindai rāda faila nosaukumu, veidu un Atcelt pogu ar tumšās tēmas tekstu", () => {
    const html = renderHtml(
      dialog([
        { id: "cv", name: "CarVertical_WBA123.pdf", size: 1.7 * 1024 * 1024, mime: "application/pdf" },
        { id: "dna", filename: "autodna-atskaite.pdf", size: 700_000, mime: "application/pdf" },
        { id: "foto", name: "priekspuse.jpg", size: 120_000, mime: "image/jpeg" },
        { id: "tukss", mime: "application/pdf" },
      ]),
    );
    const text = renderText(
      dialog([
        { id: "cv", name: "CarVertical_WBA123.pdf", size: 1.7 * 1024 * 1024, mime: "application/pdf" },
        { id: "dna", filename: "autodna-atskaite.pdf", size: 700_000, mime: "application/pdf" },
        { id: "foto", name: "priekspuse.jpg", size: 120_000, mime: "image/jpeg" },
        { id: "tukss", mime: "application/pdf" },
      ]),
    );

    expect(text).toContain("CarVertical_WBA123.pdf");
    expect(text).toContain("CarVertical");
    expect(text).toContain("autodna-atskaite.pdf");
    expect(text).toContain("AutoDNA");
    expect(text).toContain("priekspuse.jpg");
    expect(text).toContain("foto");
    expect(text).toContain("PDF");
    expect(text).toContain("Atcelt");
    expect(text).toContain("Sagatavot PDF");
    expect(html).toContain('title="CarVertical_WBA123.pdf (CarVertical)"');
    expect(html).toContain("truncate");
    expect(html).toMatch(/Atcelt[\s\S]*Sagatavot PDF/);
    expect(html).toContain("text-[var(--color-apple-text)]");
  });

  it("rinda bez izmēra joprojām rāda nosaukumu", () => {
    const text = renderText(dialog([{ id: "nav", name: "LTAB_izdruka.pdf", mime: "application/pdf" }]));
    expect(text).toContain("LTAB_izdruka.pdf");
    expect(text).not.toMatch(/NaN/);
  });
});

describe("Sūtīt atskaiti dialogs: saņēmējs", () => {
  it("rāda saņēmēja lomu «Klients» un neatzīmētu «Saņēmējs pārbaudīts»", () => {
    const text = renderText(dialog([]));
    const html = renderHtml(dialog([]));
    expect(text).toContain("Klients: klients@example.com");
    expect(text).toContain("Saņēmējs pārbaudīts");
    expect(html).not.toMatch(/checked=""[^>]*>\s*Saņēmējs pārbaudīts/);
  });

  it("partnera pasūtījumā rāda «B2B partneris»", () => {
    expect(renderText(dialog([], "partner"))).toContain("B2B partneris: klients@example.com");
  });
});
