import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getPkdCommissionInvoiceDraft,
  isSafePkdInvoiceId,
  updatePkdCommissionInvoiceDraft,
} from "@/lib/pkd-commission-invoice-store";
import type { PkdCommissionInvoiceInput } from "@/lib/pkd-commission-invoice-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX = 4000;
const MAX_SHORT = 120;

function clip(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max).replace(/[\u0000-\u001F]+/g, " ");
}

function parseBody(raw: unknown): PkdCommissionInvoiceInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const invoiceNumber = clip(o.invoiceNumber, MAX_SHORT);
  const invoiceDate = clip(o.invoiceDate, MAX_SHORT);
  const paymentDue = clip(o.paymentDue, MAX_SHORT);
  const serviceDescription = clip(o.serviceDescription, MAX);
  const amountEur = clip(o.amountEur, 32);
  const supplierName = clip(o.supplierName, MAX_SHORT);
  const supplierReg = clip(o.supplierReg, MAX_SHORT);
  const supplierAddress = clip(o.supplierAddress, 400);
  const supplierBank = clip(o.supplierBank, MAX_SHORT);
  const supplierSwift = clip(o.supplierSwift, MAX_SHORT);
  const supplierBankAccount = clip(o.supplierBankAccount, MAX_SHORT);
  const supplierEmail = clip(o.supplierEmail, MAX_SHORT);
  const supplierPhone = clip(o.supplierPhone, MAX_SHORT);
  const recipientCompany = clip(o.recipientCompany, MAX_SHORT);
  const recipientReg = clip(o.recipientReg, MAX_SHORT);
  const recipientAddress = clip(o.recipientAddress, 400);
  if (!invoiceNumber || !serviceDescription || !amountEur) return null;
  if (!supplierName || !supplierReg || !supplierAddress || !supplierBank || !supplierSwift) return null;
  if (!supplierBankAccount || !supplierEmail || !supplierPhone) return null;
  if (!recipientCompany || !recipientReg || !recipientAddress) return null;
  return {
    invoiceNumber,
    invoiceDate: invoiceDate || "—",
    paymentDue: paymentDue || "—",
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
  };
}

type Ctx = { params: Promise<{ invoiceId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { invoiceId } = await params;
  if (!isSafePkdInvoiceId(invoiceId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const draft = await getPkdCommissionInvoiceDraft(invoiceId);
  if (!draft) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(draft, { status: 200 });
}

export async function PUT(req: Request, { params }: Ctx) {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { invoiceId } = await params;
  if (!isSafePkdInvoiceId(invoiceId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const input = parseBody(body);
  if (!input) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const updated = await updatePkdCommissionInvoiceDraft(invoiceId, input);
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt }, { status: 200 });
}
