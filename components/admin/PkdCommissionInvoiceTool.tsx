"use client";

import { useCallback, useState } from "react";

const DEFAULT_SUPPLIER = {
  name: "Nils Valainis",
  reg: "09118711109",
  address: "Jāņa iela 3-4, Tukums, LV3101",
  bank: "A/S Industra Bank",
  swift: "MULTLV2X",
  bankAccount: "LV87MULT1010B96770010",
  email: "info@provin.lv",
  phone: "+37126123193",
};

const DEFAULT_RECIPIENT = {
  company: "AUTODNA Sp. z o.o.",
  reg: "5492391545",
  address: "Obywatelska 128/152, 94-104 Łódź, Polija",
};

const DEFAULT_SERVICE =
  "Komisijas pakalpojumi par februārī sniegtajiem pakalpojumiem.\nAfilio numurs: 0220725002.\nKonts: info@provin.lv";

export type PkdCommissionInvoiceFormData = {
  invoiceNumber: string;
  invoiceDate: string;
  paymentDue: string;
  serviceDescription: string;
  amountEur: string;
  supplierName: string;
  supplierReg: string;
  supplierAddress: string;
  supplierBank: string;
  supplierSwift: string;
  supplierBankAccount: string;
  supplierEmail: string;
  supplierPhone: string;
  recipientCompany: string;
  recipientReg: string;
  recipientAddress: string;
};

const DEFAULT_FORM: PkdCommissionInvoiceFormData = {
  invoiceNumber: "PKD-2026-003",
  invoiceDate: "15.04.2026.",
  paymentDue: "14 dienas no rēķina datuma",
  serviceDescription: DEFAULT_SERVICE,
  amountEur: "96.09",
  supplierName: DEFAULT_SUPPLIER.name,
  supplierReg: DEFAULT_SUPPLIER.reg,
  supplierAddress: DEFAULT_SUPPLIER.address,
  supplierBank: DEFAULT_SUPPLIER.bank,
  supplierSwift: DEFAULT_SUPPLIER.swift,
  supplierBankAccount: DEFAULT_SUPPLIER.bankAccount,
  supplierEmail: DEFAULT_SUPPLIER.email,
  supplierPhone: DEFAULT_SUPPLIER.phone,
  recipientCompany: DEFAULT_RECIPIENT.company,
  recipientReg: DEFAULT_RECIPIENT.reg,
  recipientAddress: DEFAULT_RECIPIENT.address,
};

type Props = {
  invoiceId?: string;
  initialData?: PkdCommissionInvoiceFormData;
};

export function PkdCommissionInvoiceTool({ invoiceId, initialData }: Props) {
  const initial = initialData ?? DEFAULT_FORM;
  const [invoiceNumber, setInvoiceNumber] = useState(initial.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(initial.invoiceDate);
  const [paymentDue, setPaymentDue] = useState(initial.paymentDue);
  const [serviceDescription, setServiceDescription] = useState(initial.serviceDescription);
  const [amountEur, setAmountEur] = useState(initial.amountEur);
  const [supplierName, setSupplierName] = useState(initial.supplierName);
  const [supplierReg, setSupplierReg] = useState(initial.supplierReg);
  const [supplierAddress, setSupplierAddress] = useState(initial.supplierAddress);
  const [supplierBank, setSupplierBank] = useState(initial.supplierBank);
  const [supplierSwift, setSupplierSwift] = useState(initial.supplierSwift);
  const [supplierBankAccount, setSupplierBankAccount] = useState(initial.supplierBankAccount);
  const [supplierEmail, setSupplierEmail] = useState(initial.supplierEmail);
  const [supplierPhone, setSupplierPhone] = useState(initial.supplierPhone);
  const [recipientCompany, setRecipientCompany] = useState(initial.recipientCompany);
  const [recipientReg, setRecipientReg] = useState(initial.recipientReg);
  const [recipientAddress, setRecipientAddress] = useState(initial.recipientAddress);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const payload = {
    invoiceNumber,
    invoiceDate,
    paymentDue,
    serviceDescription,
    amountEur,
    supplierName,
    supplierReg,
    supplierAddress,
    supplierBank,
    supplierSwift,
    supplierBankAccount,
    supplierEmail,
    supplierPhone,
    recipientCompany,
    recipientReg,
    recipientAddress,
  } satisfies PkdCommissionInvoiceFormData;

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!invoiceId) return true;
    setErr(null);
    setOkMsg(null);
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/pkd-commission-invoice/${encodeURIComponent(invoiceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(typeof j.error === "string" ? j.error : `Kļūda ${r.status}`);
        return false;
      }
      setOkMsg("Rēķins saglabāts.");
      return true;
    } catch {
      setErr("Neizdevās saglabāt rēķinu.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [invoiceId, payload]);

  const openPdf = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const saved = await saveDraft();
      if (!saved) return;
      const r = await fetch("/api/admin/pkd-commission-invoice/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(typeof j.error === "string" ? j.error : `Kļūda ${r.status}`);
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setErr("Neizdevās ģenerēt PDF.");
    } finally {
      setBusy(false);
    }
  }, [
    payload,
    saveDraft,
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-[var(--color-apple-text)]">
        PKD komisijas rēķins
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-provin-muted)]">
        Rēķins bez PROVIN zīmola — visi lauki ir brīvi labojami, ieskaitot piegādātāja un saņēmēja rekvizītus.
        Noklusējumi ielikti pēc tava parauga.
      </p>

      <div className="mt-8 space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-[var(--color-apple-text)]">Rēķina numurs</span>
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[var(--color-apple-text)]">Summa (EUR)</span>
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
              value={amountEur}
              onChange={(e) => setAmountEur(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[var(--color-apple-text)]">Rēķina datums</span>
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[var(--color-apple-text)]">Apmaksas termiņš</span>
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
              value={paymentDue}
              onChange={(e) => setPaymentDue(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-[var(--color-apple-text)]">Pakalpojuma apraksts</span>
          <textarea
            className="mt-1.5 min-h-[7rem] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
            value={serviceDescription}
            onChange={(e) => setServiceDescription(e.target.value)}
            rows={5}
          />
        </label>

        <div className="border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
            Piegādātājs
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-apple-text)]">Vārds, uzvārds</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-apple-text)]">Reģ. Nr.</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={supplierReg}
                onChange={(e) => setSupplierReg(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-[var(--color-apple-text)]">Adrese</span>
              <textarea
                className="mt-1.5 min-h-[4rem] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={supplierAddress}
                onChange={(e) => setSupplierAddress(e.target.value)}
                rows={3}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-apple-text)]">Banka</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={supplierBank}
                onChange={(e) => setSupplierBank(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-apple-text)]">SWIFT</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={supplierSwift}
                onChange={(e) => setSupplierSwift(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-[var(--color-apple-text)]">Bankas konts</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={supplierBankAccount}
                onChange={(e) => setSupplierBankAccount(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-apple-text)]">E-pasts</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-apple-text)]">Tālrunis</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
            Saņēmējs
          </p>
          <div className="mt-3 grid gap-4">
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-apple-text)]">Nosaukums</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={recipientCompany}
                onChange={(e) => setRecipientCompany(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-apple-text)]">Reģistrācijas Nr.</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={recipientReg}
                onChange={(e) => setRecipientReg(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-apple-text)]">Adrese</span>
              <textarea
                className="mt-1.5 min-h-[4rem] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--color-provin-accent)]/25 focus:ring-2"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                rows={3}
              />
            </label>
          </div>
        </div>

        {okMsg ? <p className="text-sm text-emerald-700">{okMsg}</p> : null}
        {err ? <p className="text-sm text-red-600">{err}</p> : null}

        <div className="flex flex-wrap gap-3">
          {invoiceId ? (
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving || busy}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-[var(--color-apple-text)] shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? "Saglabā…" : "Saglabāt izmaiņas"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={openPdf}
            disabled={busy || saving}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-provin-accent)] px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            {busy ? "Ģenerē…" : "Atvērt PDF pārlūkā"}
          </button>
        </div>
      </div>
    </div>
  );
}
