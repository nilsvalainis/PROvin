import { describe, expect, it } from "vitest";
import { AdminFactCheckPanel } from "@/components/admin/AdminFactCheckPanel";
import { renderHtml } from "@/lib/test-render";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

const flag: FactCheckFlag = {
  id: "powertrain_engine",
  level: "E",
  kind: "powertrain_engine",
  message: "Ielādētais dzinēja kods ir DW10FE, teksts nosauc DW12RU.",
  sentence: "Dzinējs DW12RU.",
};
const noop = () => undefined;

describe("Faktu pārbaudes panelis - «Labot» ar AI", () => {
  it("ar AI: «Labot» pie kļūdas un «Labot visas», «Ignorēt» paliek", () => {
    const html = renderHtml(
      <AdminFactCheckPanel
        flags={[flag]}
        dismissed={[]}
        onDismiss={noop}
        aiFix={{ allowed: true, text: "<p>Dzinējs DW12RU.</p>", buildPayload: () => ({}), onApplyText: noop }}
      />,
    );
    expect(html).toContain("data-fact-fix-ai");
    expect(html).toContain("Labot visas");
    expect(html).toContain("Ignorēt");
  });

  it("bez AI atļaujas vai ar tukšu lauku AI pogu nav", () => {
    for (const aiFix of [
      null,
      { allowed: false, text: "Dzinējs DW12RU.", buildPayload: () => ({}), onApplyText: noop },
      { allowed: true, text: "<p></p>", buildPayload: () => ({}), onApplyText: noop },
    ]) {
      const html = renderHtml(<AdminFactCheckPanel flags={[flag]} dismissed={[]} onDismiss={noop} aiFix={aiFix} />);
      expect(html).not.toContain("Labot visas");
      expect(html).not.toContain("data-fact-fix-ai");
      expect(html).toContain("Ignorēt");
    }
  });
});

describe("28.11: «AI pārbaude» poga un virsraksts", () => {
  it("poga tikai ar onAiClick", async () => {
    const { AdminFactCheckButton } = await import("@/components/admin/AdminFactCheckPanel");
    expect(renderHtml(<AdminFactCheckButton onClick={noop} />)).not.toContain("AI pārbaude");
    const html = renderHtml(<AdminFactCheckButton onClick={noop} onAiClick={noop} />);
    expect(html).toContain("AI pārbaude");
    expect(html).toContain("data-fact-check-ai");
  });
  it("paneļa virsraksts", () => {
    expect(renderHtml(<AdminFactCheckPanel title="PDF teksti" flags={[flag]} dismissed={[]} onDismiss={noop} />)).toContain("PDF teksti");
  });
});
