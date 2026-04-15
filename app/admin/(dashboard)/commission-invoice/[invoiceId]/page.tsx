import { notFound } from "next/navigation";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { PkdCommissionInvoiceTool } from "@/components/admin/PkdCommissionInvoiceTool";
import { fallbackPkdCommissionInvoiceDraft, getPkdCommissionInvoiceDraft } from "@/lib/pkd-commission-invoice-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ invoiceId: string }> };

export default async function CommissionInvoiceDetailPage({ params }: Props) {
  const { invoiceId } = await params;
  const draft = (await getPkdCommissionInvoiceDraft(invoiceId)) ?? fallbackPkdCommissionInvoiceDraft(invoiceId);
  if (!draft) notFound();

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          PKD / AutoDNA
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Rēķins {draft.invoiceNumber}
        </h1>
      </AdminDashboardHeaderWithMenu>
      <PkdCommissionInvoiceTool
        invoiceId={draft.id}
        initialData={{
          invoiceNumber: draft.invoiceNumber,
          invoiceDate: draft.invoiceDate,
          paymentDue: draft.paymentDue,
          serviceDescription: draft.serviceDescription,
          amountEur: draft.amountEur,
          supplierName: draft.supplierName,
          supplierReg: draft.supplierReg,
          supplierAddress: draft.supplierAddress,
          supplierBank: draft.supplierBank,
          supplierSwift: draft.supplierSwift,
          supplierBankAccount: draft.supplierBankAccount,
          supplierEmail: draft.supplierEmail,
          supplierPhone: draft.supplierPhone,
          recipientCompany: draft.recipientCompany,
          recipientReg: draft.recipientReg,
          recipientAddress: draft.recipientAddress,
        }}
      />
    </div>
  );
}
