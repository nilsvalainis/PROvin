import assert from "node:assert/strict";
import test from "node:test";

import {
  DAMAGE_TABLE_HEAD,
  EXPAND_TEXT_RE,
  FORBIDDEN_CONTROL_RE,
  damageSectionTable,
  fetchAuctionDetail,
  filterDetailPhotos,
  findDetailObject,
  findJsonPhotoList,
  flattenJsonFields,
  mergeDetailExtracts,
  photoIdentity,
  pickExpandControls,
  validDetailUrl,
} from "./detail-page.mjs";

test("validDetailUrl: tikai detaļu lapas uz platformas hosta, Openlane -> /en/", () => {
  assert.equal(validDetailUrl("auto1", "https://www.auto1.com/en/app/merchant/car/DE48213"), "https://www.auto1.com/en/app/merchant/car/DE48213");
  assert.equal(validDetailUrl("auto1", "https://www.auto1.com/en/app/merchant/cars?channel=24h"), "");
  assert.equal(validDetailUrl("auto1", "http://www.auto1.com/en/app/merchant/car/DE48213"), "");
  assert.equal(validDetailUrl("auto1", "https://evil.example/car/DE48213"), "");
  assert.equal(validDetailUrl("openlane", "https://www.openlane.eu/lv/car/info?auctionId=8123456"), "https://www.openlane.eu/en/car/info?auctionId=8123456");
  assert.equal(validDetailUrl("openlane", "https://www.openlane.eu/en/car/8123456"), "https://www.openlane.eu/en/car/8123456");
  assert.equal(validDetailUrl("openlane", "https://www.openlane.eu/en/findcarv6"), "");
  assert.equal(validDetailUrl("autobid", "https://autobid.de/en/item/3051234"), "");
});

test("flattenJsonFields izmet konta laukus", () => {
  const flat = flattenJsonFields({
    stockNumber: "DE48213",
    km: 64300,
    merchantId: 77,
    user: { email: "x@y.z", token: "abc" },
    accessToken: "secret",
    equipment: ["Navigation", "Leather"],
    damages: [{ area: "Front door right", type: "Scratch" }],
  });
  const keys = flat.map(([k]) => k);
  assert.ok(keys.includes("stockNumber"));
  assert.ok(keys.includes("equipment"));
  assert.ok(keys.includes("damages[0].area"));
  assert.ok(!keys.some((k) => /token|email|merchantId/i.test(k)));
  assert.deepEqual(flat.find(([k]) => k === "equipment"), ["equipment", "Navigation, Leather"]);
});

test("findDetailObject atrod lielāko objektu ar šo id", () => {
  const json = { data: { car: { stockNumber: "DE48213", km: 1, manufacturerName: "BMW", vin: "WBA" }, related: [{ stockNumber: "DE11111", km: 2 }] } };
  assert.equal(findDetailObject(json, "de48213")?.vin, "WBA");
  assert.equal(findDetailObject(json, "XX"), null);
});

test("findJsonPhotoList: garākais attēlu saraksts, secība saglabāta", () => {
  const json = {
    images: [
      { fullUrl: "https://img-pa.auto1.com/a/1.jpg", type: "FRONT_LEFT" },
      { fullUrl: "https://img-pa.auto1.com/a/2.jpg" },
      { fullUrl: "https://img-pa.auto1.com/a/3.jpg" },
    ],
    logos: ["https://x.com/logo.svg", "https://x.com/icon.svg"],
  };
  assert.deepEqual(findJsonPhotoList(json), ["https://img-pa.auto1.com/a/1.jpg", "https://img-pa.auto1.com/a/2.jpg", "https://img-pa.auto1.com/a/3.jpg"]);
});

test("filterDetailPhotos: hosts, ikonas, izmēru dublikāti", () => {
  const out = filterDetailPhotos("auto1", [
    { url: "https://img-pa.auto1.com/a/1.jpg?w=200", w: 200 },
    { url: "https://img-pa.auto1.com/a/1.jpg?w=1200", w: 1200 },
    { url: "https://www.auto1.com/static/logo.png", w: 300 },
    { url: "https://img-pa.auto1.com/a/2.jpg", w: 40 },
    { url: "https://cdn.other.com/a/3.jpg", w: 800 },
    "https://img-pa.auto1.com/a/4.jpg",
  ]);
  assert.deepEqual(out, ["https://img-pa.auto1.com/a/1.jpg?w=200", "https://img-pa.auto1.com/a/4.jpg"]);
  assert.equal(photoIdentity("https://h.com/x/thumb/1.jpg?w=10"), photoIdentity("https://h.com/x/1.jpg"));
  const ol = filterDetailPhotos("openlane", ["https://cdn.openlane.eu/images/car/1.jpg", "https://www.openlane.eu/en/car/info", "https://cdn.openlane.eu/icons/flag-de.png"]);
  assert.deepEqual(ol, ["https://cdn.openlane.eu/images/car/1.jpg"]);
});

test("mergeDetailExtracts apvieno cilnes bez dublikātiem", () => {
  const m = mergeDetailExtracts([
    { title: "BMW 320d", fields: [["Keys", "2"], ["Fuel type", "Diesel"]], tables: [], lists: [], photos: [{ url: "a" }], text: "abc" },
    { title: "", fields: [["Keys", "2"], ["Inspection expires", "05/2026"]], tables: [[["Area", "Damage"], ["Door", "Scratch"]]], lists: [{ heading: "Equipment", items: ["Navi", "Leather"] }], photos: [{ url: "b" }], text: "abcdef" },
  ]);
  assert.equal(m.title, "BMW 320d");
  assert.deepEqual(m.fields, [["Keys", "2"], ["Fuel type", "Diesel"], ["Inspection expires", "05/2026"]]);
  assert.equal(m.tables.length, 1);
  assert.equal(m.lists[0].items.length, 2);
  assert.equal(m.photos.length, 2);
  assert.equal(m.text, "abcdef");
});

function fakePage({ url, status = 200, extract, jsonResponses = [] }) {
  const handlers = [];
  let current = "";
  return {
    on: (ev, fn) => ev === "response" && handlers.push(fn),
    off: () => undefined,
    url: () => current,
    goto: async (u) => {
      current = url ?? u;
      for (const r of jsonResponses) for (const h of handlers) await h(r);
      return { status: () => status };
    },
    evaluate: async (fn) => (fn.name === "extractDetailDom" ? extract : undefined),
    locator: () => ({ filter: () => ({ first: () => ({ count: async () => 0 }) }) }),
  };
}

const jsonRes = (u, body) => ({ url: () => u, headers: () => ({ "content-type": "application/json" }), json: async () => body });

test("fetchAuctionDetail: Auto1 JSON auto objekts + DOM lauki, foto izsoles secībā", async () => {
  const page = fakePage({
    extract: {
      title: "BMW 320d xDrive",
      fields: [["Keys", "2"], ["Inspection expires", "05/2026"], ["a", "1"], ["b", "2"], ["c", "3"], ["d", "4"], ["e", "5"], ["f", "6"]],
      tables: [],
      lists: [],
      photos: [{ url: "https://img-pa.auto1.com/a/9.jpg", w: 800 }],
      text: "",
    },
    jsonResponses: [
      jsonRes("https://www.auto1.com/v1/user-token/obtain-token", { token: "x", stockNumber: "DE48213" }),
      jsonRes("https://www.auto1.com/v1/car-details/DE48213", {
        stockNumber: "DE48213",
        manufacturerName: "BMW",
        modelDescription: "320d xDrive",
        km: 64300,
        vin: "WBA5A71000FH12345",
        images: [{ fullUrl: "https://img-pa.auto1.com/a/1.jpg" }, { fullUrl: "https://img-pa.auto1.com/a/2.jpg" }],
      }),
    ],
  });
  const out = await fetchAuctionDetail(page, "auto1", "https://www.auto1.com/en/app/merchant/car/DE48213", { sleep: async () => undefined });
  assert.equal(out.status, "ok");
  assert.equal(out.detail.item.vin, "WBA5A71000FH12345");
  assert.equal(out.detail.item.mileageKm, 64300);
  assert.deepEqual(out.detail.photos, ["https://img-pa.auto1.com/a/1.jpg", "https://img-pa.auto1.com/a/2.jpg", "https://img-pa.auto1.com/a/9.jpg"]);
  assert.ok(out.detail.fields.some(([l]) => l === "Keys"));
  assert.ok(!out.detail.jsonFields.some(([k]) => /token/i.test(k)));
});

test("fetchAuctionDetail: login lapa -> login_required, 404 -> not_found", async () => {
  const login = fakePage({ url: "https://www.auto1.com/en/merchant/signin", extract: null });
  assert.equal((await fetchAuctionDetail(login, "auto1", "https://www.auto1.com/en/app/merchant/car/DE48213", { sleep: async () => undefined })).status, "login_required");
  const gone = fakePage({ status: 404, extract: null });
  assert.equal((await fetchAuctionDetail(gone, "openlane", "https://www.openlane.eu/en/car/8123456", { sleep: async () => undefined })).status, "not_found");
});

test("fetchAuctionDetail: «Show more +» tiek atvērts un saraksts nolasīts vēlreiz (Nils 30.10, DATI PĒC VIN)", async () => {
  let clicked = [];
  let expanded = false;
  const base = { title: "BMW", fields: [["a", "1"], ["b", "2"], ["c", "3"], ["d", "4"], ["e", "5"], ["f", "6"], ["g", "7"], ["h", "8"]], tables: [], photos: [], text: "" };
  const cands = () => [
    { id: "0", tag: "BUTTON", text: expanded ? "Show less" : "Show more +", expanded: null },
    { id: "1", tag: "BUTTON", text: "Bid now", expanded: null },
    { id: "2", tag: "BUTTON", text: "", label: "Kaufen", expanded: "false" },
  ];
  const page = {
    on: () => undefined,
    off: () => undefined,
    url: () => "https://www.auto1.com/en/app/merchant/car/DE1",
    goto: async () => ({ status: () => 200 }),
    evaluate: async (fn, arg) => {
      if (fn.name === "extractDetailDom") return { ...base, lists: [{ heading: "Equipment according to the identification number", items: expanded ? ["A", "B", "C"] : ["A"] }] };
      if (fn.name === "collectExpandCandidatesDom") return cands();
      if (fn.name === "clickExpandControlsDom") {
        clicked.push(...arg);
        expanded = true;
        return arg.length;
      }
      if (fn.name === "detailContentSizeDom") return expanded ? 3 : 1;
      return undefined;
    },
    locator: () => ({ filter: () => ({ first: () => ({ count: async () => 0 }) }) }),
  };
  const out = await fetchAuctionDetail(page, "auto1", "https://www.auto1.com/en/app/merchant/car/DE1", { sleep: async () => undefined });
  assert.equal(out.status, "ok");
  assert.deepEqual(clicked, ["0"]);
  const vinList = out.detail.lists.find((l) => /identification/.test(l.heading));
  assert.ok(vinList.items.includes("C"));
});

test("pickExpandControls: tikai izvēršanas pogas, nekad solīšana / pirkšana (Nils 20.11)", () => {
  const c = (id, o) => ({ id, tag: "BUTTON", text: "", label: "", title: "", testid: "", elId: "", href: "", type: "", expanded: null, haspopup: null, inChrome: false, inForm: false, disabled: false, parent: "", clicks: 0, ...o });
  const cands = [
    c("0", { text: "Show more +" }),
    c("1", { text: "Mehr anzeigen" }),
    c("2", { text: "+" }),
    c("3", { text: "Rādīt vairāk" }),
    c("4", { text: "", label: "Show more", expanded: "false" }),
    c("5", { text: "Vehicle data by VIN", expanded: "false" }),
    c("6", { text: "Show all (25)" }),
    c("7", { text: "+ 15" }),
    // aizliegtās
    c("10", { text: "Bid" }),
    c("11", { text: "Bid now", expanded: "false" }),
    c("12", { text: "Buy now" }),
    c("13", { text: "Sofortkauf" }),
    c("14", { text: "Gebot abgeben", expanded: "false" }),
    c("15", { text: "+", label: "Increase bid" }),
    c("16", { text: "+", testid: "bid-increment-plus" }),
    c("17", { text: "Kaufen" }),
    c("18", { text: "Show more", type: "submit" }),
    c("19", { text: "Show more", inForm: true }),
    c("20", { text: "EN", expanded: "false", haspopup: "true" }),
    c("21", { text: "Menu", expanded: "false", inChrome: true }),
    c("22", { tag: "A", text: "Show more", href: "/en/app/merchant/cars" }),
    c("23", { text: "Show less" }),
    c("24", { text: "Equipment", expanded: "true" }),
    c("25", { text: "Show more", clicks: 3 }),
    c("26", { text: "Add to cart" }),
    c("27", { text: "Solīt" }),
    c("28", { text: "Pirkt" }),
    c("29", { text: "Höchstgebot +" }),
    c("30", { text: "Purchase" }),
    c("31", { text: "Show more", disabled: true }),
  ];
  assert.deepEqual(pickExpandControls(cands, { aria: true }), ["0", "1", "2", "3", "4", "5", "6", "7"]);
  // Bez aria: tikai pēc teksta (Openlane)
  assert.deepEqual(pickExpandControls(cands, { aria: false }), ["0", "1", "2", "3", "4", "6", "7"]);
  // Ligzdotas: vecāks izvēlēts -> bērnu nespiež
  assert.deepEqual(pickExpandControls([c("0", { text: "Equipment", expanded: "false" }), c("1", { text: "+", parent: "0" })], { aria: true }), ["0"]);
});

test("FORBIDDEN_CONTROL_RE / EXPAND_TEXT_RE: stingrs aizsargs", () => {
  for (const t of ["Bid", "bid now", "Place bid", "Gebot", "Bieten", "Jetzt kaufen", "Buy", "Checkout", "Purchase", "Pay now", "Confirm", "Bestätigen", "Solīt", "Nopirkt", "Submit offer"]) {
    assert.ok(FORBIDDEN_CONTROL_RE.test(t), t);
    assert.deepEqual(pickExpandControls([{ id: "0", tag: "BUTTON", text: t, expanded: "false" }], { aria: true }), [], t);
  }
  for (const t of ["Show more", "Show more +", "Mehr anzeigen", "+", "Rādīt vairāk", "Voir plus", "Show all", "Load more"]) {
    assert.ok(EXPAND_TEXT_RE.test(t), t);
    assert.ok(!FORBIDDEN_CONTROL_RE.test(t), t);
  }
  for (const t of ["Show less", "Bid +", "Weniger anzeigen", "Equipment"]) assert.ok(!EXPAND_TEXT_RE.test(t), t);
});

test("mergeDetailExtracts: krāsas mērījumi - pilnākais saraksts, dublikāti saglabāti", () => {
  const base = { title: "Volvo", fields: [], tables: [], lists: [], photos: [], text: "" };
  const m = mergeDetailExtracts([
    { ...base, paint: [] },
    { ...base, paint: [["left", "110 μm"], ["left", "110 μm"], ["right", "270 μm"], ["roof", "N/A Material not measurable"]] },
    { ...base, paint: [["left", "110 μm"]] },
    { ...base },
  ]);
  assert.deepEqual(m.paint, [["left", "110 μm"], ["left", "110 μm"], ["right", "270 μm"], ["roof", "N/A Material not measurable"]]);
});

// Nils 20.11: Auto1 «DAMAGE SUMMARY» (piem. TF43858 Skoda Kodiaq) ir div režģis, nevis <table> - šūnas ar koordinātām.
const cell = (t, x, y, w = 100, h = 20) => ({ t, x, y, w, h });
const DAMAGE_GRID = {
  cells: [
    cell("AREA", 0, 100), cell("DAMAGE", 120, 100), cell("SEVERITY", 240, 100), cell("DESCRIPTION", 420, 100), cell("QUANTITY", 600, 100, 60), cell("PARTS AFFECTED", 680, 100),
    cell("Exterior", 0, 130, 100, 80), cell("Dent", 120, 130, 100, 50), cell("Width: ≥20mm & <50mm", 240, 130, 160), cell("Paint damage", 420, 130), cell("2", 625, 130, 10), cell("Rear left fender (2)", 680, 130, 140), cell("Show photos", 830, 130),
    cell("Width: ≥5mm & <20mm", 240, 160, 160), cell("Paint damage", 420, 160), cell("1", 625, 160, 10), cell("Front right door (1)", 680, 160, 140),
    cell("Repaint", 120, 190), cell("Thickness: ≥250µm & <500µm", 240, 190, 170), cell("1", 625, 190, 10), cell("Hood (1)", 680, 190),
    cell("Interior", 0, 230), cell("Dirty", 120, 230), cell("Stains", 420, 230), cell("2", 625, 230, 10), cell("Driver seat (1)", 680, 230), cell("Rear seat (1)", 680, 248),
  ],
  lines: [],
};

test("damageSectionTable: div režģis pēc koordinātām -> kanoniska tabula ar zonām", () => {
  const t = damageSectionTable(DAMAGE_GRID);
  assert.deepEqual(t[0], DAMAGE_TABLE_HEAD);
  assert.deepEqual(t.slice(1), [
    ["Exterior", "Dent", "Width: ≥20mm & <50mm", "Paint damage", "2", "Rear left fender (2)"],
    ["Exterior", "Dent", "Width: ≥5mm & <20mm", "Paint damage", "1", "Front right door (1)"],
    ["Exterior", "Repaint", "Thickness: ≥250µm & <500µm", "", "1", "Hood (1)"],
    ["Interior", "Dirty", "", "Stains", "2", "Driver seat (1), Rear seat (1)"],
  ]);
});

test("damageSectionTable: bez Area kolonnas «Exterior» virsraksts kļūst par zonu", () => {
  const t = damageSectionTable({
    cells: [
      cell("Damage", 0, 10), cell("Severity", 150, 10), cell("Quantity", 400, 10), cell("Parts affected", 500, 10),
      cell("Exterior damages", 0, 40, 300),
      cell("Scratch", 0, 70), cell("Length: <20mm", 150, 70), cell("3", 420, 70, 10), cell("Front bumper (3)", 500, 70),
    ],
  });
  assert.deepEqual(t.slice(1), [["Exterior damages", "Scratch", "Length: <20mm", "", "3", "Front bumper (3)"]]);
});

test("damageSectionTable: bez koordinātām - pēc teksta rindām", () => {
  const t = damageSectionTable({
    cells: [],
    lines: [
      "Area", "Damage", "Severity", "Description", "Quantity", "Parts affected",
      "Exterior", "Dent", "Width: ≥20mm & <50mm", "Paint damage", "2", "Rear left fender (2)",
      "Width: ≥5mm & <20mm", "Paint damage", "1", "Front right door (1)",
      "Stone chip", "Minor", "4", "Hood (3)", "Windscreen (1)",
      "Interior", "Dirty", "2", "Driver seat (2)",
      "Show more +",
    ],
  });
  assert.deepEqual(t.slice(1), [
    ["Exterior", "Dent", "Width: ≥20mm & <50mm", "Paint damage", "2", "Rear left fender (2)"],
    ["Exterior", "Dent", "Width: ≥5mm & <20mm", "Paint damage", "1", "Front right door (1)"],
    ["Exterior", "Stone chip", "Minor", "", "4", "Hood (3), Windscreen (1)"],
    ["Interior", "Dirty", "", "", "2", "Driver seat (2)"],
  ]);
  assert.equal(damageSectionTable({ cells: [], lines: ["No damages"] }), null);
  assert.equal(damageSectionTable(null), null);
});

test("mergeDetailExtracts: bojājumu sadaļa -> pilnākā tabula pirmā; īsta <table> paliek priekšroka", () => {
  const partial = { cells: DAMAGE_GRID.cells.slice(0, 13), lines: [] };
  const m = mergeDetailExtracts([
    { title: "Skoda Kodiaq", fields: [], tables: [[["Year", "Km", "Owner"], ["2019", "1", "x"]]], lists: [], damageRaw: [partial], photos: [], text: "" },
    { title: "", fields: [], tables: [], lists: [], damageRaw: [DAMAGE_GRID], photos: [], text: "" },
  ]);
  assert.deepEqual(m.tables[0][0], DAMAGE_TABLE_HEAD);
  assert.equal(m.tables[0].length, 5);
  assert.equal(m.tables.length, 2);
  const real = [["Area", "Damage", "Quantity"], ["Exterior", "Dent", "1"]];
  const m2 = mergeDetailExtracts([{ title: "", fields: [], tables: [real], lists: [], damageRaw: [DAMAGE_GRID], photos: [], text: "" }]);
  assert.deepEqual(m2.tables, [real]);
  assert.equal("damageRaw" in m2, false);
});
