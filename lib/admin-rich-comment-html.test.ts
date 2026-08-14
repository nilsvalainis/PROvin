import { describe, expect, it } from "vitest";
import {
  adminRichHtmlToPdfSafeHtml,
  aiExpertSourceCommentToRichHtml,
  aiPlainTextToRichHtml,
  normalizeAiClientPlainText,
  normalizeAiExpertParagraphText,
  normalizeEditorRichHtmlForStorage,
  normalizePastedAdminRichHtml,
  promoteInlineStyleSemantics,
} from "@/lib/admin-rich-comment-html";

describe("normalizeAiClientPlainText", () => {
  it("converts asterisk bullets to hyphens", () => {
    expect(normalizeAiClientPlainText("* Pirmais\n* Otrais")).toBe("- Pirmais\n- Otrais");
  });

  it("strips markdown bold markers", () => {
    expect(normalizeAiClientPlainText("**Bīstams** risks")).toBe("Bīstams risks");
  });
});

describe("adminRichHtmlToPdfSafeHtml", () => {
  it("preserves bold, italic, underline", () => {
    const html = "<p><strong>Trekns</strong> <em>kursīvs</em> <u>pasv.</u></p>";
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).toContain("<strong>Trekns</strong>");
    expect(out).toContain("<em>kursīvs</em>");
    expect(out).toContain("<u>pasv.</u>");
  });

  it("preserves span color and font-size", () => {
    const html = '<span style="color:#ef4444;font-size:14px">Sarkans</span>';
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).toContain('style="color:#ef4444;font-size:14px"');
    expect(out).toContain("Sarkans");
  });

  it("does not double-space contentEditable div lines with trailing br", () => {
    const html =
      "<div><strong>11.2023</strong><br></div><div>Eļļas un eļļas filtru maiņa;<br></div><div>Ford Eļļas apkope (IOLM).<br></div>";
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).not.toContain("<br /><br />");
    expect(out).toBe(
      "<strong>11.2023</strong><br />Eļļas un eļļas filtru maiņa;<br />Ford Eļļas apkope (IOLM).",
    );
  });

  it("does not double-space paragraph blocks", () => {
    const html = "<p><strong>11.2023</strong></p><p>Eļļas un eļļas filtru maiņa;</p>";
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).not.toContain("<br /><br />");
    expect(out).toBe("<strong>11.2023</strong><br />Eļļas un eļļas filtru maiņa;");
  });

  it("preserves intentional blank line from empty contentEditable block", () => {
    const html = "<div>Pirma rinda</div><div><br></div><div>Otra rinda</div>";
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).toBe("Pirma rinda<br /><br />Otra rinda");
  });

  it("preserves bold from pasted span font-weight styles", () => {
    const html =
      '<span style="font-family:Calibri;font-size:11pt;font-weight:bold">11.2023</span>';
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).toContain("<strong>11.2023</strong>");
  });

  /** execCommand("foreColor") vecākos pārlūkos dod <font color> — krāsa iepriekš pazuda PDF. */
  it("keeps colour from legacy font color tags", () => {
    const out = adminRichHtmlToPdfSafeHtml('<font color="#ef4444">Sarkans</font> teksts');
    expect(out).toContain('<span style="color:#ef4444">Sarkans</span>');
    expect(out).toContain("teksts");
  });

  it("keeps colour from font tags that also carry a face attribute", () => {
    const out = adminRichHtmlToPdfSafeHtml('<font color="#22c55e" face="Arial">Zaļš</font>');
    expect(out).toContain("color:#22c55e");
    expect(out).toContain("font-family:Arial");
  });

  it("preserves highlight background colour", () => {
    const out = adminRichHtmlToPdfSafeHtml('<span style="background-color:#fde68a">Izcelts</span>');
    expect(out).toBe('<span style="background-color:#fde68a">Izcelts</span>');
  });

  it("converts mark tags into highlight spans", () => {
    const out = adminRichHtmlToPdfSafeHtml("<mark>Izcelts</mark>");
    expect(out).toContain("background-color:#fde68a");
    expect(out).toContain("Izcelts");
  });

  it("preserves strikethrough", () => {
    expect(adminRichHtmlToPdfSafeHtml("<s>Nav aktuāli</s>")).toBe("<s>Nav aktuāli</s>");
    expect(adminRichHtmlToPdfSafeHtml("<del>Svītrots</del>")).toBe("<s>Svītrots</s>");
    expect(
      adminRichHtmlToPdfSafeHtml('<span style="text-decoration:line-through">Svītrots</span>'),
    ).toBe("<s>Svītrots</s>");
  });

  it("never emits a closing tag without its opening tag", () => {
    const out = adminRichHtmlToPdfSafeHtml("<span>plain</span></span>Teksts");
    expect(out).not.toContain("</span>");
    expect(out).toContain("Teksts");
  });

  it("repairs overlapping inline tags", () => {
    const out = adminRichHtmlToPdfSafeHtml("<strong>trekns <em>abi</strong> kursivs</em>");
    expect(out).toBe("<strong>trekns <em>abi</em></strong><em> kursivs</em>");
  });

  it("drops unknown tags but keeps their text", () => {
    const out = adminRichHtmlToPdfSafeHtml('<a href="https://x.lv"><strong>Saite</strong></a>');
    expect(out).toBe("<strong>Saite</strong>");
  });

  /** Tieši tāds HTML nāk no Chrome ar styleWithCSS — atstarpes un rgb() ir jāpieņem. */
  it("preserves Chrome styleWithCSS output for colour and highlight", () => {
    const colored = adminRichHtmlToPdfSafeHtml(
      '<span style="color: rgb(239, 68, 68);">Sarkans</span>',
    );
    expect(colored).toBe('<span style="color:rgb(239, 68, 68)">Sarkans</span>');

    const highlighted = adminRichHtmlToPdfSafeHtml(
      '<span style="background-color: rgb(253, 230, 138);">Izcelts</span>',
    );
    expect(highlighted).toBe('<span style="background-color:rgb(253, 230, 138)">Izcelts</span>');
  });

  it("keeps colour and highlight combined on one span", () => {
    const out = adminRichHtmlToPdfSafeHtml(
      '<span style="color:#ef4444;background-color:#fde68a">Kritiski</span>',
    );
    expect(out).toContain("color:#ef4444");
    expect(out).toContain("background-color:#fde68a");
  });

  it("keeps colour on text that is also bold", () => {
    const out = adminRichHtmlToPdfSafeHtml(
      '<strong><span style="color:#ef4444">Bīstami</span></strong>',
    );
    expect(out).toBe('<strong><span style="color:#ef4444">Bīstami</span></strong>');
  });

  it("rejects unsafe colour values", () => {
    const out = adminRichHtmlToPdfSafeHtml(
      '<span style="color:url(javascript:alert(1));background-color:expression(x)">Teksts</span>',
    );
    expect(out).toBe("Teksts");
  });
});

describe("normalizeEditorRichHtmlForStorage", () => {
  it("rewrites font colour tags into spans so storage matches the PDF pipeline", () => {
    const out = normalizeEditorRichHtmlForStorage('<font color="#ef4444">Sarkans</font>');
    expect(out).toBe('<span style="color:#ef4444">Sarkans</span>');
  });

  it("rewrites mark into a highlight span", () => {
    expect(normalizeEditorRichHtmlForStorage("<mark>Izcelts</mark>")).toBe(
      '<span style="background-color:#fde68a">Izcelts</span>',
    );
  });

  it("drops styleless spans that browsers leave behind", () => {
    expect(normalizeEditorRichHtmlForStorage("<span>Teksts</span>")).toBe("Teksts");
  });

  it("keeps semantic formatting untouched", () => {
    const html = "<strong>Trekns</strong><br /><em>Kursīvs</em>";
    expect(normalizeEditorRichHtmlForStorage(html)).toBe(html);
  });
});

describe("normalizePastedAdminRichHtml", () => {
  it("strips pasted font family and size but keeps bold", () => {
    const pasted =
      '<p class="MsoNormal"><span style="font-size:14pt;font-family:Arial;font-weight:bold">11.2023</span><span style="font-size:14pt;font-family:Arial"> teksts</span></p>';
    const out = normalizePastedAdminRichHtml(pasted);
    expect(out).not.toContain("font-family");
    expect(out).not.toContain("font-size");
    expect(out).not.toContain("MsoNormal");
    expect(out).toContain("<strong>11.2023</strong>");
  });

  it("keeps allowed text color from paste", () => {
    const pasted = '<span style="color:#ef4444;font-size:16px;font-family:Georgia">Sarkans</span>';
    const out = normalizePastedAdminRichHtml(pasted);
    expect(out).toContain('style="color:#ef4444"');
    expect(out).not.toContain("font-family");
    expect(out).not.toContain("font-size");
  });
});

describe("promoteInlineStyleSemantics", () => {
  it("promotes italic and underline spans", () => {
    const html = '<span style="font-style:italic;text-decoration:underline">Teksts</span>';
    expect(promoteInlineStyleSemantics(html)).toBe("<em><u>Teksts</u></em>");
  });
});

describe("aiPlainTextToRichHtml", () => {
  it("normalizes then wraps lines", () => {
    expect(aiPlainTextToRichHtml("* Punkts")).toBe("- Punkts");
  });
});

describe("normalizeAiExpertParagraphText", () => {
  it("strips leading hyphen bullets", () => {
    expect(normalizeAiExpertParagraphText("- Pirmais punkts. Turpinājums.\n- Otrais punkts. Teksts.")).toContain(
      "**Pirmais punkts.**",
    );
    expect(normalizeAiExpertParagraphText("- Pirmais punkts. Turpinājums.")).not.toMatch(/^- /m);
  });

  it("converts ANOMĀLIJA prefix to bold hook", () => {
    expect(normalizeAiExpertParagraphText("ANOMĀLIJA: nobraukums")).toContain("**Anomālija:**");
  });

  it("auto-bolds first sentence when markdown hooks are missing", () => {
    const out = normalizeAiExpertParagraphText(
      "Virsbūves pārbaude ar krāsas mērītāju. Automašīnai jāveic mērījumi uz šuvēm.",
    );
    expect(out).toMatch(/^\*\*Virsbūves pārbaude ar krāsas mērītāju\.\*\*/);
    expect(out).toContain("Automašīnai jāveic");
  });
});

describe("aiExpertSourceCommentToRichHtml", () => {
  it("preserves bold and strips list prefixes at line start", () => {
    const html = aiExpertSourceCommentToRichHtml("**Nobraukums.**\n\n- Fakts bez saraksta.");
    expect(html).toContain("<strong>Nobraukums.</strong>");
    expect(html).not.toMatch(/<br \/>- Fakts/);
    expect(html).toContain("Fakts bez saraksta.");
  });

  it("formats inspection-style hyphen lists into bold openers", () => {
    const html = aiExpertSourceCommentToRichHtml(
      "- Virsbūves pārbaude ar krāsas mērītāju. Jāmēra šuves.\n- Neatkarīga diagnostika servisā. Jāpārbauda kļūdu kodi.",
    );
    expect(html).toContain("<strong>Virsbūves pārbaude ar krāsas mērītāju.</strong>");
    expect(html).toContain("<strong>Neatkarīga diagnostika servisā.</strong>");
    expect(html).not.toContain("- Virsbūves");
  });
});
