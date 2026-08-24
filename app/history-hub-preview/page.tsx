import { HISTORY_HUB_VARIANTS, historyHubPreviewCss } from "@/lib/history-hub-layout-preview";

export const metadata = {
  title: "PROVIN — vēstures kopsavilkums",
  robots: { index: false, follow: false },
};

export default function HistoryHubPreviewPage() {
  return (
    <main className="min-h-dvh bg-[#EEF1F5] px-5 py-10 text-slate-900 sm:px-8">
      <style dangerouslySetInnerHTML={{ __html: historyHubPreviewCss() }} />
      <div className="mx-auto max-w-[820px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">PROVIN · iekšējs</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Vēstures kopsavilkums — kartītes</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          Trīs veidi, kā kopsavilkumu uzcelt par galveno sadaļu. Negadījums paliek kartīte, ko var dublēt. Dati ir
          Q7-stila izgriezums: imports, TA, LTAB/CarVertical negadījums, īpašnieki, apkope.
        </p>
        <div className="mt-10 space-y-14">
          {HISTORY_HUB_VARIANTS.map((v) => (
            <section key={v.id}>
              <h2 className="text-[13px] font-semibold tracking-tight text-slate-800">{v.title}</h2>
              <p className="mb-3 mt-1 text-[13px] leading-snug text-slate-500">{v.note}</p>
              <div className="provin-report-doc" dangerouslySetInnerHTML={{ __html: v.html() }} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
