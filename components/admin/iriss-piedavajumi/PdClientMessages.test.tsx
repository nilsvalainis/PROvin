import { describe, expect, it } from "vitest";
import { PdClientMessagesView } from "@/components/admin/iriss-piedavajumi/PdClientMessages";
import type { IrissPdMessage } from "@/lib/iriss-piedavajumi-types";
import { renderText } from "@/lib/test-render";

const base = { draft: "", showClient: false, busy: false, err: "", onSetAnswered: () => undefined };
const q = (extra: Partial<IrissPdMessage> = {}): IrissPdMessage => ({
  id: "q1",
  at: "2026-11-14T07:00:00.000Z",
  from: "client",
  kind: "question",
  by: "Klients",
  text: "Kad var apskatīt?",
  ...extra,
});

describe("PdClientMessagesView: jautājums atbildēts", () => {
  it("neatbildētam - poga «Atzīmēt kā atbildētu» un skaits", () => {
    const text = renderText(<PdClientMessagesView {...base} messages={[q()]} />);
    expect(text).toContain("Neatbildēti jautājumi: 1");
    expect(text).toContain("Atzīmēt kā atbildētu");
    expect(text).not.toContain("Atbildēts ·");
  });

  it("atbildētam - «Atbildēts · Vārds · 14.11. 10:22» (Rīgas laikā) un «Atjaunot kā neatbildētu»", () => {
    const text = renderText(
      <PdClientMessagesView {...base} messages={[q({ answeredAt: "2026-11-14T08:22:00.000Z", answeredBy: "Nils" })]} />,
    );
    expect(text).toContain("Atbildēts · Nils · 14.11. 10:22");
    expect(text).toContain("Atjaunot kā neatbildētu");
    expect(text).not.toContain("Neatbildēti jautājumi");
  });
});
