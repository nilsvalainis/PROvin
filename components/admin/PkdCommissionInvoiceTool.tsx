"use client";

import { useCallback, useState } from "react";

const DEFAULT_SUPPLIER = {
  name: "Nils Valainis",
  reg: "09118711109",
  address: "Jāņa iela 3-4, Tukums, LV3101",
  bank: "A/S Industra Bank",
  swift: "MULTLV2X",
  bankAccount: "LV87MULT1010B96770010",
  email: "nils.valainis@gmail.com",
  phone: "+37126123193",
};

const DEFAULT_RECIPIENT = {
  company: "AUTODNA Sp. z o.o.",
  reg: "5492391545",
  address: "Obywatelska 128/152, 94-104 Łódź, Polija",
};

const DEFAULT_SERVICE =
  "Komisijas pakalpojumi par februārī sniegtajiem pakalpojumiem.\nAfilio numurs: 0220725002.\nKonts: nils.valainis@gmail.com";

export function PkdCommissionInvoiceTool() {
  const [invoiceNumber, setInvoiceNumber] = useState("PKD-2026-003");
  const [invoiceDate, setInvoiceDate] = useState("15.04.2026.");
  const [paymentDue, setPaymentDue] = useState("14 dienas no rēķina datuma");
  const [serviceDescription, setServiceDescription] = useState(DEFAULT_SERVICE);
  const [amountEur, setAmountEur] = useState("96.09");
  const [supplierName, setSupplierName] = useState(DEFAULT_SUPPLIER.name);
  const [supplierReg, setSupplierReg] = useState(DEFAULT_SUPPLIER.reg);
  const [supplierAddress, setSupplierAddress] = useState(DEFAULT_SUPPLIER.address);
  const [supplierBank, setSupplierBank] = useState(DEFAULT_SUPPLIER.bank);
  const [supplierSwift, setSupplierSwift] = useState(DEFAULT_SUPPLIER.swift);
  const [supplierBankAccount, setSupplierBankAccount] = useState(DEFAULT_SUPPLIER.bankAccount);
  const [supplierEmail, setSupplierEmail] = useState(DEFAULT_SUPPLIER.email);
  const [supplierPhone, setSupplierPhone] = useState(DEFAULT_SUPPLIER.phone);
  const [recipientCompany, setRecipientCompany] = useState(DEFAULT_RECIPIENT.company);
  const [recipientReg, setRecipientReg] = useState(DEFAULT_RECIPIENT.reg);
  const [recipientAddress, setRecipientAddress] = useState(DEFAULT_RECIPIENT.address);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openPdf = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/pkd-commission-invoice/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
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
    amountEur,
    invoiceDate,
    invoiceNumber,
    paymentDue,
    supplierAddress,
    supplierBank,
    supplierBankAccount,
    supplierEmail,
    supplierName,
    supplierPhone,
    supplierReg,
    supplierSwift,
    recipientAddress,
    recipientCompany,
    recipientReg,
    serviceDescription,
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-[var(--color-apple-text)]">
        PKD komisijas rēķins (PDF)
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

        {err ? <p className="text-sm text-red-600">{err}</p> : null}

        <button
          type="button"
          onClick={openPdf}
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-provin-accent)] px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {busy ? "Ģenerē…" : "Atvērt PDF pārlūkā"}
        </button>
      </div>
    </div>
  );
}
