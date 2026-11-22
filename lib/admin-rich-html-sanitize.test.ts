import { describe, expect, it } from "vitest";

import {
  coerceAdminRichHtmlForDisplay,
  externalPlainTextToRichSeed,
  normalizeEditorRichHtmlForStorage,
  normalizePastedAdminRichHtml,
} from "@/lib/admin-rich-comment-html";
import { safeAdminRichHref, sanitizeAdminRichHtml, sanitizeAdminRichInlineStyle } from "@/lib/admin-rich-html-sanitize";

/** Rezultātā nedrīkst palikt neviens tags ārpus atļauto saraksta un neviens notikumu atribūts. */
function expectOnlyAllowed(html: string) {
  const tags = [...html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)/g)].map((m) => m[1]!.toLowerCase());
  const allowed = new Set("b strong i em u s strike del br p div span a ul ol li font mark sub sup".split(" "));
  for (const t of tags) expect(allowed.has(t), `tags <${t}>`).toBe(true);
  for (const tag of html.match(/<[a-zA-Z][^>]*>/g) ?? []) {
    expect(/\son[a-z]+\s*=/i.test(tag), tag).toBe(false);
    expect(/(?:java|vb)script:|data:text/i.test(tag), tag).toBe(false);
    expect(/url\(|expression\(/i.test(tag), tag).toBe(false);
  }
}

describe("sanitizeAdminRichHtml - saglabā redaktora formatējumu", () => {
  it("treknraksts, kursīvs, pasvītrojums, rindu pārtraukumi", () => {
    const html = "<b>a</b> <strong>b</strong> <i>c</i> <em>d</em> <u>e</u> <s>f</s><br>g<br />h";
    expect(sanitizeAdminRichHtml(html)).toBe(html);
  });

  it("saraksti un bloki", () => {
    const html = "<div>x</div><p>y</p><ul><li>1</li><li>2</li></ul><ol><li>3</li></ol>";
    expect(sanitizeAdminRichHtml(html)).toBe(html);
  });

  it("span ar krāsu, izcēlumu, izmēru un fontu paliek nemainīts", () => {
    const html =
      '<span style="color: rgb(239, 68, 68);">a</span><span style="background-color:#fde68a">b</span>' +
      '<span style="font-size:14px">c</span><span style="font-family: &quot;Times New Roman&quot;, Times, serif;">d</span>' +
      '<span style="font-weight:bold;font-style:italic;text-decoration:underline">e</span>';
    expect(sanitizeAdminRichHtml(html)).toBe(html);
  });

  it("font un mark tagi paliek tālākai normalizācijai", () => {
    expect(sanitizeAdminRichHtml('<font color="#ef4444" face="Arial">a</font><mark>b</mark>')).toBe(
      '<font color="#ef4444" face="Arial">a</font><mark>b</mark>',
    );
  });

  it("saite: http, https un mailto paliek; pievieno rel", () => {
    expect(sanitizeAdminRichHtml('<a href="https://www.provin.lv/lv?a=1&amp;b=2">x</a>')).toBe(
      '<a href="https://www.provin.lv/lv?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(safeAdminRichHref("mailto:info@provin.lv")).toBe("mailto:info@provin.lv");
    expect(safeAdminRichHref("http://example.com/a")).toBe("http://example.com/a");
  });

  it("entītijas tekstā paliek, kā bija", () => {
    expect(sanitizeAdminRichHtml("a &lt; b &amp; c&nbsp;d")).toBe("a &lt; b &amp; c&nbsp;d");
  });

  it("ir idempotents", () => {
    const html = '<div><span style="color:#111827;position:fixed">a</span> 1 < 2 <a href="https://a.lv/?x=1&y=2">s</a></div>';
    const once = sanitizeAdminRichHtml(html);
    expect(sanitizeAdminRichHtml(once)).toBe(once);
  });
});

describe("sanitizeAdminRichHtml - izmet neatļauto", () => {
  const vectors = [
    "<img src=x onerror=alert(1)>",
    '<img src="x"onerror=alert(1)>',
    "<svg/onload=alert(1)>",
    "<svg><script>alert(1)</script></svg>",
    "<math><mi xlink:href=javascript:alert(1)>x</mi></math>",
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<iframe src="https://example.com"></iframe>',
    '<object data="x"></object><embed src="x">',
    "<script>alert(1)</script>",
    "<scr<script>ipt>alert(1)</scr</script>ipt>",
    "<<!-- -->script>alert(1)</script>",
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVa&#x09;ScRiPt&colon;alert(1)">x</a>',
    '<a href=" &#14; javascript:alert(1)">x</a>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<a href="vbscript:x">x</a>',
    "<b onclick=alert(1) OnMouseOver='alert(2)'>x</b>",
    '<span style="background:url(javascript:alert(1))">x</span>',
    '<span style="width:expression(alert(1))">x</span>',
    '<span style="color:red;background-image:url(https://x.tld/a.png)">x</span>',
    "<font face='a\"onmouseover=\"alert(1)'>x</font>",
    '<p style="x" title="</p><img src=x onerror=alert(1)>">x</p>',
    "<style>*{background:url(x)}</style><link rel=stylesheet href=x><meta http-equiv=refresh content=0>",
    "<form action=x><input name=a><button formaction=x>b</button></form>",
    "<details open ontoggle=alert(1)>x</details>",
    "<img src=x onerror=alert(1) <b>x</b>",
    "<base href=//x.tld/><template><img src=x onerror=1></template>",
    "<textarea><img src=x onerror=1></textarea><noscript><img src=x onerror=1></noscript>",
    '<div style="position:fixed;top:0;left:0;width:100%;height:100%">x</div>',
  ];

  it.each(vectors.map((v, i) => [i + 1, v]))("vektors %i", (_i, input) => {
    const out = sanitizeAdminRichHtml(input as string);
    expectOnlyAllowed(out);
    expect(sanitizeAdminRichHtml(out)).toBe(out);
    expectOnlyAllowed(coerceAdminRichHtmlForDisplay(input as string));
    expectOnlyAllowed(normalizeEditorRichHtmlForStorage(input as string));
    expectOnlyAllowed(normalizePastedAdminRichHtml(input as string));
  });

  it("neatļauta taga teksts paliek, tags pazūd", () => {
    expect(sanitizeAdminRichHtml("<h1>Virsraksts</h1><table><tr><td>a</td></tr></table>")).toBe("Virsraksts" + "a");
  });

  it("nederīga saite zaudē href, teksts paliek", () => {
    expect(sanitizeAdminRichHtml('<a href="javascript:x">teksts</a>')).toBe("<a>teksts</a>");
  });

  it("stilā paliek tikai atļautās īpašības", () => {
    expect(sanitizeAdminRichInlineStyle("color:#ef4444; position:fixed; font-size:12px")).toBe("color:#ef4444;font-size:12px");
    expect(sanitizeAdminRichInlineStyle("background:url(x)")).toBe("");
    expect(sanitizeAdminRichInlineStyle("color:r\\65 d")).toBe("");
  });

  it("nepabeigts tags kļūst par tekstu", () => {
    expect(sanitizeAdminRichHtml("a <img src=x onerror=1")).toBe("a &lt;img src=x onerror=1");
  });
});

describe("externalPlainTextToRichSeed", () => {
  it("klienta teksts vienmēr ir teksts", () => {
    const seed = externalPlainTextToRichSeed('Labdien <b>x</b> <img src=x onerror=1>\n"otrā" rinda & gals');
    expect(seed).toBe(
      "Labdien &lt;b&gt;x&lt;/b&gt; &lt;img src=x onerror=1&gt;<br />&quot;otrā&quot; rinda &amp; gals",
    );
    expect(sanitizeAdminRichHtml(seed)).toBe(seed);
  });

  it("tukšs paliek tukšs", () => {
    expect(externalPlainTextToRichSeed("  ")).toBe("");
    expect(externalPlainTextToRichSeed(null)).toBe("");
  });
});
