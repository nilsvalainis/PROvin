/**
 * P4 (Nils 20.11): viena PD forma visiem - darbinieka maskēšana, PATCH sanitizācija, tiesības, saraksts «Mani»/«Visi»
 * un «Jauns PD uz šī bāzes» no vecā /p/ piedāvājuma.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

import { PiedavajumiList } from "@/components/admin/iriss-piedavajumi/PiedavajumiList";
import { PiedavajumsDetail } from "@/components/admin/iriss-piedavajumi/PiedavajumsDetail";
import { renderHtml, renderText } from "@/lib/test-render";
import { applyIrissPdPatch, irissPdToListRow, normalizeIrissPiedavajums, photoKey, rebaseIrissPd } from "@/lib/iriss-piedavajumi";
import { irissPdFromLegacyOffer, irissPdPlainFromHtml } from "@/lib/iriss-piedavajumi-from-legacy";
import {
  IRISS_PD_STAFF_HIDDEN_FIELDS,
  irissPdCreatorInitials,
  irissPdForViewer,
  irissPdRowsForViewer,
  irissPdRowsInScope,
  irissPdViewerCanAct,
  irissPdViewerCanDelete,
  irissPdViewerCanEdit,
  irissPdViewerCanUseStock,
  irissPdViewerFromActor,
  maskIrissPdForStaff,
  sanitizeIrissPdPatchForStaff,
  type IrissPdViewer,
} from "@/lib/iriss-piedavajumi-staff";
import { emptyIrissPiedavajums, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import type { IrissOfferRecord } from "@/lib/iriss-pasutijumi-types";

const ID = "11111111-1111-4111-8111-111111111111";
const AT = "2026-11-20T10:00:00.000Z";

const admin: IrissPdViewer = irissPdViewerFromActor({ kind: "admin", name: "Nils" });
const toms: IrissPdViewer = irissPdViewerFromActor({ kind: "staff", user: { id: "usr_toms", name: "Toms Gudovskis", sections: ["pasutijumi"] } });
const ingus: IrissPdViewer = irissPdViewerFromActor({
  kind: "staff",
  user: { id: "usr_ingus", name: "Ingus", sections: ["pasutijumi", "ap_pamatdati"] },
});

function rec(over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
  return {
    ...emptyIrissPiedavajums(ID, AT),
    number: 142,
    source: "auto1",
    sourceUrl: "https://www.auto1.com/en/app/merchant/car/AB12345",
    sourceKey: "AB12345",
    purchasePrice: "39200",
    logisticsCost: "1450",
    prepCost: "650",
    commission: "2900",
    internalNotes: "Max solīt 39 500 €",
    price: "48900",
    vatMode: "margin",
    photos: [
      { kind: "url", url: "https://img.auto1.com/AB12345/1.jpg" },
      { kind: "dropbox", ref: "autoparks:car1", id: "id:abc" },
      { kind: "url", url: "https://img.auto1.com/AB12345/2.jpg" },
    ],
    history: [{ at: AT, by: "Sistēma", text: "Izveidots no Sludinājumiem (Auto1, Nr. AB12345) · 11 lauki" }],
    createdById: "usr_toms",
    createdByName: "Toms Gudovskis",
    ...over,
  };
}

describe("maskēšana darbiniekam", () => {
  it("API ierakstā nav iepirkuma cenas, izmaksu, komisijas, piezīmju, avota saites un izsoles numura", () => {
    const m = maskIrissPdForStaff(rec());
    for (const k of IRISS_PD_STAFF_HIDDEN_FIELDS) expect([k, m[k]]).toEqual([k, ""]);
    const json = JSON.stringify(m);
    expect(json).not.toContain("39200");
    expect(json).not.toContain("auto1.com");
    expect(json).not.toContain("AB12345");
    expect(json).not.toContain("Max solīt");
    // Darbinieks redz PVN režīmu un «Klientam kopā».
    expect(m.price).toBe("48900");
    expect(m.vatMode).toBe("margin");
    expect(m.photos).toHaveLength(3);
  });

  it("admins redz visu bez izmaiņām", () => {
    expect(irissPdForViewer(rec(), admin)).toEqual(rec());
  });

  it("saraksta rindās nav avota saites un izsoles numura", () => {
    const rows = irissPdRowsForViewer([irissPdToListRow(rec())], toms);
    expect(rows[0]!.sourceUrl).toBeUndefined();
    expect(rows[0]!.sourceKey).toBe("");
    expect(JSON.stringify(rows)).not.toContain("auto1.com");
    expect(rows[0]!.price).toBe("48900");
    expect(irissPdRowsForViewer([irissPdToListRow(rec())], admin)[0]!.sourceUrl).toContain("auto1.com");
  });
});

describe("PATCH sanitizācija", () => {
  it("darbinieks nevar mainīt slēptos laukus", () => {
    const patch = sanitizeIrissPdPatchForStaff(
      {
        purchasePrice: "1",
        logisticsCost: "1",
        prepCost: "1",
        commission: "1",
        internalNotes: "x",
        sourceUrl: "https://evil.example",
        sourceKey: "X",
        price: "50000",
        vatMode: "deductible",
      },
      rec(),
    );
    expect(Object.keys(patch).sort()).toEqual(["price", "vatMode"]);
    const res = applyIrissPdPatch(rec(), patch, { by: "Toms", at: AT, nowMs: Date.parse(AT) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.record.purchasePrice).toBe("39200");
    expect(res.record.commission).toBe("2900");
    expect(res.record.internalNotes).toBe("Max solīt 39 500 €");
    expect(res.record.price).toBe("50000");
    expect(res.record.vatMode).toBe("deductible");
  });

  it("maskētās bildes pārkārtojot atgriežas īstās (izsoles adreses darbinieks pievienot nevar)", () => {
    const r = rec();
    const masked = maskIrissPdForStaff(r).photos;
    const patch = sanitizeIrissPdPatchForStaff({ photos: [masked[2], masked[0], { kind: "url", url: "https://evil.example/x.jpg" }] }, r);
    expect(patch.photos).toEqual([r.photos[2], r.photos[0]]);
    const res = applyIrissPdPatch(r, patch, { by: "Toms", at: AT, nowMs: Date.parse(AT) });
    expect(res.ok && res.record.photos.map(photoKey)).toEqual([photoKey(r.photos[2]!), photoKey(r.photos[0]!)]);
  });

  it("ne-objekts -> tukšs", () => {
    expect(sanitizeIrissPdPatchForStaff(null, rec())).toEqual({});
    expect(sanitizeIrissPdPatchForStaff([1], rec())).toEqual({});
  });
});

describe("tiesības", () => {
  it("darbinieks labo tikai savus; vecos (bez autora) - tikai admins", () => {
    expect(irissPdViewerCanEdit(rec(), toms)).toBe(true);
    expect(irissPdViewerCanEdit(rec(), ingus)).toBe(false);
    expect(irissPdViewerCanEdit(rec({ createdById: "" }), toms)).toBe(false);
    expect(irissPdViewerCanEdit(rec({ createdById: "" }), admin)).toBe(true);
  });

  it("darbības: savam - sūtīt/atsaukt/noraidīt/atjaunot; apstiprināt un izveidot pasūtījumu - tikai admins", () => {
    for (const a of ["send", "revert", "decline", "reopen"]) expect([a, irissPdViewerCanAct(rec(), toms, a)]).toEqual([a, true]);
    for (const a of ["approve", "create-order"]) expect([a, irissPdViewerCanAct(rec(), toms, a)]).toEqual([a, false]);
    expect(irissPdViewerCanAct(rec(), ingus, "send")).toBe(false);
    expect(irissPdViewerCanAct(rec(), admin, "approve")).toBe(true);
  });

  it("dzēst: savu, kas nav apstiprināts", () => {
    expect(irissPdViewerCanDelete(rec(), toms)).toBe(true);
    expect(irissPdViewerCanDelete(rec({ status: "approved" }), toms)).toBe(false);
    expect(irissPdViewerCanDelete(rec(), ingus)).toBe(false);
    expect(irissPdViewerCanDelete(rec({ status: "approved" }), admin)).toBe(true);
  });

  it("Autoparks / Loģistika tikai ar attiecīgo sadaļu", () => {
    expect(irissPdViewerCanUseStock(toms, "autoparks")).toBe(false);
    expect(irissPdViewerCanUseStock(ingus, "autoparks")).toBe(true);
    expect(irissPdViewerCanUseStock(ingus, "logistics")).toBe(false);
    expect(irissPdViewerCanUseStock(admin, "logistics")).toBe(true);
  });

  it("uz bāzes veidotais pieder veidotājam (ne bāzes autoram)", () => {
    const next = rebaseIrissPd(rec({ status: "expired" }), { id: ID, number: 200, at: AT, by: "Ingus", byId: "usr_ingus" });
    expect(next.createdById).toBe("usr_ingus");
    expect(next.createdByName).toBe("Ingus");
  });

  it("veidotājs saglabājas krātuvē un sarakstā", () => {
    const n = normalizeIrissPiedavajums(JSON.parse(JSON.stringify(rec())));
    expect(n?.createdById).toBe("usr_toms");
    expect(irissPdToListRow(n!).createdByName).toBe("Toms Gudovskis");
    expect(normalizeIrissPiedavajums({ id: ID })?.createdById).toBe("");
  });
});

describe("saraksts «Mani» / «Visi»", () => {
  const rows = [
    irissPdToListRow(rec()),
    irissPdToListRow(rec({ id: "22222222-2222-4222-8222-222222222222", createdById: "usr_ingus", createdByName: "Ingus" })),
    irissPdToListRow(rec({ id: "33333333-3333-4333-8333-333333333333", createdById: "", createdByName: "" })),
  ];
  it("Mani - tikai paša; Visi - visi", () => {
    expect(irissPdRowsInScope(rows, "usr_toms", "mine").map((r) => r.createdById)).toEqual(["usr_toms"]);
    expect(irissPdRowsInScope(rows, "usr_toms", "all")).toHaveLength(3);
  });
  it("iniciāļi kolonnai «Veidoja»", () => {
    expect(irissPdCreatorInitials("Toms Gudovskis")).toBe("TG");
    expect(irissPdCreatorInitials("Ingus")).toBe("I");
    expect(irissPdCreatorInitials("")).toBe("A");
  });
});

describe("Jauns PD uz vecā /p/ bāzes", () => {
  const offer = {
    id: "off_1",
    title: "Piedāvājums 1",
    brandModel: "Škoda Superb Combi 2.0 TDI L&K",
    vin: "TMBJR7NP5L7000000",
    year: "2020",
    mileage: "",
    priceGermany: "",
    comment: "",
    firstRegistration: "03.2020",
    odometerReading: "142 300",
    transmission: "DSG automāts",
    location: "Vācija",
    fuel: "Dīzelis",
    driveType: "",
    powerKw: "140",
    engineDisplacement: "1968",
    color: "Moon White",
    bodyTypeOffer: "Universālis",
    doorCount: "",
    emissionClass: "",
    originCountry: "",
    auctionPlatform: "AUTO1",
    auctionStockNumber: "XY987",
    auctionEndAt: "",
    vatStatus: "",
    damageGrade: "",
    equipmentHighlights: "Panorāmas jumts, Āķis",
    estimatedTotalPrice: "",
    keyCount: "",
    hasFullServiceHistory: false,
    hasFactoryPaint: false,
    hasNoRustBody: false,
    hasSecondWheelSet: false,
    specialNotes: "<p>Ziemas riepas</p>",
    visualAssessment: "<p>Skrāpējums&nbsp;bamperī</p>",
    technicalAssessment: "",
    summary: "",
    carPrice: "18 500",
    deliveryPrice: "1 400",
    commissionFee: "2 000",
    offerValidDays: "",
    validUntil: "2026-11-18",
    attachments: [
      { id: "a1", name: "1.jpg", mimeType: "image/jpeg", size: 1, dataUrl: "" },
      { id: "a2", name: "2.jpg", mimeType: "image/jpeg", size: 1, dataUrl: "" },
      { id: "d1", name: "x.pdf", mimeType: "application/pdf", size: 1, dataUrl: "" },
    ],
    coverAttachmentId: "a2",
    createdAt: AT,
    updatedAt: AT,
  } as IrissOfferRecord;
  const order = { id: "ord_1", clientFirstName: "Jānis", clientLastName: "Bērziņš", phone: "+37120000000", email: "j@example.lv" };

  it("pārnes auto, klientu, bildes (vāks pirmais), cenas daļas un aprakstus; termiņš jāieliek no jauna", () => {
    const pd = irissPdFromLegacyOffer(order as never, offer, { id: ID, number: 7, at: AT, by: "Toms", byId: "usr_toms" });
    expect(pd.status).toBe("draft");
    expect(pd.validUntil).toBe("");
    expect(pd.vehicle.title).toBe("Škoda Superb Combi 2.0 TDI L&K");
    expect(pd.vehicle.mileageKm).toBe("142300");
    expect(pd.client).toEqual({ name: "Jānis Bērziņš", phone: "+37120000000", email: "j@example.lv", orderId: "ord_1" });
    expect(pd.photos).toEqual([
      { kind: "order", orderId: "ord_1", offerId: "off_1", attId: "a2" },
      { kind: "order", orderId: "ord_1", offerId: "off_1", attId: "a1" },
    ]);
    expect(pd.purchasePrice).toBe("18500");
    expect(pd.price).toBe("21900");
    expect(pd.source).toBe("auto1");
    expect(pd.content.highlights).toEqual(["Panorāmas jumts", "Āķis"]);
    expect(pd.content.visual).toBe("Skrāpējums bamperī");
    expect(pd.createdById).toBe("usr_toms");
    // Bildes «order» veida izdzīvo normalizāciju (krātuve).
    expect(normalizeIrissPiedavajums(JSON.parse(JSON.stringify(pd)))?.photos).toEqual(pd.photos);
    // Darbiniekam iepirkuma cena un izsoles numurs paslēpti.
    const m = maskIrissPdForStaff(pd);
    expect(m.purchasePrice).toBe("");
    expect(JSON.stringify(m)).not.toContain("XY987");
  });

  it("HTML -> vienkāršs teksts", () => {
    expect(irissPdPlainFromHtml("<p>A&amp;B</p><p>C<br>D</p>")).toBe("A&B\nC\nD");
  });
});

describe("UI: darbinieka skats", () => {
  it("redaktorā darbiniekam nav iekšējā bloka; ir PVN režīms un «Klientam kopā»", () => {
    const text = renderText(<PiedavajumsDetail initial={maskIrissPdForStaff(rec())} clientOptions={[]} note="" staff />);
    expect(text).toContain("Klientam kopā");
    expect(text).toContain("Ar PVN (marža)");
    expect(text).toContain("Paslēpts: izsoles cena");
    for (const t of ["Auto cena (izsole)", "IRISS komisija", "Marža (iekšēji)", "Iekšējās piezīmes", "Atzīmēt apstiprinātu"]) expect([t, text.includes(t)]).toEqual([t, false]);
    const adminText = renderText(<PiedavajumsDetail initial={rec()} clientOptions={[]} note="" />);
    expect(adminText).toContain("Auto cena (izsole)");
    expect(adminText).toContain("Iekšējās piezīmes");
  });

  it("cita PD darbiniekam - tikai lasīšanai (bez Saglabāt / Dzēst)", () => {
    const text = renderText(<PiedavajumsDetail initial={maskIrissPdForStaff(rec())} clientOptions={[]} note="" staff readOnly />);
    expect(text).toContain("Tikai lasīšanai");
    expect(text).toContain("var tikai skatīt");
    expect(text).not.toContain("Dzēst");
    expect(text).not.toContain("Saglabāt");
  });

  it("saraksts darbiniekam: pēc noklusējuma «Mani», slēdzis «Visi», bez avota filtra", () => {
    const rows = irissPdRowsForViewer(
      [irissPdToListRow(rec()), irissPdToListRow(rec({ id: "22222222-2222-4222-8222-222222222222", createdById: "usr_ingus", vehicle: { ...rec().vehicle, title: "Cits auto Ingum" } }))],
      toms,
    );
    const text = renderText(<PiedavajumiList rows={rows} nowMs={Date.parse(AT)} storeEnabled loadError="" viewer={{ kind: "staff", id: "usr_toms" }} />);
    expect(text).toContain("Mani");
    expect(text).toContain("Visi");
    expect(text).not.toContain("Cits auto Ingum");
    expect(text).not.toContain("Avots: visi");
    expect(text).toContain("1 piedāvājums");
  });
});

describe("P4: WhatsApp klientam un redaktora lauki", () => {
  it("wa.me tieši klienta numuram ar īso šablonu; bez tālruņa - nav saites", async () => {
    const { buildIrissPdWhatsAppText, irissPdClientWhatsAppHref, irissPdClientWhatsAppPhone } = await import("@/lib/iriss-piedavajumi");
    const r = rec({ vehicle: { ...rec().vehicle, title: "Škoda Kodiaq 2.0 TDI Sportline" } });
    const text = buildIrissPdWhatsAppText(r, "https://www.provin.lv/p/d/AbCdEfGhIjKlMnOpQrStUvWx");
    expect(text).toBe(
      "Sveiki! Nosūtu izskatīšanai Škoda Kodiaq, ja ir jautājumi, droši rakstiet vai zvaniet. https://www.provin.lv/p/d/AbCdEfGhIjKlMnOpQrStUvWx",
    );
    const href = irissPdClientWhatsAppHref({ phone: "+371 29 123 456" }, text);
    expect(href.startsWith("https://wa.me/37129123456?text=")).toBe(true);
    expect(href).not.toContain("web.whatsapp.com");
    expect(decodeURIComponent(href.split("?text=")[1]!)).toBe(text);
    expect(irissPdClientWhatsAppPhone({ phone: "" })).toBe("");
    expect(irissPdClientWhatsAppHref({ phone: "123" }, text)).toBe("");
  });

  it("redaktorā nobraukums ar atstarpēm un km, krāsa latviski; ievade saglabā ciparus", async () => {
    const { irissPdEditorInput, irissPdEditorValue } = await import("@/lib/iriss-piedavajumi");
    expect(irissPdEditorValue("mileageKm", "153709")).toBe("153 709 km");
    expect(irissPdEditorInput("mileageKm", "153 70 km")).toBe("15370");
    expect(irissPdEditorInput("mileageKm", "ap. 150 tkm")).toBe("ap. 150 tkm");
    expect(irissPdEditorValue("color", "Gray Metallic (Original)")).toBe("Pelēka metālika (oriģināls)");
    expect(irissPdEditorValue("title", "Gray")).toBe("Gray");
  });

  it("WhatsApp poga neaktīva bez klienta tālruņa", () => {
    const base = rec({ status: "sent", linkToken: "AbCdEfGhIjKlMnOpQrStUvWx" });
    const none = renderText(<PiedavajumsDetail initial={base} clientOptions={[]} note="" />);
    expect(none).toContain("WhatsApp");
    const html = (r: IrissPiedavajums) => renderHtml(<PiedavajumsDetail initial={r} clientOptions={[]} note="" />);
    expect(html(base)).toMatch(/data-pd-draft="whatsapp"[^>]*disabled|disabled=""[^>]*data-pd-draft="whatsapp"/);
    const withPhone = html({ ...base, client: { name: "Jānis", phone: "+37129123456", email: "", orderId: "" } });
    expect(withPhone).not.toMatch(/data-pd-draft="whatsapp"[^>]*disabled|disabled=""[^>]*data-pd-draft="whatsapp"/);
  });
});
