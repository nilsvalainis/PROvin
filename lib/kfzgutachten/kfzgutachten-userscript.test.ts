/**
 * PROVIN userscript kfzgutachten.at lapā: rezultātu saraksts -> pasūtījums (bez ielīmēšanas).
 * Testi palaiž īsto skriptu Node vm vidē (lib/vin-scan/test-helpers/userscript-vm.ts). Dati izdomāti.
 */
import { describe, expect, it } from "vitest";

import { FAKE_VIN } from "@/lib/kfzgutachten/__fixtures__/gutachten";
import { parseKfzSearchListText } from "@/lib/kfzgutachten/apply-citi";
import { kfzgutachtenSearchUrl } from "@/lib/kfzgutachten/kfzgutachten";
import {
  KFZ_AT_LIST_ACK_EVENT,
  KFZ_AT_LIST_EVENT,
  KFZ_AT_USERSCRIPT_MIN,
  parseKfzAtUserscriptDetail,
} from "@/lib/kfzgutachten/userscript-bridge";
import { vinScanUserscriptMeetsMin } from "@/lib/vin-scan/catalog";
import {
  FakeElement,
  parseUserscriptMeta,
  readUserscriptSource,
  runUserscriptAt,
  userscriptMatchesUrl,
} from "@/lib/vin-scan/test-helpers/userscript-vm";

const SESSION = "cs_test_a1B2c3D4e5F6g7H8i9J0kfz";
const OTHER_VIN = "WVWZZZ1KZ6W999999";
const NOW = Date.parse("2026-11-17T10:00:00.000Z");
const meta = parseUserscriptMeta(readUserscriptSource());

/** Rezultātu tabula kā kfzgutachten.at (Modelis | Datums | Numurzīme | VIN), ar HTML formatējumu un skriptu. */
const RESULT_TABLE_HTML = `<!DOCTYPE html><html><head><title>KFZ Gutachten</title>
<script>var vin = "${OTHER_VIN}"; var row = "01.01.2001 W 1A ${OTHER_VIN}";</script></head>
<body>
  <form><input name="vin" value="${FAKE_VIN}"><input name="date" value="15.03.2006"><button>Suchen</button></form>
  <h2>Suchergebnisse</h2>
  <table class="table">
    <thead>
      <tr>
        <th>Marke und Type</th>
        <th>Gutachtendatum</th>
        <th>Kennzeichen</th>
        <th>FIN</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>VOLKSWAGEN
            1K</td>
        <td>05.10.2022</td>
        <td>GU&nbsp;123AB</td>
        <td>${FAKE_VIN}</td>
        <td><a href="/Gutachten/Kaufen/1">Kaufen</a></td>
      </tr>
      <tr>
        <td>VOLKSWAGEN 1K</td>
        <td>02.10.2021</td>
        <td>W-55555X</td>
        <td>${FAKE_VIN}</td>
        <td><a href="/Gutachten/Kaufen/2">Kaufen</a></td>
      </tr>
      <tr>
        <td>VOLKSWAGEN 1K</td>
        <td>01.10.2020</td>
        <td>W 77777Y</td>
        <td>${OTHER_VIN}</td>
        <td><a href="/Gutachten/Kaufen/3">Kaufen</a></td>
      </tr>
    </tbody>
  </table>
</body></html>`;

/** Kartīšu izkārtojums (telefons): etiķete + vērtība atsevišķos elementos. */
const RESULT_CARDS_HTML = `<html><body>
  <div class="card"><div><b>Marke und Type:</b> <span>SKODA 5E</span></div>
  <div><b>Gutachtendatum:</b> <span>12.04.2023</span></div>
  <div><b>Kennzeichen:</b> <span>L 4444Z</span></div>
  <div><b>FIN:</b> <span>${FAKE_VIN}</span></div></div>
</body></html>`;

function kfzUrl(extra = "") {
  return `https://kfzgutachten.at/?vin=${FAKE_VIN}&date=15.03.2006${extra}`;
}

function gmJson(run: ReturnType<typeof runUserscriptAt>, key: string): Record<string, unknown> | null {
  const raw = run.gm.set.get(key);
  return raw ? (JSON.parse(String(raw)) as Record<string, unknown>) : null;
}

function statusText(run: ReturnType<typeof runUserscriptAt>): string {
  return run.created.find((el) => el.id === "provin-kfz-status")?.textContent ?? "";
}

describe("userscript galvene un versija", () => {
  it("kfzgutachten.at ir @match; versija >= 1.27.0 un atbilst paneļa minimumam", () => {
    expect(userscriptMatchesUrl(meta, kfzUrl(`&provin=${SESSION}`))).toBe(true);
    expect(userscriptMatchesUrl(meta, "https://www.kfzgutachten.at/Home/Search")).toBe(true);
    expect(meta.version).toBe(KFZ_AT_USERSCRIPT_MIN);
    expect(vinScanUserscriptMeetsMin(meta.version)).toBe(true);
  });

  it("«Atvērt sarakstu» saitē ir pasūtījuma identifikators", () => {
    expect(kfzgutachtenSearchUrl(FAKE_VIN, "15.03.2006", SESSION)).toBe(
      `https://kfzgutachten.at/?vin=${FAKE_VIN}&date=15.03.2006&provin=${SESSION}`,
    );
    expect(kfzgutachtenSearchUrl(FAKE_VIN, "15.03.2006", "a b")).toBe(`https://kfzgutachten.at/?vin=${FAKE_VIN}&date=15.03.2006`);
    expect(kfzgutachtenSearchUrl(FAKE_VIN, "15.03.2006")).toBe(`https://kfzgutachten.at/?vin=${FAKE_VIN}&date=15.03.2006`);
  });
});

describe("kfzgutachten.at lapa: saraksts -> GM krātuve", () => {
  it("ar provin saitē nosūta tikai pasūtījuma VIN rindas formā, ko pieņem ielīmēšanas parsētājs", () => {
    const suchen = new FakeElement("button", { text: "Suchen" });
    const run = runUserscriptAt(kfzUrl(`&provin=${SESSION}`), { pageHtml: RESULT_TABLE_HTML, elements: [suchen] });
    expect(run.errors).toEqual([]);
    expect(gmJson(run, "provin_kfz_at_order")).toMatchObject({ sessionId: SESSION, vin: FAKE_VIN });
    const list = gmJson(run, "provin_kfz_at_list");
    expect(list).toMatchObject({ sessionId: SESSION, vin: FAKE_VIN, count: 2 });
    expect(String(list!.text)).not.toContain(OTHER_VIN);
    const rows = parseKfzSearchListText(String(list!.text), FAKE_VIN);
    expect(rows).toEqual([
      { date: "05.10.2022", plate: "GU 123AB", vin: FAKE_VIN, model: "VOLKSWAGEN 1K" },
      { date: "02.10.2021", plate: "W 55555X", vin: FAKE_VIN, model: "VOLKSWAGEN 1K" },
    ]);
    expect(statusText(run)).toBe("PROVIN: 2 apskates nosūtītas pasūtījumam");
    // Neko nespiež lietotāja vietā (Suchen, Kaufen) un nepārvirza lapu.
    expect(suchen.clicks).toBe(0);
    expect(run.assigned).toEqual([]);
    expect(run.opened).toEqual([]);
    expect(run.gm.xhr).toEqual([]);
  });

  it("bez provin saitē (un bez atcerēta pasūtījuma) neko nesūta, tikai atturīgs brīdinājums", () => {
    const run = runUserscriptAt(kfzUrl(), { pageHtml: RESULT_TABLE_HTML });
    expect(run.errors).toEqual([]);
    expect(run.gm.set.has("provin_kfz_at_list")).toBe(false);
    expect(run.gm.set.has("provin_kfz_at_order")).toBe(false);
    expect(statusText(run)).toMatch(/nav pasūtījuma/);
  });

  it("nederīgs provin vai VIN netiek pieņemts", () => {
    const run = runUserscriptAt(`https://kfzgutachten.at/?vin=ABC&date=&provin=${SESSION}`, { pageHtml: RESULT_TABLE_HTML });
    expect(run.gm.set.has("provin_kfz_at_order")).toBe(false);
    const bad = runUserscriptAt(kfzUrl("&provin=%3Cscript%3E"), { pageHtml: RESULT_TABLE_HTML });
    expect(bad.gm.set.has("provin_kfz_at_list")).toBe(false);
  });

  it("pēc «Suchen» (cita lapa bez parametriem) izmanto atcerēto pasūtījumu; vecs (>2 h) netiek lietots", () => {
    const order = JSON.stringify({ sessionId: SESSION, vin: FAKE_VIN, at: NOW - 10 * 60 * 1000 });
    const run = runUserscriptAt("https://kfzgutachten.at/Home/Search", {
      pageHtml: RESULT_TABLE_HTML,
      gm: { provin_kfz_at_order: order },
    });
    expect(gmJson(run, "provin_kfz_at_list")).toMatchObject({ sessionId: SESSION, count: 2 });

    const stale = JSON.stringify({ sessionId: SESSION, vin: FAKE_VIN, at: NOW - 3 * 60 * 60 * 1000 });
    const old = runUserscriptAt("https://kfzgutachten.at/Home/Search", {
      pageHtml: RESULT_TABLE_HTML,
      gm: { provin_kfz_at_order: stale },
    });
    expect(old.gm.set.has("provin_kfz_at_list")).toBe(false);
  });

  it("pieteikšanās lapa ar ReturnUrl saglabā pasūtījumu", () => {
    const ret = encodeURIComponent(`/?vin=${FAKE_VIN}&date=15.03.2006&provin=${SESSION}`);
    const run = runUserscriptAt(`https://kfzgutachten.at/Account/Login?ReturnUrl=${ret}`, { pageHtml: "<html><body>Login</body></html>" });
    expect(gmJson(run, "provin_kfz_at_order")).toMatchObject({ sessionId: SESSION, vin: FAKE_VIN });
    expect(run.gm.set.has("provin_kfz_at_list")).toBe(false);
    expect(statusText(run)).toBe("PROVIN: gaida sarakstu");
  });

  it("sarakstā nav pasūtījuma VIN -> kļūda, nekas netiek nosūtīts", () => {
    const html = RESULT_TABLE_HTML.split(FAKE_VIN).join(OTHER_VIN);
    const run = runUserscriptAt(kfzUrl(`&provin=${SESSION}`), { pageHtml: html });
    expect(run.gm.set.has("provin_kfz_at_list")).toBe(false);
    expect(statusText(run)).toBe(`PROVIN: sarakstā nav pasūtījuma VIN ${FAKE_VIN}`);
  });

  it("kartīšu izkārtojums ar etiķetēm", () => {
    const run = runUserscriptAt(kfzUrl(`&provin=${SESSION}`), { pageHtml: RESULT_CARDS_HTML });
    const list = gmJson(run, "provin_kfz_at_list");
    expect(parseKfzSearchListText(String(list?.text ?? ""), FAKE_VIN)).toEqual([
      { date: "12.04.2023", plate: "L 4444Z", vin: FAKE_VIN, model: "SKODA 5E" },
    ]);
  });

  it("admina apstiprinājums parādās statusā; tas pats saraksts netiek sūtīts atkārtoti", () => {
    const run = runUserscriptAt(kfzUrl(`&provin=${SESSION}`), { pageHtml: RESULT_TABLE_HTML });
    const first = gmJson(run, "provin_kfz_at_list")!;
    run.gm.set.delete("provin_kfz_at_list");
    run.gm.set.set("provin_kfz_at_ack", JSON.stringify({ sessionId: SESSION, at: first.at, added: 2 }));
    run.advance(1000);
    run.tickIntervals(1000);
    expect(run.gm.set.has("provin_kfz_at_list")).toBe(false);
    expect(statusText(run)).toBe("PROVIN: 2 apskates nosūtītas pasūtījumam (saņemts)");
  });

  it("kfzgutachten.at lapā nepatērē gaidošo VIN un neskrien citu vietņu aizpilde", () => {
    const run = runUserscriptAt(kfzUrl(`&provin=${SESSION}`), {
      pageHtml: RESULT_TABLE_HTML,
      gm: { provin_pending_vin: OTHER_VIN },
    });
    expect(run.gm.set.get("provin_pending_vin")).toBe(OTHER_VIN);
    expect(run.timers.filter((t) => t.ms === 250)).toHaveLength(0);
  });
});

describe("admin lapa: GM krātuve -> pasūtījuma panelis", () => {
  const ADMIN_ORDER = "https://www.provin.lv/admin/orders/x";
  const stored = () => JSON.stringify({ sessionId: SESSION, vin: FAKE_VIN, text: `VW 1K\t05.10.2022\tGU 123AB\t${FAKE_VIN}`, count: 1, at: NOW - 5000 });

  it("nodod sarakstu notikumā; pēc sava pasūtījuma ack ieraksts tiek dzēsts", () => {
    const run = runUserscriptAt(ADMIN_ORDER, { gm: { provin_kfz_at_list: stored() } });
    expect(run.errors).toEqual([]);
    run.tickIntervals(1500);
    const ev = run.dispatched.filter((d) => d.type === KFZ_AT_LIST_EVENT);
    expect(ev).toHaveLength(1);
    const detail = parseKfzAtUserscriptDetail(ev[0]!.detail);
    expect(detail).toMatchObject({ sessionId: SESSION, vin: FAKE_VIN, count: 1, at: NOW - 5000 });
    expect(parseKfzSearchListText(detail!.text, FAKE_VIN)).toHaveLength(1);

    run.fire(KFZ_AT_LIST_ACK_EVENT, { sessionId: "cits_pasutijums_123", at: NOW - 5000, added: 1 });
    expect(run.gm.set.has("provin_kfz_at_list")).toBe(true);
    run.fire(KFZ_AT_LIST_ACK_EVENT, { sessionId: SESSION, at: NOW - 5000, added: 1 });
    expect(run.gm.set.has("provin_kfz_at_list")).toBe(false);
    expect(gmJson(run, "provin_kfz_at_ack")).toMatchObject({ sessionId: SESSION, at: NOW - 5000, added: 1 });
  });

  it("vecs ieraksts (>2 h) tiek dzēsts, nevis nodots", () => {
    const old = JSON.stringify({ sessionId: SESSION, vin: FAKE_VIN, text: "x", count: 1, at: NOW - 3 * 60 * 60 * 1000 });
    const run = runUserscriptAt(ADMIN_ORDER, { gm: { provin_kfz_at_list: old } });
    run.tickIntervals(1500);
    expect(run.dispatched.filter((d) => d.type === KFZ_AT_LIST_EVENT)).toHaveLength(0);
    expect(run.gm.set.has("provin_kfz_at_list")).toBe(false);
  });

  it("notikuma detail pārbaude", () => {
    expect(parseKfzAtUserscriptDetail(null)).toBeNull();
    expect(parseKfzAtUserscriptDetail({ sessionId: "x", vin: FAKE_VIN, text: "a", at: 1 })).toBeNull();
    expect(parseKfzAtUserscriptDetail({ sessionId: SESSION, vin: "ABC", text: "a", at: 1 })).toBeNull();
    expect(parseKfzAtUserscriptDetail({ sessionId: SESSION, vin: FAKE_VIN, text: " ", at: 1 })).toBeNull();
    expect(parseKfzAtUserscriptDetail({ sessionId: SESSION, vin: FAKE_VIN.toLowerCase(), text: "a", at: 1 })?.vin).toBe(FAKE_VIN);
  });
});

describe("ielīmēšanas parsētājs: tabulas rindas", () => {
  it("numurzīme no šūnas arī ar atstarpēm vai defisi", () => {
    const rows = parseKfzSearchListText(
      [`VW 1K\t05.10.2022\tGU 123 AB\t${FAKE_VIN}`, `VW 1K\t02.10.2021\tW-55555X\t${FAKE_VIN}`, `VW 1K\t01.10.2020\tW 1A\t${OTHER_VIN}`].join("\n"),
      FAKE_VIN,
    );
    expect(rows.map((r) => [r.date, r.plate])).toEqual([
      ["05.10.2022", "GU 123 AB"],
      ["02.10.2021", "W 55555X"],
    ]);
  });
});
