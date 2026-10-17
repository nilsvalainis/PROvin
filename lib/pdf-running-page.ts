/**
 * A4 drukas malas, galvene un kājene (Chrome „Saglabāt kā PDF” / window.print).
 * Lapas numurs tikai labajā pusē; vidū nekā.
 */

function cssContentString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildPdfRunningHeaderLine(makeModel: string, vin: string): string {
  const auto = makeModel.replace(/\s+/g, " ").trim();
  const code = vin.replace(/\s+/g, "").trim().toUpperCase();
  const parts = ["PROVIN.LV"];
  if (auto) parts.push(auto);
  if (code) parts.push(`VIN ${code}`);
  return parts.join(" · ");
}

export function buildPdfRunningFooterLine(opts: {
  vin: string;
  dateLabel: string;
  preparedBy: string;
}): string {
  const vin = opts.vin.replace(/\s+/g, "").trim().toUpperCase();
  const date = opts.dateLabel.replace(/\s+/g, " ").trim();
  const prepared = opts.preparedBy.replace(/\s+/g, " ").trim();
  const parts: string[] = [];
  if (vin) parts.push(vin);
  if (date) parts.push(date);
  if (prepared) parts.push(`Sagatavots klientam: ${prepared}`);
  return parts.join(" · ");
}

export function clientReportRunningPageCss(opts?: { header?: string; footer?: string }): string {
  const header = cssContentString((opts?.header ?? "PROVIN.LV").trim() || "PROVIN.LV");
  const footer = cssContentString((opts?.footer ?? "").trim());
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
          content:"Lapa " counter(page) " / " counter(pages);
          font:600 7.5pt Inter,sans-serif;color:#334155;vertical-align:top;padding-top:5mm;
        }
      }
      @page:first{
        @top-left{content:none;}
        @top-right{content:none;}
      }
  `;
}
