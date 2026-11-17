import { describe, expect, it } from "vitest";
import { dealerDataOperatorMessageEmailHtml } from "@/lib/email/html-templates";

const buttons = (html: string) =>
  [...html.matchAll(/border-radius:9999px[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);

/** C1 (Nils 06.11): pogas pēc nolūka, ne pēc saites pēdējā rindā. */
describe("e-pasta pogas pēc nolūka", () => {
  it("nosauktas rindas kļūst par pogām", () => {
    const html = dealerDataOperatorMessageEmailHtml({
      text: [
        "Labdien!",
        "Apmaksāt: https://buy.stripe.com/abc",
        "Pasūtīt: https://provin.lv",
        "Atvērt atskaiti: https://provin.lv/r/x",
        "Lejupielādēt rēķinu: https://provin.lv/api/invoice/download?session_id=cs_1",
      ].join("\n\n"),
    });
    expect(buttons(html)).toEqual(["Apmaksāt", "Pasūtīt PROVIN AUDITS", "Atvērt atskaiti", "Lejupielādēt rēķinu"]);
  });

  it("sludinājuma saite paliek par saiti, nevis „Apmaksāt”", () => {
    const html = dealerDataOperatorMessageEmailHtml({
      text: "Sveiki!\n\nhttps://www.ss.lv/msg/lv/transport/cars/bmw/abc.html\n\nĪss komentārs.",
    });
    expect(buttons(html)).toEqual([]);
    expect(html).toContain('<a href="https://www.ss.lv/msg/lv/transport/cars/bmw/abc.html"');
  });

  it("saite pēc „… apmaksāt šeit:” ir poga „Apmaksāt”", () => {
    const html = dealerDataOperatorMessageEmailHtml({
      text: "Iesakām PROVIN AUDITS. Starpību (60,00 €) varat apmaksāt šeit:\nhttps://buy.stripe.com/xyz",
    });
    expect(buttons(html)).toEqual(["Apmaksāt"]);
  });
});
