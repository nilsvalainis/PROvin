import { describe, expect, it } from "vitest";
import { PdClientMessagesView } from "@/components/admin/iriss-piedavajumi/PdClientMessages";
import { PdClientActionsView, pdClientErrorText, pdContactValid, type PdClientActionsViewProps } from "@/components/iriss-piedavajumi/PdClientActions";
import { PdQuestionTag } from "@/components/iriss-piedavajumi/PdStatusChip";
import type { IrissPdMessage } from "@/lib/iriss-piedavajumi-types";
import { renderHtml, renderText } from "@/lib/test-render";

const base: PdClientActionsViewProps = {
  state: "open",
  step: "idle",
  needsContact: false,
  vehicle: "TESTS Škoda Octavia",
  price: "12 750 €",
  name: "",
  phone: "",
  reason: "",
  askOpen: false,
  draft: "",
  questions: [],
  busy: false,
  err: "",
  notice: "",
};

const buttons = (html: string) => [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

describe("Klienta atbilde piedāvājuma saitē", () => {
  it("sākumā: Apstiprināt, Noraidīt un Uzdot jautājumu (nekas netiek sūtīts bez apstiprinājuma soļa)", () => {
    expect(buttons(renderHtml(<PdClientActionsView {...base} />))).toEqual(["Apstiprināt", "Noraidīt", "Uzdot jautājumu"]);
  });

  it("Apstiprināt: apstiprinājuma solis lapā ar auto un cenu; Atcelt vai Jā, apstiprinu", () => {
    const html = renderHtml(<PdClientActionsView {...base} step="approve" />);
    const text = renderText(<PdClientActionsView {...base} step="approve" />);
    expect(text).toContain("Apstiprināt piedāvājumu?");
    expect(text).toContain("TESTS Škoda Octavia");
    expect(text).toContain("12 750 €");
    expect(buttons(html)).toEqual(["Atcelt", "Jā, apstiprinu"]);
    expect(html).not.toContain('id="pd-reason"');
  });

  it("Noraidīt: solis ar neobligātu iemeslu (garuma limits) un brīdinājumu", () => {
    const html = renderHtml(<PdClientActionsView {...base} step="decline" reason="Par dārgu" />);
    expect(html).toContain('id="pd-reason"');
    expect(html).toContain('maxLength="500"');
    expect(renderText(<PdClientActionsView {...base} step="decline" />)).toContain("Iemesls (nav obligāti)");
    expect(renderText(<PdClientActionsView {...base} step="decline" />)).toContain("vairs nevarēs apstiprināt");
    expect(buttons(html)).toEqual(["Atcelt", "Jā, noraidu"]);
  });

  it("pēc noraidīšanas: skaidrs stāvoklis, apstiprināt nevar, jautāt var", () => {
    const html = renderHtml(<PdClientActionsView {...base} state="declined" />);
    expect(renderText(<PdClientActionsView {...base} state="declined" />)).toContain("Piedāvājums noraidīts");
    expect(buttons(html)).toEqual(["Uzdot jautājumu"]);
  });

  it("apstiprināts: zaļš stāvoklis bez lēmuma pogām", () => {
    expect(renderText(<PdClientActionsView {...base} state="approved" />)).toContain("Piedāvājums apstiprināts");
    expect(buttons(renderHtml(<PdClientActionsView {...base} state="approved" />))).toEqual(["Uzdot jautājumu"]);
  });

  it("jautājuma forma ar limitu; klienta jautājumi rādīti kā teksts (HTML netiek izpildīts)", () => {
    const html = renderHtml(
      <PdClientActionsView {...base} askOpen draft="Sveiki" questions={[{ at: "2026-11-07T01:00:00.000Z", text: "<img src=x onerror=alert(1)>" }]} />,
    );
    expect(html).toContain('maxLength="1000"');
    expect(html).toContain("Nosūtīt jautājumu");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("kontakts obligāts tikai bez klienta; kļūdu teksti", () => {
    expect(renderHtml(<PdClientActionsView {...base} needsContact />)).toContain('id="pd-phone"');
    expect(pdContactValid("Jā", "20000000")).toBe(true);
    expect(pdContactValid("J", "20000000")).toBe(false);
    expect(pdClientErrorText("rate", 429)).toBe("Pārāk daudz mēģinājumu. Mēģiniet vēlāk.");
    expect(pdClientErrorText("duplicate", 409)).toBe("Šis jautājums jau ir nosūtīts.");
    expect(pdClientErrorText(undefined, 410)).toBe("Piedāvājums vairs nav spēkā.");
  });
});

describe("Admins: klienta ziņas", () => {
  const msgs: IrissPdMessage[] = [
    { id: "m1", at: "2026-11-07T01:00:00.000Z", from: "client", kind: "question", by: "Klients", text: "Kad var apskatīt? <b>x</b>" },
    { id: "m2", at: "2026-11-07T01:05:00.000Z", from: "admin", kind: "note", by: "Nils", text: "Atbildēju pa tālruni" },
    { id: "m3", at: "2026-11-07T01:10:00.000Z", from: "client", kind: "decline", by: "Klients", text: "" },
  ];

  it("rāda jautājumus, noraidījumu un iekšējās piezīmes; atbilde nav ziņa klientam", () => {
    const text = renderText(<PdClientMessagesView messages={msgs} draft="" busy={false} err="" onCopy={() => undefined} />);
    expect(text).toContain("Klienta jautājums");
    expect(text).toContain("Kad var apskatīt? &lt;b&gt;x&lt;/b&gt;");
    expect(text).toContain("Klients noraidīja");
    expect(text).toContain("Bez iemesla");
    expect(text).toContain("Piezīme (iekšēja)");
    expect(text).toContain("klientam netiek sūtīta");
    expect(text).not.toContain("Neatbildēti jautājumi");
    expect(renderHtml(<PdClientMessagesView messages={msgs} draft="" busy={false} err="" />)).not.toContain("<b>x</b>");
  });

  it("neatbildēts jautājums: atzīme detaļā un sarakstā", () => {
    const open = [msgs[0]!];
    expect(renderText(<PdClientMessagesView messages={open} draft="" busy={false} err="" />)).toContain("Neatbildēti jautājumi: 1");
    expect(renderText(<PdQuestionTag count={1} />)).toBe("Jautājums");
    expect(renderText(<PdQuestionTag count={3} />)).toBe("Jautājumi: 3");
    expect(renderHtml(<PdQuestionTag count={0} />)).toBe("");
  });
});
