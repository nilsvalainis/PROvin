import { describe, expect, it } from "vitest";
import { IrissSaitesSection } from "@/components/admin/iriss-saites/IrissSaitesSection";
import type { IrissSaitesView } from "@/lib/iriss-car-share";
import { renderHtml, renderText } from "@/lib/test-render";

const created: IrissSaitesView = {
  phone: "",
  crossLinks: [
    { kind: "logistika", href: "/admin/iriss/logistika?car=lo-1", title: "Loģistika", subtitle: "Ceļā · Rīga" },
    { kind: "pasutijums", href: "/admin/iriss/pasutijumi/ord-1", title: "Pasūtījums", subtitle: "Evita · Piedāvājums 1" },
  ],
  share: {
    status: "created",
    statusLabel: "Saite izveidota",
    badge: "Bez cenas",
    path: "/a/k7Q2xAb1",
    displayUrl: "iriss.lv/a/k7Q2xAb1",
    note: "Klients redz auto, foto un pamatdatus. Cena netiek iekļauta.",
    token: "k7Q2xAb1",
  },
};

const sent: IrissSaitesView = {
  ...created,
  share: {
    ...created.share!,
    status: "sent",
    statusLabel: "Nosūtīts",
    note: "Evita · šodien 11:42 · WhatsApp",
  },
};

describe("IRISS Saites makets A", () => {
  it("renders Autoparks cross-links and Saite izveidota with Bez cenas", () => {
    const text = renderText(<IrissSaitesSection view={created} />);
    const html = renderHtml(<IrissSaitesSection view={created} />);
    expect(text).toContain("Saites");
    expect(text).toContain("Loģistika");
    expect(text).toContain("Ceļā · Rīga");
    expect(text).toContain("Pasūtījums");
    expect(text).toContain("Evita · Piedāvājums 1");
    expect(text).toContain("Publiskā saite");
    expect(text).toContain("Saite izveidota");
    expect(text).toContain("Bez cenas");
    expect(text).toContain("Kopēt");
    expect(text).toContain("WhatsApp");
    expect(text).toContain("iriss.lv/a/k7Q2xAb1");
    expect(text).toContain("Cena netiek iekļauta");
    expect(html).toContain("/admin/iriss/logistika?car=lo-1");
    expect(html).toContain("/admin/iriss/pasutijumi/ord-1");
    expect(text).not.toMatch(/€|EUR|\d[\d\s]*,\d{2}/);
  });

  it("renders Nosūtīts status and sent note without a price", () => {
    const text = renderText(<IrissSaitesSection view={sent} />);
    expect(text).toContain("Nosūtīts");
    expect(text).toContain("Evita · šodien 11:42 · WhatsApp");
    expect(text).toContain("Bez cenas");
    expect(text).not.toContain("Saite izveidota");
    expect(text).not.toMatch(/€|EUR/);
  });

  it("renders Logistics-side Autoparks row", () => {
    const view: IrissSaitesView = {
      phone: "",
      crossLinks: [
        { kind: "autoparks", href: "/admin/iriss/autoparks-v2/ap-1", title: "Autoparks", subtitle: "Servisā · auto istaba" },
        { kind: "pasutijums", href: "/admin/iriss/pasutijumi/ord-1", title: "Pasūtījums", subtitle: "Evita · Piedāvājums 1" },
      ],
      share: created.share,
    };
    const text = renderText(<IrissSaitesSection view={view} />);
    expect(text).toContain("Autoparks");
    expect(text).toContain("Servisā · auto istaba");
    expect(text).toContain("Bez cenas");
  });
});

describe("publiskā saite tikai ar pogu (Nils 27.10)", () => {
  it("bez saites rāda pogu Izveidot saiti klientam, bez Kopēt/WhatsApp", () => {
    const text = renderText(<IrissSaitesSection view={{ ...created, share: null }} onCreate={() => undefined} />);
    expect(text).toContain("Izveidot saiti klientam");
    expect(text).not.toContain("Kopēt");
    expect(text).not.toContain("WhatsApp");
  });
  it("ar saiti pogas Izveidot nav", () => {
    expect(renderText(<IrissSaitesSection view={created} />)).not.toContain("Izveidot saiti klientam");
  });
});
