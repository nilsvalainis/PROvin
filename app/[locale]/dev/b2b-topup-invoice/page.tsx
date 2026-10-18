import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { B2bPartnerAccountShell } from "@/components/b2b/B2bPartnerAccountShell";
import { applyB2bWalletTopup, attachB2bWalletTopupInvoice, emptyB2bWallet, formatB2bWalletEuro } from "@/lib/b2b-wallet";
import { buildB2bTopupInvoiceHtml } from "@/lib/b2b-topup-invoice";
import { toInvoiceOrderPayload } from "@/lib/generate-invoice-html";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Lokāls PR ekrānuzņēmumu skats: IRISS top-up rēķins. Produkcijā 404. */
export default async function B2bTopupInvoiceDevPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const funded = applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 10000, sessionId: "cs_dev_topup" });
  const wallet = attachB2bWalletTopupInvoice(funded.wallet, {
    sessionId: "cs_dev_topup",
    invoiceNumber: "IRS-2026-0001",
  });
  const txn = wallet.txns[0];
  const html = buildB2bTopupInvoiceHtml(
    toInvoiceOrderPayload(
      {
        id: "cs_dev_topup",
        created: Math.floor(Date.now() / 1000),
        amountTotal: 10000,
        currency: "EUR",
        customerEmail: "salons@example.lv",
        customerDetailsEmail: "salons@example.lv",
        vin: null,
        customerName: "Jānis",
        companyName: "SIA Salons",
        companyReg: "40000000000",
        companyAddress: "Rīga",
      },
      "IRS-2026-0001",
      "b2b_topup",
    ),
  );
  return (
    <div className="min-h-screen bg-[#07080c] p-6 text-zinc-100">
      <B2bPartnerAccountShell>
        <section>
          <h1 className="text-[1.05rem] font-semibold tracking-[-0.02em]">Darījumu vēsture</h1>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-[0.8rem]">
              <thead>
                <tr>
                  <th className="pb-2 text-left text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">Datums</th>
                  <th className="pb-2 text-left text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">Darījums</th>
                  <th className="pb-2 text-left text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">Rēķins</th>
                  <th className="pb-2 text-right text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">Summa</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/[0.07]">
                  <td className="py-2.5 pr-3 text-zinc-400">18.10.2026</td>
                  <td className="py-2.5 pr-3 text-zinc-200">Papildinājums</td>
                  <td className="py-2.5 pr-3 font-medium text-[#F26522]">{txn?.invoiceNumber}</td>
                  <td className="py-2.5 text-right font-semibold text-emerald-300">
                    +{formatB2bWalletEuro(txn?.amountCents ?? 10000)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </B2bPartnerAccountShell>
      <div
        className="mx-auto mt-8 max-w-3xl rounded-xl bg-white p-4 text-zinc-900"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
