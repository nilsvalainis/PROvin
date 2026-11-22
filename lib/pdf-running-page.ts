/**
 * A4 drukas malas, galvene un kājene (Chrome „Saglabāt kā PDF” / window.print).
 * Lapas numurs tikai labajā pusē; vidū nekā.
 */

export type PdfRunningLang = "lv" | "en" | "ru" | "de";

/**
 * Teksts CSS `content:"..."` virknei. Burti, cipari un vienkāršas pieturzīmes paliek,
 * viss pārējais (pēdiņas, slīpsvītras, `<`, `>`, `&`, `;`, iekavas u.c.) tiek pierakstīts kā `\HEX `,
 * rindu pārtraukumi un kontroles zīmes - aizstāti ar atstarpi. Rezultāts nevar izbeigt
 * ne virkni, ne deklarāciju, ne apkārtējo `<style>` bloku.
 */
export function cssContentString(value: string): string {
  let out = "";
  const cleaned = String(value ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ");
  for (const ch of Array.from(cleaned)) {
    if (/[\p{L}\p{N} .,\-·:()+_#!?%]/u.test(ch)) out += ch;
    else out += `\\${ch.codePointAt(0)!.toString(16)} `;
  }
  return out;
}

export function pdfRunningPageCounterLabel(lang: PdfRunningLang = "lv"): string {
  switch (lang) {
    case "en":
      return "Page ";
    case "ru":
      return "Страница ";
    case "de":
      return "Seite ";
    default:
      return "Lapa ";
  }
}

export function pdfPreparedForPrefix(lang: PdfRunningLang = "lv"): string {
  switch (lang) {
    case "en":
      return "Prepared for: ";
    case "ru":
      return "Подготовлено для: ";
    case "de":
      return "Erstellt für: ";
    default:
      return "Sagatavots klientam: ";
  }
}

export function buildPdfRunningHeaderLine(
  makeModel: string,
  vin: string,
  brand = "PROVIN.LV",
): string {
  const auto = makeModel.replace(/\s+/g, " ").trim();
  const code = vin.replace(/\s+/g, "").trim().toUpperCase();
  const parts = [brand.trim() || "PROVIN.LV"];
  if (auto) parts.push(auto);
  if (code) parts.push(`VIN ${code}`);
  return parts.join(" · ");
}

export function buildPdfRunningFooterLine(opts: {
  vin: string;
  dateLabel: string;
  preparedBy: string;
  lang?: PdfRunningLang;
}): string {
  const vin = opts.vin.replace(/\s+/g, "").trim().toUpperCase();
  const date = opts.dateLabel.replace(/\s+/g, " ").trim();
  const prepared = opts.preparedBy.replace(/\s+/g, " ").trim();
  const parts: string[] = [];
  if (vin) parts.push(vin);
  if (date) parts.push(date);
  if (prepared) parts.push(`${pdfPreparedForPrefix(opts.lang ?? "lv")}${prepared}`);
  return parts.join(" · ");
}

export function clientReportRunningPageCss(opts?: {
  header?: string;
  footer?: string;
  lang?: PdfRunningLang;
}): string {
  const header = cssContentString((opts?.header ?? "PROVIN.LV").trim() || "PROVIN.LV");
  const footer = cssContentString((opts?.footer ?? "").trim());
  const pageLabel = cssContentString(pdfRunningPageCounterLabel(opts?.lang ?? "lv"));
  const footerRule = footer
    ? `content:"${footer}";font:500 7pt Inter,sans-serif;color:#64748b;vertical-align:top;padding-top:5mm;`
    : "content:none;";
  return `
      @page{
        size:A4;
        margin:16mm 12mm 18mm 12mm;
        @top-left{
          content:"${header}";
          font:800 8pt Inter,sans-serif;color:#0f172a;vertical-align:bottom;padding-bottom:3.5mm;
        }
        @top-right{content:none;}
        @bottom-left{${footerRule}}
        @bottom-center{content:none;}
        @bottom-right{
          content:"${pageLabel}" counter(page) " / " counter(pages);
          font:600 7.5pt Inter,sans-serif;color:#334155;vertical-align:top;padding-top:5mm;
        }
      }
      @page:first{
        @top-left{content:none;}
        @top-right{content:none;}
      }
  `;
}
