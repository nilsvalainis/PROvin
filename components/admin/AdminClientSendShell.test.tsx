import { describe, expect, it } from "vitest";
import { AdminClientSendShell, ClientSendChannelTabs } from "@/components/admin/AdminClientSendShell";
import { renderHtml, renderText } from "@/lib/test-render";

function shell(kind: "dealer" | "audit", wide = false) {
  return (
    <AdminClientSendShell
      kind={kind}
      titleId="t"
      title="Sūtīt atskaiti"
      titleExtra={kind === "audit" ? <span>PROVIN AUDITS</span> : undefined}
      subtitle={<p>WBA5R1C0XLFH42873</p>}
      onClose={() => undefined}
      footer={<button type="button">Sūtīt</button>}
      wide={wide}
    >
      <p>Saturs</p>
    </AdminClientSendShell>
  );
}

describe("AdminClientSendShell", () => {
  it("dīlera variants: šaurs, data-dealer-send-* atribūti, piestiprināta josla ar drošo zonu", () => {
    const html = renderHtml(shell("dealer"));
    expect(html).toMatch(/data-dealer-send-dialog="true" class="fixed inset-0 z-\[80\]/);
    expect(html).toContain("sm:max-w-lg");
    const footer = html.slice(html.indexOf("data-dealer-send-footer"));
    expect(footer).toMatch(/^data-dealer-send-footer="true" class="sticky bottom-0 [^"]*shrink-0/);
    expect(footer).toContain("env(safe-area-inset-bottom)");
  });

  it("AUDITS variants: plats (1060 px), savi atribūti, čipi pie virsraksta", () => {
    const html = renderHtml(shell("audit", true));
    expect(html).toContain('data-audit-send-dialog="true"');
    expect(html).toContain('data-audit-send-footer="true"');
    expect(html).toContain("sm:max-w-[1060px]");
    expect(html).not.toContain("data-dealer-send-dialog");
    expect(renderText(shell("audit", true))).toContain("Sūtīt atskaiti PROVIN AUDITS");
  });

  it("kanāla cilnes: E-pasts / WhatsApp, izvēlētā aria-selected", () => {
    const html = renderHtml(<ClientSendChannelTabs channel="whatsapp" onChange={() => undefined} />);
    expect(html).toMatch(/aria-selected="false"[^>]*>E-pasts/);
    expect(html).toMatch(/aria-selected="true"[^>]*>.*WhatsApp/);
  });
});
