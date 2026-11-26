import { clientLinkCopy } from "@/lib/client-link-i18n";

/** Nederīga / beigusies saite. Valoda - saites valoda, ja ieraksts zināms; citādi LV. */
export function ClientLinkNeutralPage({ lang }: { lang?: string | null } = {}) {
  const c = clientLinkCopy(lang);
  return (
    <main lang={lang ?? "lv"} className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16 text-center">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-[#1d1d1f]">PROVIN</p>
      <h1 className="mt-6 text-[26px] font-semibold tracking-tight text-[#1d1d1f]">{c.invalidTitle}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">{c.invalidBody}</p>
    </main>
  );
}
