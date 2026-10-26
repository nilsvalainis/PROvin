import { describe, expect, it } from "vitest";
import {
  applyIrissPdAction,
  applyIrissPdExpiry,
  applyIrissPdPatch,
  buildIrissPdPublicView,
  countIrissPdByStatus,
  irissPdDeleteConfirm,
  irissPdHiddenBlockLabels,
  irissPdSubtitle,
  filterIrissPdRows,
  findIrissPdTakenConflict,
  formatIrissPdPrice,
  irissPdAvailableActions,
  irissPdBadgeCount,
  irissPdCarPicks,
  irissPdClientOptions,
  irissPdMargin,
  irissPdRowEffectiveStatus,
  irissPdSendBlockers,
  irissPdToListRow,
  normalizeIrissPiedavajums,
  rebaseIrissPd,
  sortIrissPdRows,
  splitIrissPdClientName,
} from "@/lib/iriss-piedavajumi";
import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import { defaultIrissPdVisibility, emptyIrissPiedavajums, irissPdNumberLabel, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = Date.parse("2026-10-26T10:00:00.000Z");
const AT = new Date(NOW).toISOString();
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";

const AUTO1: IrissPdAuto1Blocks = {
  paint: { zones: [{ id: "front", readings: [276], warning: true }, { id: "roof", readings: [106], warning: false }, { id: "rear", readings: [], warning: false }, { id: "left", readings: [], warning: false }, { id: "right", readings: [], warning: false }], unassigned: [] },
  tech: [{ label: "Izlaiduma gads", value: "2010" }],
  equipment: [{ name: "Āķis", detail: "Detachable tow hitch" }],
  service: [{ label: "Servisa grāmata", value: "Available" }],
  inspection: [],
  damage: [{ area: "exterior", damage: "Dent", severity: "Width: ≥20mm", description: "Paint damage", quantity: "2", parts: "Rear left fender (2)" }],
  vinData: ["Additional heating"],
};

function rec(over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
  return {
    ...emptyIrissPiedavajums(ID, AT),
    number: 217,
    vehicle: { ...emptyIrissPiedavajums(ID, AT).vehicle, title: "Ford Transit Custom 2.0 L2H1", vin: "WF0YXXTTGYKA34521", year: "2019", mileageKm: "118400" },
    price: "12750",
    ...over,
  };
}

const ctx = { by: "Nils", at: AT, nowMs: NOW, newToken: () => TOKEN };
/** Summas ar cieto atstarpi (U+00A0) - salīdzina ar parasto. */
const sp = (s: unknown) => String(s).replace(/\u00a0/g, " ");

describe("Piedāvājumi: noklusējumi un numurs", () => {
  it("Nila noklusējums: visi Auto1 bloki ieslēgti, bojājumi (4) izslēgti gan PDF, gan saitē", () => {
    const v = defaultIrissPdVisibility();
    expect(v.group).toEqual({ pdf: true, link: true });
    expect(v.blocks.paint).toEqual({ pdf: true, link: true });
    expect(v.blocks.tech).toEqual({ pdf: true, link: true });
    expect(v.blocks.equipment).toEqual({ pdf: true, link: true });
    expect(v.blocks.vin).toEqual({ pdf: true, link: true });
    expect(v.blocks.damage).toEqual({ pdf: false, link: false });
  });

  it("jauns ieraksts ir melnraksts bez termiņa (termiņam nav noklusējuma)", () => {
    const r = emptyIrissPiedavajums(ID, AT);
    expect(r.status).toBe("draft");
    expect(r.validUntil).toBe("");
  });

  it("numurs PD-0217", () => {
    expect(irissPdNumberLabel(217)).toBe("PD-0217");
    expect(irissPdNumberLabel(3)).toBe("PD-0003");
  });
});

describe("Piedāvājumi: dzīves cikls", () => {
  it("nosūtīt nevar bez termiņa; ar termiņu -> Nosūtīts, tokens, vēsture", () => {
    expect(irissPdSendBlockers(rec(), NOW)).toContain("Termiņš ir obligāts (bez noklusējuma) - ievadi to.");
    const blocked = applyIrissPdAction(rec(), "send", ctx);
    expect(blocked.ok).toBe(false);

    const sent = applyIrissPdAction(rec({ validUntil: "2026-11-02", client: { name: "SIA Rīgas Būve", phone: "", email: "", orderId: "" } }), "send", ctx);
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.record.status).toBe("sent");
    expect(sent.record.linkToken).toBe(TOKEN);
    expect(sent.record.history.at(-1)?.text).toBe("Nosūtīts klientam SIA Rīgas Būve (līdz 02.11.2026)");
  });

  it("klients, cena un foto nav obligāti nosūtīšanai (Q10)", () => {
    expect(irissPdSendBlockers(rec({ price: "", validUntil: "2026-11-02" }), NOW)).toEqual([]);
  });

  it("pieejamās darbības pēc statusa", () => {
    expect(irissPdAvailableActions("draft")).toEqual(["send", "decline", "approve"]);
    expect(irissPdAvailableActions("sent")).toEqual(["revert", "decline", "approve"]);
    expect(irissPdAvailableActions("approved")).toEqual([]);
    expect(irissPdAvailableActions("expired")).toEqual([]);
    const r = applyIrissPdAction(rec({ status: "expired" }), "send", ctx);
    expect(r.ok).toBe(false);
  });

  it("atsaukt uz melnrakstu saglabā to pašu saiti", () => {
    const r = applyIrissPdAction(rec({ status: "sent", linkToken: TOKEN, validUntil: "2026-11-02" }), "revert", ctx);
    expect(r.ok && r.record.status).toBe("draft");
    expect(r.ok && r.record.linkToken).toBe(TOKEN);
  });

  it("automātiski «Beidzies termiņš» pēc Rīgas dienas beigām", () => {
    const r = rec({ status: "sent", validUntil: "2026-10-26" });
    expect(applyIrissPdExpiry(r, Date.parse("2026-10-26T21:59:00.000Z"))).toBeNull();
    const exp = applyIrissPdExpiry(r, Date.parse("2026-10-26T22:00:00.000Z"));
    expect(exp?.status).toBe("expired");
    expect(exp?.history.at(-1)).toMatchObject({ by: "Sistēma", text: "Termiņš beidzies (26.10.2026)" });
    expect(applyIrissPdExpiry(rec({ status: "approved", validUntil: "2026-10-01" }), NOW)).toBeNull();
    expect(applyIrissPdExpiry(rec({ status: "draft", validUntil: "" }), NOW)).toBeNull();
  });

  it("saraksts rāda beigušos arī pirms pārrakstīšanas", () => {
    const row = irissPdToListRow(rec({ status: "sent", validUntil: "2026-10-20" }));
    expect(irissPdRowEffectiveStatus(row, NOW)).toBe("expired");
  });

  it("«Izveidot jaunu uz šī bāzes»: kopē auto/klientu/Auto1, termiņš tukšs, jauns numurs, saite uz bāzi", () => {
    const base = rec({ status: "expired", validUntil: "2026-10-20", linkToken: TOKEN, auto1: AUTO1, client: { name: "Jānis Ozols", phone: "+371", email: "", orderId: ORDER }, history: [{ at: AT, by: "x", text: "y" }] });
    const n = rebaseIrissPd(base, { id: ID2, number: 218, at: AT, by: "Nils" });
    expect(n).toMatchObject({ id: ID2, number: 218, status: "draft", validUntil: "", linkToken: "", basedOnId: ID, approvedOrderId: "" });
    expect(n.vehicle).toEqual(base.vehicle);
    expect(n.client).toEqual(base.client);
    expect(n.auto1).toEqual(AUTO1);
    expect(n.history).toEqual([{ at: AT, by: "Nils", text: "Izveidots uz PD-0217 bāzes" }]);
  });
});

describe("Piedāvājumi: labojumi", () => {
  it("cenas maiņa vēsturē «Cena 12 900 € → 12 750 €»", () => {
    const r = applyIrissPdPatch(rec({ price: "12900" }), { price: "12750" }, ctx);
    expect(sp(r.ok && r.record.history.at(-1)?.text)).toBe("Cena 12 900 € → 12 750 €");
  });

  it("termiņš pagātnē vai nederīgs tiek noraidīts", () => {
    expect(applyIrissPdPatch(rec(), { validUntil: "2026-10-01" }, ctx).ok).toBe(false);
    expect(applyIrissPdPatch(rec(), { validUntil: "rīt" }, ctx).ok).toBe(false);
    const ok = applyIrissPdPatch(rec(), { validUntil: "2026-11-02" }, ctx);
    expect(ok.ok && ok.record.validUntil).toBe("2026-11-02");
  });

  it("apstiprinātu/beigušos var labot tikai iekšējās piezīmes", () => {
    expect(applyIrissPdPatch(rec({ status: "approved" }), { price: "1" }, ctx).ok).toBe(false);
    const notes = applyIrissPdPatch(rec({ status: "approved" }), { internalNotes: "Klients zvanīja" }, ctx);
    expect(notes.ok && notes.record.internalNotes).toBe("Klients zvanīja");
  });

  it("foto: drīkst pārkārtot un noņemt, ne pievienot svešas adreses", () => {
    const a = { kind: "url" as const, url: "https://img.example.com/a.jpg" };
    const b = { kind: "url" as const, url: "https://img.example.com/b.jpg" };
    const r = applyIrissPdPatch(rec({ photos: [a, b] }), { photos: [b, a, { kind: "url", url: "https://evil.example.com/x.jpg" }] }, ctx);
    expect(r.ok && r.record.photos).toEqual([b, a]);
  });

  it("nekas nemainās -> tas pats ieraksts bez vēstures", () => {
    const base = rec();
    const r = applyIrissPdPatch(base, { price: "12750" }, ctx);
    expect(r.ok && r.record).toBe(base);
  });
});

describe("Piedāvājumi: 1 auto = 1 piedāvājums", () => {
  const rows = [
    irissPdToListRow(rec({ id: ID, status: "sent", sourceRef: "autoparks:car-1" })),
    irissPdToListRow(rec({ id: ID2, status: "expired", source: "auto1", sourceKey: "DE48213", vehicle: { ...rec().vehicle, vin: "WVWZZZ1KZAW000001" } })),
  ];

  it("aktīvs piedāvājums tam pašam Autoparka auto vai VIN bloķē", () => {
    expect(findIrissPdTakenConflict(rows, { sourceRef: "autoparks:car-1" })?.id).toBe(ID);
    expect(findIrissPdTakenConflict(rows, { vin: "wf0yxxttgyka34521" })?.id).toBe(ID);
  });

  it("beidzies/noraidīts nebloķē; sevi neskaita", () => {
    expect(findIrissPdTakenConflict(rows, { source: "auto1", sourceKey: "de48213" })).toBeNull();
    expect(findIrissPdTakenConflict(rows, { sourceRef: "autoparks:car-1" }, ID)).toBeNull();
  });

  it("Autoparka izvēle: pārdotie/arhivētie nav, aizņemtie atzīmēti", () => {
    const picks = irissPdCarPicks(
      [
        { id: "car-1", make: "Ford", model: "Transit", vin: "WF0YXXTTGYKA34521", plate: "AB-1234", status: "for_sale", archivedAt: "" },
        { id: "car-2", make: "VW", model: "Crafter", vin: "WV1ZZZSYZK9031288", plate: "", status: "sold", archivedAt: "" },
        { id: "car-3", make: "Peugeot", model: "Expert", vin: "VF3VEAHXKLZ082341", plate: "", status: "for_sale", archivedAt: "" },
      ],
      rows,
    );
    expect(picks.map((p) => [p.id, p.vinTail, p.takenBy])).toEqual([
      ["car-1", "A34521", "PD-0217"],
      ["car-3", "082341", ""],
    ]);
  });
});

describe("Piedāvājumi: klienta skats (nekad iekšējie dati)", () => {
  const secretRec = rec({
    status: "sent",
    validUntil: "2026-11-02",
    linkToken: TOKEN,
    source: "autobid",
    sourceUrl: "https://www.autobid.de/lot/48213-ford-transit",
    sourceKey: "48213-SECRET",
    purchasePrice: "9980-SECRET",
    internalNotes: "IEKSEJA-PIEZIME",
    client: { name: "SIA Rīgas Būve", phone: "+37120000000", email: "secret@example.com", orderId: ORDER },
    photos: [{ kind: "url", url: "https://cdn.autobid.de/secret.jpg" }],
    auto1: AUTO1,
  });

  it("publiskajā skatā nav avota, saites, iepirkuma cenas, piezīmju, kontaktu, tokena", () => {
    const json = JSON.stringify(buildIrissPdPublicView(secretRec, "link", NOW));
    for (const secret of ["autobid", "48213", "9980", "IEKSEJA", "+37120000000", "secret@example.com", ORDER, TOKEN, "cdn."]) {
      expect(json).not.toContain(secret);
    }
    expect(json).toContain("Ford Transit Custom");
    expect(sp(json)).toContain("12 750 €");
  });

  it("bojājumu bloks pēc noklusējuma klientam nav; slēdži strādā atsevišķi PDF un saitei", () => {
    const view = buildIrissPdPublicView(secretRec, "link", NOW);
    expect(view.blocks).toEqual({ paint: true, tech: true, equipment: true, vin: true });
    expect(view.auto1?.damage).toEqual([]);
    const vis = defaultIrissPdVisibility();
    vis.blocks.equipment = { pdf: true, link: false };
    const r = { ...secretRec, visibility: vis };
    expect(buildIrissPdPublicView(r, "link", NOW).blocks.equipment).toBeUndefined();
    expect(buildIrissPdPublicView(r, "pdf", NOW).blocks.equipment).toBe(true);
    vis.group.link = false;
    expect(buildIrissPdPublicView(r, "link", NOW).blocks).toEqual({});
  });

  it("stāvoklis: nosūtīts -> open, melnraksts/beidzies -> closed, apstiprināts -> approved", () => {
    expect(buildIrissPdPublicView(secretRec, "link", NOW).state).toBe("open");
    expect(buildIrissPdPublicView({ ...secretRec, status: "draft" }, "link", NOW).state).toBe("closed");
    expect(buildIrissPdPublicView(secretRec, "link", Date.parse("2026-11-03T00:00:00Z")).state).toBe("closed");
    expect(buildIrissPdPublicView({ ...secretRec, status: "approved" }, "link", NOW).state).toBe("approved");
  });

  it("bez klienta - apstiprinot jāprasa kontakts", () => {
    expect(buildIrissPdPublicView(rec({ status: "sent", validUntil: "2026-11-02" }), "link", NOW).needsContact).toBe(true);
    expect(buildIrissPdPublicView(secretRec, "link", NOW).needsContact).toBe(false);
  });

  it("auto dati klientam ar vienībām", () => {
    const facts = buildIrissPdPublicView(secretRec, "link", NOW).facts;
    expect(facts.map((f) => ({ ...f, value: sp(f.value) }))).toContainEqual({ label: "Nobraukums", value: "118 400 km" });
    expect(facts).toContainEqual({ label: "VIN", value: "WF0YXXTTGYKA34521" });
    expect(irissPdSubtitle(facts.map((f) => ({ ...f, value: sp(f.value) })))).toBe("2019 · 118 400 km");
  });

  it("tukša krāsas karte un tukši Auto1 bloki nav klienta skatā", () => {
    const emptyPaint: IrissPdAuto1Blocks = {
      paint: { zones: [{ id: "front", readings: [], warning: false }, { id: "roof", readings: [], warning: false }, { id: "rear", readings: [], warning: false }, { id: "left", readings: [], warning: false }, { id: "right", readings: [], warning: false }], unassigned: [] },
      tech: [],
      equipment: [],
      service: [],
      inspection: [],
      damage: [],
      vinData: [],
    };
    const view = buildIrissPdPublicView(rec({ auto1: emptyPaint, status: "sent", validUntil: "2026-11-02" }), "link", NOW);
    expect(view.blocks).toEqual({});
    expect(view.auto1?.paint).toBeNull();
  });

  it("paslēpto bloku etiķetes tikai ja datos ir saturs", () => {
    expect(irissPdHiddenBlockLabels(secretRec, "link")).toEqual(["Bojājumu kopsavilkums"]);
    expect(irissPdHiddenBlockLabels(rec({ auto1: null }), "link")).toEqual([]);
  });

  it("dzēšanas apstiprinājums nosauc numuru", () => {
    expect(irissPdDeleteConfirm("PD-0217")).toContain("PD-0217");
    expect(irissPdDeleteConfirm("PD-0217")).toContain("nevar atsaukt");
  });
});

describe("Piedāvājumi: saraksts", () => {
  const rows = [
    irissPdToListRow(rec({ id: ID, number: 1, status: "draft", vehicle: { ...rec().vehicle, title: "Mercedes-Benz Sprinter" } })),
    irissPdToListRow(rec({ id: ID2, number: 2, status: "requested", client: { name: "SIA Baltic Cargo", phone: "", email: "", orderId: "" } })),
  ];

  it("meklē pēc modeļa/klienta (bez diakritikas), filtrē pēc statusa un avota", () => {
    expect(filterIrissPdRows(rows, { status: "all", source: "all", query: "baltic" }, NOW).map((r) => r.number)).toEqual([2]);
    expect(filterIrissPdRows(rows, { status: "draft", source: "all", query: "" }, NOW).map((r) => r.number)).toEqual([1]);
    expect(filterIrissPdRows(rows, { status: "all", source: "auto1", query: "" }, NOW)).toEqual([]);
  });

  it("skaitļi, kārtība (Pieprasīts pirmie) un badge skaitlis (Q13 - nerāda)", () => {
    expect(countIrissPdByStatus(rows, NOW)).toMatchObject({ all: 2, draft: 1, requested: 1 });
    expect(sortIrissPdRows(rows).map((r) => r.number)).toEqual([2, 1]);
    expect(irissPdBadgeCount(rows, NOW)).toBe(1);
  });
});

describe("Piedāvājumi: palīgfunkcijas", () => {
  it("cena, marža", () => {
    expect(sp(formatIrissPdPrice("12750"))).toBe("12 750 €");
    expect(formatIrissPdPrice("pēc vienošanās")).toBe("pēc vienošanās");
    expect(sp(irissPdMargin("12 750", "10400"))).toBe("2 350 €");
    expect(irissPdMargin("", "10400")).toBe("");
  });

  it("klienta vārds pasūtījumam: uzņēmums paliek vārda laukā", () => {
    expect(splitIrissPdClientName("Jānis Ozols")).toEqual({ first: "Jānis", last: "Ozols" });
    expect(splitIrissPdClientName("SIA Rīgas Būve")).toEqual({ first: "SIA Rīgas Būve", last: "" });
  });

  it("klientu izvēle no IRISS pasūtījumiem (dzēstie nav, jaunākie pirmie)", () => {
    const opts = irissPdClientOptions([
      { id: ORDER, clientFirstName: "Jānis", clientLastName: "Ozols", phone: "+371 2000", email: "j@x.lv", brandModel: "VW", updatedAt: "2026-10-01" },
      { id: ID, clientFirstName: "Dzēsts", clientLastName: "", phone: "", brandModel: "", updatedAt: "2026-10-05", deletedAt: "2026-10-06" },
      { id: ID2, clientFirstName: "Anna", clientLastName: "", phone: "", brandModel: "BMW", updatedAt: "2026-10-03" },
    ]);
    expect(opts.map((o) => o.name)).toEqual(["Anna", "Jānis Ozols"]);
    expect(opts[1]).toMatchObject({ orderId: ORDER, phone: "+371 2000", email: "j@x.lv" });
  });

  it("normalizē nederīgu JSON droši (svešas foto shēmas, statuss)", () => {
    const r = normalizeIrissPiedavajums({ id: ID, status: "hack", photos: [{ kind: "url", url: "http://x" }, { kind: "dropbox", ref: "../x", id: "a" }], linkToken: "short" });
    expect(r?.status).toBe("draft");
    expect(r?.photos).toEqual([]);
    expect(r?.linkToken).toBe("");
    expect(r?.visibility.blocks.damage).toEqual({ pdf: false, link: false });
    expect(normalizeIrissPiedavajums({ id: "../../etc" })).toBeNull();
  });
});
