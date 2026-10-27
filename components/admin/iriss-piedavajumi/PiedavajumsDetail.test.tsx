import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

import { PiedavajumsDetail } from "@/components/admin/iriss-piedavajumi/PiedavajumsDetail";
import { PdClientView } from "@/components/iriss-piedavajumi/PdClientView";
import { buildIrissPdPublicView } from "@/lib/iriss-piedavajumi";
import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import { emptyIrissPiedavajums, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { renderHtml, renderText } from "@/lib/test-render";

const AT = "2026-10-26T10:00:00.000Z";
const NOW = Date.parse(AT);
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";

const AUTO1: IrissPdAuto1Blocks = {
  paint: null,
  tech: [{ label: "Jauda", value: "136 kW / 185 ZS" }],
  equipment: [],
  service: [],
  inspection: [],
  damage: [{ area: "exterior", damage: "Scratch", severity: "", description: "", quantity: "29", parts: "" }],
  vinData: [],
};

function rec(over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
  const r = emptyIrissPiedavajums(ID, AT);
  return {
    ...r,
    number: 218,
    status: "sent",
    linkToken: TOKEN,
    validUntil: "2026-11-02",
    price: "10800",
    purchasePrice: "8450",
    source: "auto1",
    vehicle: { ...r.vehicle, title: "Volvo XC70 2.4 D5 AWD", vin: "YV1CZ7146B1568808", location: "Vācija" },
    client: { name: "SIA Rīgas Būve", phone: "", email: "", orderId: "" },
    auto1: AUTO1,
    auto1ImportedAt: AT,
    ...over,
  };
}

const render = (r: IrissPiedavajums) => <PiedavajumsDetail initial={r} clientOptions={[]} note="" />;

describe("j75 Piedāvājuma redaktors (makets 01-redaktors)", () => {
  it("sadaļas maketa secībā, galvenē Kopēt saiti / Dzēst / Saglabāt", () => {
    const text = renderText(render(rec()));
    const order = ["Kopēt saiti", "Dzēst", "Saglabāt", "Foto", "Pamatdati", "Aprīkojuma izcēlumi", "Kopsavilkums", "Novērtējums klientam", "Auto1 dati", "Klientam kopā"];
    const at = order.map((s) => text.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).toContain("SIA Rīgas Būve");
    expect(text).toContain("Termiņš 02.11.2026");
    expect(text).toContain("Rādīt pilnu Auto1 atskaiti");
    expect(text).toContain("Bojājumi ārpusē 29");
  });

  it("nav Izsoles, Bojājumu pakāpes, Atslēgu skaita, rīkjoslas un apakšējās joslas", () => {
    const html = renderHtml(render(rec()));
    const text = renderText(render(rec()));
    for (const gone of ["Izsole", "Bojājumu pakāpe", "Atslēgu skaits", "Tulkot ar AI", "Mazs", "Parasts", "Liels", "Stāvoklis"]) expect(text).not.toContain(gone);
    expect(html).not.toContain("pd-bottom");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("<details");
    // Vizuālais / Tehniskais / Papildu piezīme - vienkārši teksta lauki.
    expect(html.match(/<textarea/g)?.length).toBe(4);
  });

  it("Kopsavilkums: 2 kolonnas ar šabloniem; Novērtējums: fakti + pievienot", () => {
    const text = renderText(render(rec()));
    expect(text).toContain("✓ Cenā iekļauts Pilna pirmspārdošanas sagatavošana Pārbaudes serviss Atvešana uz Latviju Garantija 3 mēn. + pievienot rindu");
    expect(text).toContain("✕ Cenā nav iekļauts CSDD reģistrācija");
    expect(text).toContain("2 atslēgas Servisa grāmatiņa TA derīga Nav avārijas vēstures Otrs riteņu komplekts Pārkrāsots (kosmētiski) + pievienot faktu");
    const html = renderHtml(render(rec()));
    expect(html.match(/role="switch"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("melnrakstā saites vēl nav - galvenē «Nosūtīt un kopēt saiti»", () => {
    const text = renderText(render(rec({ status: "draft", linkToken: "" })));
    expect(text).toContain("Nosūtīt un kopēt saiti");
    expect(text).not.toContain("Kopēt saiti Dzēst");
  });

  it("apstiprinātā lauki nav labojami (izņemot iekšējās piezīmes)", () => {
    const html = renderHtml(render(rec({ status: "approved" })));
    expect(html).toMatch(/id="pd-visual"[^>]*disabled/);
    expect(html).not.toMatch(/id="pd-notes"[^>]*disabled/);
  });
});

describe("j75 klienta skats: Stāvoklis un Kopsavilkums no jaunajiem datiem", () => {
  it("rāda ieķeksētos faktus, tekstus un iekļauto/neiekļauto; neieķeksētos nerāda", () => {
    const r = rec();
    r.content = {
      ...r.content,
      highlights: ["Xenon lukturi"],
      facts: r.content.facts.map((f) => ({ ...f, on: f.text === "Otrs riteņu komplekts" })),
      visual: "Buktes, skrāpējumi.",
    };
    const text = renderText(<PdClientView view={buildIrissPdPublicView(r, "link", NOW)} mode="link" photoSrc={() => ""} />);
    expect(text).toContain("Aprīkojums Xenon lukturi");
    expect(text).toContain("Stāvoklis Otrs riteņu komplekts Vizuālais novērtējums. Buktes, skrāpējumi.");
    expect(text).toContain("Cenā iekļauts Pilna pirmspārdošanas sagatavošana");
    expect(text).toContain("Cenā nav iekļauts CSDD reģistrācija");
    expect(text).not.toContain("2 atslēgas");
    expect(text).not.toContain("Garantija 3 mēn.");
  });
});

describe("Cenu bloks (Nils 27.10)", () => {
  it("PVN izvēle 3 čipos un Klientam kopā = daļu summa", () => {
    const r = rec({ purchasePrice: "18400", logisticsCost: "1150", commission: "900", price: "20450", vatMode: "deductible" });
    const html = renderHtml(render(r));
    const text = renderText(render(r));
    for (const t of ["PVN atskaitāms", "Ar PVN (marža)", "Nav zināms", "IRISS komisija", "Klientam kopā"]) expect(text).toContain(t);
    expect(html).toMatch(/aria-pressed="true"[^>]*>PVN atskaitāms</);
    expect(text).toMatch(/20.450 €/);
  });
});
