import { describe, expect, it } from "vitest";
import {
  formatListingSnapshotForPasteField,
  htmlToTextKeepLines,
  isAllowedListingScrapeHost,
  isSsLvHost,
  listingScrapeFetchUrl,
  parseGenericListingHtml,
  parseListingHtmlForUrl,
  parseSsLvListingHtml,
  sameListingUrl,
  unwrapListingHistoryLink,
} from "@/lib/listing-scrape";

function ssLvListingHtml(opts: { kmLabel: string; kmValue: string; posted: string }): string {
  return `<html><head><title>Audi Q7 - Sludinājumi</title></head><body>
<table class="options_list">
<tr><td class="ads_opt_name">${opts.kmLabel}:</td><td class="ads_opt"><b>${opts.kmValue}</b></td></tr>
<tr><td class="ads_opt_name">Cena:</td><td class="ads_opt"><b>23 950 €</b></td></tr>
</table>
<div class="msg_footer">Izvietots: ${opts.posted}</div>
</body></html>`;
}

describe("parseSsLvListingHtml", () => {
  it("reads odometer, first posted date and days listed", () => {
    const snap = parseSsLvListingHtml(
      ssLvListingHtml({ kmLabel: "Nobraukums, km", kmValue: "233 000", posted: "16.07.2026" }),
      new Date(2026, 7, 13),
    );
    expect(snap.ok).toBe(true);
    expect(snap.currentKm).toBe("233 000 km");
    expect(snap.postedDateRaw).toBe("16.07.2026");
    expect(snap.daysListed).toBe(28);
  });

  it("expands Nobraukums, tūkst. km into full kilometres", () => {
    const snap = parseSsLvListingHtml(
      ssLvListingHtml({ kmLabel: "Nobraukums, tūkst. km", kmValue: "167", posted: "20.05.2026" }),
      new Date(2026, 7, 13),
    );
    expect(snap.currentKm).toBe("167 000 km");
  });
});

describe("parseGenericListingHtml", () => {
  it("reads title, km and posted date from autoplius-like HTML", () => {
    const html = `<html><head>
      <meta property="og:title" content="Audi Q7 3.0 TDI" />
      <meta property="og:description" content="Pardodams Audi Q7, labs stavoklis, servisa vesture." />
    </head><body>
      <p>Rida: 167 000 km</p>
      <p>Paskelbta: 02.02.2026</p>
      <p>Kaina 23 950 €</p>
      <dt>Gads</dt><dd>2015</dd>
    </body></html>`;
    const snap = parseGenericListingHtml(html, "https://autoplius.lt/skelbimai/audi-q7-123", new Date(2026, 7, 13));
    expect(snap.ok).toBe(true);
    expect(snap.pageTitle).toBe("Audi Q7 3.0 TDI");
    expect(snap.currentKm).toBe("167 000 km");
    expect(snap.postedDateRaw).toBe("02.02.2026");
    expect(snap.currentPriceEur).toContain("23 950");
    expect(snap.options.some((o) => o.label === "Gads" && o.value === "2015")).toBe(true);
  });
});

/** Anonimizēts www.ss.com paraugs (struktūra kā 24.11 īstā lapā; bez VIN, numuriem, tālruņiem). */
const SS_WWW_HTML = `<html><head><title>SS.COM BMW Citi, Cena 33 700 €. Pārdodu BMW i4 - Sludinājumi</title></head><body>
<div id="msg_div_msg">
<div style="float:right;margin:0px 0px 20px 20px;" id="content_sys_div_msg"><div>reklāma</div></div>

Pārdodu BMW i4 edrive40<br />
Komplektā ziemas riepas<br />
Viens īpašnieks<br />
<br />
Auto nav sists &amp; servisēts pie dīlera<br><br><table cellpadding=0 cellspacing=0 border=0 width="100%" class="options_list"><tr><td>
<table>
<tr><td class="ads_opt_name" width=30 nowrap>Marka</td><td class="ads_opt" id="tdo_31"><b>Bmw Citi</b></td></tr>
<tr><td class="ads_opt_name">Nobraukums, km:</td><td class="ads_opt" id="tdo_16">77 400</td></tr>
<tr><td class="ads_opt_name">Krāsa:</td><td class="ads_opt" id="tdo_17">Pelēka <div class="ads_color_opt">&nbsp;</div> metālika</td></tr>
<tr><td class="ads_opt_name">VIN kods:</td><td class="ads_opt" id="tdo_1678"><a href="javascript:;">Parādīt vin kodu</a></td></tr>
</table></td></tr></table>
<table><tr><td class="auto_c_column" valign=top><div class="auto_c_head">Aprīkojums</div><img src="x.gif">&nbsp;<b class="auto_c">Kondicionieris</b><br> Autonomais sildītājs<br><img src="x.gif">&nbsp;<b class="auto_c">Klimata kontrole</b><br></td></tr></table>
</div>
<div class="msg_footer">Datums: 20.11.2026</div>
</body></html>`;

/** Anonimizēts m.ss.com paraugs: apraksts ir `<div>` aiz galvenās bildes skripta, bez msg_div_msg. */
const SS_MOBILE_HTML = `<html><head><title>SS.COM - Audi A4 - Sludinājumi</title>
<link rel="canonical" href="https://www.ss.com/msg/lv/transport/cars/audi/a4/xxxxx.html"></head><body>
<div id="main"><div style="padding:0px 5px 5px 5px;height:100%;"><center><div id="current_big_pic"></div></center><script type="text/javascript">_mbigpic(0,"current_big_pic");</script><div style="padding-top:10px;">Audi A4 Quattro 3.0 dīzelis, Automāts. <br />
<br />
Tehniskā daļa:<br />
 Quattro pilnpiedziņa<br />
 Sporta piekare</div><br><table>
<tr><td class="ads_opt_name">Nobraukums, km:</td><td style="width: 100%;" class="ads_opt" id="tdo_16">210 000</td></tr>
<tr><td valign=top colspan=2 class="ads_opt_name_auto"><b>Aprīkojums:</b> Kondicionieris, Klimata kontrole</td></tr>
</table></div></div></body></html>`;

describe("ss.lv / ss.com pārdevēja apraksts", () => {
  it("www.ss.com: pilns apraksts ar rindiņām, bez reklāmas bloka; parametri un aprīkojums", () => {
    const snap = parseListingHtmlForUrl(SS_WWW_HTML, "https://www.ss.com/msg/lv/transport/cars/bmw/another/xxxxx.html");
    expect(snap.description).toBe(
      "Pārdodu BMW i4 edrive40\nKomplektā ziemas riepas\nViens īpašnieks\n\nAuto nav sists & servisēts pie dīlera",
    );
    expect(snap.pageTitle).toBe("BMW Citi");
    expect(snap.currentKm).toBe("77 400 km");
    expect(snap.options).toContainEqual({ label: "Krāsa", value: "Pelēka metālika" });
    expect(snap.options.some((o) => /Parādīt/.test(o.value))).toBe(false);
    expect(snap.options).toContainEqual({ label: "Aprīkojums", value: "Kondicionieris, Klimata kontrole" });
    const paste = formatListingSnapshotForPasteField(snap);
    expect(paste.startsWith("BMW Citi\n\nPārdodu BMW i4 edrive40\nKomplektā")).toBe(true);
    expect(paste).not.toContain("reklāma");
  });

  it("m.ss.com: apraksts no mobilās lapas", () => {
    const snap = parseListingHtmlForUrl(SS_MOBILE_HTML, "https://m.ss.com/msg/lv/transport/cars/audi/a4/xxxxx.html");
    expect(snap.description).toBe("Audi A4 Quattro 3.0 dīzelis, Automāts.\n\nTehniskā daļa:\nQuattro pilnpiedziņa\nSporta piekare");
    expect(snap.pageTitle).toBe("Audi A4");
    expect(snap.currentKm).toBe("210 000 km");
    expect(snap.options).toContainEqual({ label: "Aprīkojums", value: "Kondicionieris, Klimata kontrole" });
  });

  it("ss.com ir ss.lv parsētājs; m. saites ielasa www versijā", () => {
    expect(isSsLvHost("www.ss.com")).toBe(true);
    expect(isSsLvHost("m.ss.com")).toBe(true);
    expect(isSsLvHost("ss.lv")).toBe(true);
    expect(isSsLvHost("notss.com")).toBe(false);
    expect(listingScrapeFetchUrl("https://m.ss.com/msg/lv/a/b.html#photo-3")).toBe("https://www.ss.com/msg/lv/a/b.html");
    expect(listingScrapeFetchUrl("https://m.ss.lv/msg/lv/a/b.html")).toBe("https://www.ss.lv/msg/lv/a/b.html");
    expect(listingScrapeFetchUrl("https://www.auto24.lv/lietoti/1")).toBe("https://www.auto24.lv/lietoti/1");
  });
});

describe("citu portālu pārdevēja apraksts", () => {
  it("autoplius: oriģinālais teksts, nevis mašīntulkojums", () => {
    const html = `<html><head><meta property="og:title" content="Audi A6" /><meta property="og:description" content="Saīsināts..." /></head><body>
      <nav>Meklēt Pieslēgties</nav>
      <div class="announcement-content-title">Apraksts</div>
      <template class="js-comment-original-html">Parduodamas Audi A6<br />
Nedaužtas, viena savininkė<br />
<br />
Rida 210 000 km</template>
      <div class="announcement-description js-comment-body">Pārdod Audi A6<br />Nav sists</div>
      <footer>Kontakti</footer></body></html>`;
    const snap = parseListingHtmlForUrl(html, "https://lv.autoplius.lt/sludinajumi/audi-a6-123.html");
    expect(snap.description).toBe("Parduodamas Audi A6\nNedaužtas, viena savininkė\n\nRida 210 000 km");
  });

  it("reklama.lv: itemprop=description elements, nevis saīsinātais meta", () => {
    const html = `<html><head><meta name="description" content="Īss..." /></head><body>
      <h1 itemprop="name">Audi A4 2.0 TDI</h1>
      <div class="vw-descr c-article" id="j-descr" itemprop="description"><br />
Auto labā stāvoklī.<br />
<br />
Servisa grāmatiņa.</div><div class="vendor">Pārdevējs</div></body></html>`;
    const snap = parseListingHtmlForUrl(html, "https://reklama.lv/riga/transport/legkovye-avtomobili/audi/x-1.html");
    expect(snap.description).toBe("Auto labā stāvoklī.\n\nServisa grāmatiņa.");
  });

  it("JSON-LD description, ja nav itemprop elementa", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"Car","name":"VW Golf","description":"Pirmais īpašnieks.\\nServiss pie dīlera."}</script></head><body></body></html>`;
    const snap = parseListingHtmlForUrl(html, "https://www.auto24.lv/lietoti/1");
    expect(snap.description).toBe("Pirmais īpašnieks.\nServiss pie dīlera.");
  });
});

describe("palīgfunkcijas", () => {
  it("htmlToTextKeepLines saglabā rindiņas un atšifrē entītijas", () => {
    expect(htmlToTextKeepLines("A&nbsp;B<br>\n C &amp; D<br><br><br><br>E<script>x()</script>")).toBe("A B\nC & D\n\nE");
  });

  it("adify.lv / tirgusdati.lv vēstures saite -> īstā sludinājuma saite", () => {
    const ss = "https://www.ss.com/msg/lv/transport/cars/audi/a4/xxxxx.html";
    expect(unwrapListingHistoryLink(`https://adify.lv/history?url=${encodeURIComponent(ss)}`)).toBe(ss);
    expect(unwrapListingHistoryLink(`https://www.tirgusdati.lv/vesture?q=${encodeURIComponent(ss)}`)).toBe(ss);
    expect(unwrapListingHistoryLink(ss)).toBe(ss);
  });

  it("sameListingUrl ignorē www./m., # un ss.lv/ss.com", () => {
    expect(sameListingUrl("https://m.ss.com/msg/lv/a/b.html", "https://www.ss.lv/msg/lv/a/b.html#photo-2")).toBe(true);
    expect(sameListingUrl("https://www.ss.com/msg/lv/a/b.html", "https://www.ss.com/msg/lv/a/c.html")).toBe(false);
  });

  it("mobile.de nekad nav atļauts serverim", () => {
    expect(isAllowedListingScrapeHost("suchen.mobile.de")).toBe(false);
    expect(isAllowedListingScrapeHost("m.mobile.de")).toBe(false);
    expect(isAllowedListingScrapeHost("www.ss.com")).toBe(true);
  });
});
