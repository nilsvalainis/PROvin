/**
 * Obligāts paziņojums pēc pirmā reālā apmaksātā pasūtījuma, kamēr publiskajā lapā nav pilnu rekvizītu.
 */
export function PostPaymentLegalBanner() {
  return (
    <aside
      role="alert"
      className="rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-3.5 shadow-[0_2px_16px_rgba(127,29,29,0.06)] sm:px-5 sm:py-4"
    >
      <h2 className="text-sm font-semibold tracking-tight text-red-950">
        Obligāti pēc pirmā saņemtā maksājuma
      </h2>
      <p className="mt-1.5 text-sm leading-snug text-red-950/90">
        Stripe uzrāda vismaz vienu apmaksātu pasūtījumu, bet mājas lapā vēl nav pilnu distances līguma
        rekvizītu (tikai zīmols PROVIN.LV). Pirms mārketinga un reāliem Live maksājumiem izpildi
        soļus — tas samazina chargeback risku un sakrīt ar Stripe verifikācijas prasībām.
      </p>
      <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-sm leading-snug text-red-950/95">
        <li>
          <span className="font-medium text-red-950">Vercel (vai cits hosts)</span> — Environment
          Variables:{" "}
          <code className="rounded bg-red-100/80 px-1.5 py-0.5 text-xs font-mono text-red-900">
            NEXT_PUBLIC_COMPANY_LEGAL_NAME
          </code>
          ,{" "}
          <code className="rounded bg-red-100/80 px-1.5 py-0.5 text-xs font-mono text-red-900">
            NEXT_PUBLIC_COMPANY_REG_NO
          </code>
          ,{" "}
          <code className="rounded bg-red-100/80 px-1.5 py-0.5 text-xs font-mono text-red-900">
            NEXT_PUBLIC_COMPANY_LEGAL_ADDRESS
          </code>{" "}
          (saskan ar personu apliecinošu dokumentu / SDV).
        </li>
        <li>
          <span className="font-medium text-red-950">Redeploy</span> — pārliecinies, ka publiskajā
          lapā kājenē parādās pilnais bloks: juridiskais nosaukums, reģ. nr., adrese (ne tikai
          PROVIN.LV).
        </li>
        <li>
          <span className="font-medium text-red-950">Stripe Dashboard</span> — pabeidz konta /
          biznesa verifikāciju Live režīmā. Viņi salīdzinās mājas lapas URL ar redzamajiem
          rekvizītiem.
        </li>
      </ol>
      <p className="mt-2.5 border-t border-red-200/80 pt-2 text-[11px] leading-snug text-red-900/85">
        Ja klientam būs strīds par maksājumu, banka vērtēs, vai pirkuma brīdī pakalpojuma sniedzējs
        bija skaidri identificējams. Tikai zīmols bez personas datiem var tikt interpretēts par labu
        klientam.
      </p>
    </aside>
  );
}
