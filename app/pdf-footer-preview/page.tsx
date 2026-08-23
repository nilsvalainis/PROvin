import { buildPdfDocFooterHtml, pdfDocFooterCss } from "@/lib/client-report-pdf-footer";

export const metadata = {
  title: "PROVIN — PDF kājenes priekšskatījums",
  robots: { index: false, follow: false },
};

function sheetFooter(amountTotalCents: number, label: string) {
  const generated = new Intl.DateTimeFormat("lv-LV", {
    dateStyle: "long",
  }).format(new Date());
  return {
    label,
    html: buildPdfDocFooterHtml({
      vin: "WVWZZZ1JZXW000001",
      amountTotalCents,
      generatedLabel: `Ģenerēts ${generated}`,
    }),
  };
}

export default function PdfFooterPreviewPage() {
  const audits = sheetFooter(9999, "PROVIN AUDITS");
  const mini = sheetFooter(3999, "PROVIN MINI");

  return (
    <main className="min-h-dvh bg-[#E4E9F0] px-4 py-10 text-slate-900 sm:px-8">
      <style dangerouslySetInnerHTML={{ __html: pdfDocFooterCss() }} />
      <div className="mx-auto max-w-[920px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0061D2]">
          PROVIN · iekšējs
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">PDF kājene</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          Tāds pats HTML un CSS kā klienta auditā. Logo ir, juridiskie rekvizīti nav.
        </p>

        {[audits, mini].map((sheet) => (
          <section key={sheet.label} className="mt-10">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {sheet.label}
            </h2>
            <article
              className="provin-report-doc mx-auto overflow-hidden rounded-[2px] bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)]"
              style={{ width: "min(100%, 190mm)", padding: "16mm 14mm 12mm", fontFamily: "Inter, sans-serif" }}
            >
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                2. Kopsavilkums
              </p>
              <p className="mt-3 mb-0 text-[11.5px] leading-relaxed text-slate-400">
                Ņemot vērā apzinātu odometra neatbilstību un slēptu komerciālo pagātni, pircējam
                jāvērtē auto pēc reālā, ne sludinājumā redzamā nobraukuma. Šī rinda ir tikai
                priekšskatījuma fons — lai redzētu, kā kājene sēž zem pēdējās sadaļas.
              </p>
              <div dangerouslySetInnerHTML={{ __html: sheet.html }} />
            </article>
          </section>
        ))}
      </div>
    </main>
  );
}
