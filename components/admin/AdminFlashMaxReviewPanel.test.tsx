import { describe, expect, it } from "vitest";
import { AdminFlashMaxReviewPanel } from "@/components/admin/AdminFlashMaxReviewPanel";
import type { FlashMaxReviewFinding } from "@/lib/flash-max-final-review";
import { renderHtml } from "@/lib/test-render";

const finding: FlashMaxReviewFinding = {
  id: "summary#0",
  fieldId: "summary",
  kind: "pretruna",
  reason: "Nobraukums nesakrīt ar nobraukuma sadaļu.",
  find: "Auto nobraukums ir 128 000 km.",
  replace: "Auto pēdējais fiksētais nobraukums ir 182 000 km.",
};
const noop = () => undefined;

describe("FLASH MAX noslēguma pārbaudes panelis", () => {
  it("rāda lauku, iemeslu, bija / būs un pogas Pieņemt / Noraidīt", () => {
    const html = renderHtml(
      <AdminFlashMaxReviewPanel
        state={{ status: "done", findings: [finding], fieldLabels: { summary: "3. Kopsavilkums" } }}
        handled={{}}
        unappliable={new Set()}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(html).toContain("3. Kopsavilkums");
    expect(html).toContain("Pretruna starp sadaļām");
    expect(html).toContain(finding.reason);
    expect(html).toContain(finding.find);
    expect(html).toContain(finding.replace);
    expect(html).toContain("Pieņemt");
    expect(html).toContain("Noraidīt");
  });

  it("bez atradumiem - īsa atzīme; izlemtam ieteikumam pogu nav; mainītam laukam Pieņemt atslēgts", () => {
    const clean = renderHtml(
      <AdminFlashMaxReviewPanel
        state={{ status: "done", findings: [], fieldLabels: {} }}
        handled={{}}
        unappliable={new Set()}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(clean).toContain("Pārbaudīts, iebildumu nav.");

    const decided = renderHtml(
      <AdminFlashMaxReviewPanel
        state={{ status: "done", findings: [finding], fieldLabels: {} }}
        handled={{ [finding.id]: "accepted" }}
        unappliable={new Set()}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(decided).toContain("Pieņemts");
    expect(decided).not.toContain(">Noraidīt<");

    const stale = renderHtml(
      <AdminFlashMaxReviewPanel
        state={{ status: "done", findings: [finding], fieldLabels: {} }}
        handled={{}}
        unappliable={new Set([finding.id])}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(stale).toMatch(/<button[^>]*disabled[^>]*>Pieņemt/);
    expect(stale).toContain("piemērot nevar");
  });

  it("kļūda: atzīme, ka FLASH MAX teksti saglabāti", () => {
    const html = renderHtml(
      <AdminFlashMaxReviewPanel state={{ status: "error", error: "x" }} handled={{}} unappliable={new Set()} onAccept={noop} onReject={noop} />,
    );
    expect(html).toContain("Noslēguma pārbaude neizdevās");
  });
});
