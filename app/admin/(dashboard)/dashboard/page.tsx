import Link from "next/link";
import { isDemoOrdersEnabled, listAdminOrders } from "@/lib/admin-orders";
import {
  countAdminOrdersHiddenByAmountFilter,
  filterAdminOrdersForDashboard,
} from "@/lib/admin-order-amount-filter";
import { serializeAdminOrderTableRows } from "@/lib/serialize-admin-order-table";
import { sortAdminOrdersIncompleteFirst } from "@/lib/admin-audit-deadline-complete";
import { countRepeatVins } from "@/lib/admin-repeat-vin";
import { previousOrdersByEmail } from "@/lib/admin-client-orders";
import { listListingPeeks } from "@/lib/listing-peek-store";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { getOrderFlags } from "@/lib/admin-orders-flags";
import { upsellListOverlay } from "@/lib/order-upsell";
import { AdminCreateManualOrderButton } from "@/components/admin/AdminCreateManualOrderButton";
import { AdminOrdersExportButton } from "@/components/admin/AdminOrdersExportButton";
import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";
import { AdminOrderVinScanDashboardCards } from "@/components/admin/AdminOrderVinScanDashboardCards";
import { pickOrderVinScanDashboardCards } from "@/lib/order-vin-scan";
import { getB2bPartnerByEmail, getB2bPartnerById } from "@/lib/b2b-partner-store";
import {
  isB2bPackAdminOrder,
  parsePartnerAuditPurposeFromNotes,
  parsePartnerCheckoutLineFromNotes,
  parsePartnerCompanyFromNotes,
  parsePartnerIdFromNotes,
} from "@/lib/b2b-partner-orders";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ show_all?: string }>;
}) {
  const sp = await searchParams;
  const showAll = sp.show_all === "1" || sp.show_all === "true";
  const { rows: allOrders, stripeError } = await listAdminOrders();
  const hiddenByAmount = countAdminOrdersHiddenByAmountFilter(allOrders);
  const orders = filterAdminOrdersForDashboard(allOrders, showAll);
  const orderIds = orders.map((o) => o.id);
  // „Izpildīts”, krāsa, upsell — no karodziņu indeksa (1 lasījums), nevis 3×N Blob failu.
  const [draftSummaries, { complete: auditCompleteMap, color: auditResultColorMap, upsell: upsellOffers }] = await Promise.all([
    readOrderDraftSummaries(orderIds),
    getOrderFlags(orderIds),
  ]);
  const partnerIds = new Set<string>();
  const packEmails = new Set<string>();
  for (const o of orders) {
    const fromNotes = parsePartnerIdFromNotes(draftSummaries.get(o.id)?.notes);
    if (fromNotes) partnerIds.add(fromNotes);
    if (o.partnerId) partnerIds.add(o.partnerId);
    const line = (o.checkoutLine ?? "").trim().toLowerCase();
    if (
      o.customerEmail?.trim() &&
      !o.isManual &&
      !(o.vin ?? "").trim() &&
      (isB2bPackAdminOrder(o) || line === "business" || line === "dealer")
    ) {
      packEmails.add(o.customerEmail.trim().toLowerCase());
    }
  }
  const partnerNames = new Map<string, string>();
  const partnerNamesByEmail = new Map<string, string>();
  await Promise.all([
    ...[...partnerIds].map(async (id) => {
      const p = await getB2bPartnerById(id);
      if (p?.companyName.trim()) partnerNames.set(id, p.companyName.trim());
    }),
    ...[...packEmails].map(async (email) => {
      const p = await getB2bPartnerByEmail(email);
      if (p?.companyName.trim()) partnerNamesByEmail.set(email, p.companyName.trim());
    }),
  ]);
  const ordersWithInvoice = orders.map((o) => {
    const draft = draftSummaries.get(o.id);
    const notes = draft?.notes ?? "";
    const emailKey = o.customerEmail?.trim().toLowerCase() ?? "";
    const isPack =
      isB2bPackAdminOrder(o) ||
      (!o.isManual &&
        !(o.vin ?? "").trim() &&
        (o.checkoutLine === "business" || o.checkoutLine === "dealer") &&
        Boolean(emailKey && partnerNamesByEmail.has(emailKey)));
    const partnerId = o.partnerId || parsePartnerIdFromNotes(notes);
    const partnerCompanyName =
      o.companyName?.trim() ||
      parsePartnerCompanyFromNotes(notes) ||
      (partnerId ? partnerNames.get(partnerId) ?? null : null) ||
      (o.customerEmail?.trim() ? partnerNamesByEmail.get(o.customerEmail.trim().toLowerCase()) ?? null : null);
    const partnerLine = parsePartnerCheckoutLineFromNotes(notes);
    const partnerAuditPurpose =
      parsePartnerAuditPurposeFromNotes(notes) ||
      (o.auditPurpose === "client" || o.auditPurpose === "internal" ? o.auditPurpose : null);
    return {
      ...o,
      vin: isPack ? null : draft?.vin || o.vin,
      customerEmail: draft?.customerEmail ? draft.customerEmail : o.customerEmail,
      customerName: draft?.customerName || o.companyName || null,
      customerPhone: draft?.customerPhone || null,
      invoicePdfUrl: draft?.invoicePdfUrl ?? null,
      makeModel: isPack ? null : draft?.makeModel || null,
      auditComplete: isPack ? true : Boolean(auditCompleteMap.get(o.id)),
      auditResultColor: isPack ? null : auditResultColorMap.get(o.id) ?? null,
      checkoutLine: partnerLine ?? o.checkoutLine,
      ...(isPack ? { isB2bPack: true as const } : {}),
      ...(partnerId ? { partnerId } : {}),
      ...(partnerCompanyName ? { partnerCompanyName } : {}),
      ...(partnerAuditPurpose && !isPack ? { partnerAuditPurpose } : {}),
      ...(notes && !isPack ? { notes } : {}),
    };
  });
  const ordersWithUpsell = ordersWithInvoice.map((o) => {
    const overlay = upsellListOverlay(upsellOffers.get(o.id) ?? []);
    if (!overlay) return o;
    return {
      ...o,
      amountTotal: overlay.targetCents,
      checkoutLine: overlay.targetLine,
      deadlineFromUnix: overlay.paidAtUnix,
      activityUnix: overlay.paidAtUnix,
      upsellBadge: overlay.badge,
    };
  });
  // „Atkārtots VIN”: marķieris rindā, ja šis VIN jau ir citā pasūtījumā vai ātrajā vērtējumā.
  const peeks = await listListingPeeks(500).catch(() => []);
  const repeatVin = countRepeatVins(
    ordersWithUpsell.filter((o) => !o.isB2bPack).map((o) => ({ id: o.id, vins: [o.vin] })),
    [
      ...allOrders
        .filter((o) => !o.isDemo && o.checkoutLine !== "provin_select")
        .map((o) => ({ id: o.id, vins: [o.vin, draftSummaries.get(o.id)?.vin] })),
      ...peeks.map((p) => ({ id: `qe:${p.id}`, vins: [p.vin] })),
    ],
  );
  // Klienta kartīte: „N×” — iepriekšējie pasūtījumi ar to pašu e-pastu.
  const clientOrders = previousOrdersByEmail(
    ordersWithUpsell.filter((o) => !o.isB2bPack),
    allOrders
      .filter((o) => !o.isDemo && o.checkoutLine !== "provin_select")
      .map((o) => ({
        id: o.id,
        created: o.created,
        customerEmail: draftSummaries.get(o.id)?.customerEmail || o.customerEmail,
        vin: draftSummaries.get(o.id)?.vin || o.vin,
        amountTotal: o.amountTotal,
        currency: o.currency,
      })),
  );
  const tableOrders = sortAdminOrdersIncompleteFirst(
    serializeAdminOrderTableRows(
      ordersWithUpsell.map((o) => ({ ...o, repeatVin: repeatVin.get(o.id) ?? 0, clientOrders: clientOrders.get(o.id) ?? [] })),
    ),
  );
  const demoPrefOn = isDemoOrdersEnabled();
  const onlyDemoShown = orders.length > 0 && orders.every((o) => o.isDemo);
  const hasStripeIssue = Boolean(stripeError);

  /** V1 rīkjosla: summas filtra slēdzis (aizstāj agrāko paziņojumu) + kompakts „＋ Jauns”. */
  const amountChip =
    hiddenByAmount > 0 || showAll ? (
      <Link
        href={showAll ? "/admin/dashboard" : "/admin/dashboard?show_all=1"}
        title={
          showAll
            ? `Rāda visus apmaksātos pasūtījumus (${allOrders.length}). Klikšķis: tikai virs 10 €.`
            : `Rāda tikai pasūtījumus virs 10 € (${orders.length} no ${allOrders.length}). Slēpti: ${hiddenByAmount}. Klikšķis: rādīt visus.`
        }
        aria-pressed={!showAll}
        className={`admin-nav-link inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-[12px] transition ${
          showAll ? "bg-[#e9e9ee] text-[#8e8e93]" : "bg-[#e9e9ee] font-semibold text-[#3a3a3c]"
        }`}
      >
        &gt;10 €
        <span className="hidden sm:inline">· {showAll ? `visi ${allOrders.length}` : `${orders.length}/${allOrders.length}`}</span>
        {showAll ? null : <span aria-hidden>✓</span>}
      </Link>
    ) : null;
  const toolbarEnd = (
    <>
      {amountChip}
      <AdminCreateManualOrderButton compact />
    </>
  );

  return (
    <div className="w-full max-w-none">
      <Link
        href="/admin/kopsavilkums"
        className="mb-3 flex min-h-12 items-center justify-between rounded-2xl border border-[#e5e5ea] bg-white px-4 text-[15px] font-semibold text-[var(--color-apple-text)] shadow-sm md:hidden"
      >
        Rīta kopsavilkums
        <span className="text-[13px] font-medium text-[var(--color-provin-accent)]">Atvērt</span>
      </Link>
      {hasStripeIssue && orders.length > 0 ? (
        <div
          className={`mt-3 rounded-2xl border px-4 py-3.5 text-sm shadow-sm ${
            onlyDemoShown
              ? "border-[var(--color-provin-accent)]/20 bg-[var(--color-provin-accent-soft)]/60 text-[var(--color-apple-text)]"
              : "border-amber-200/90 bg-amber-50/90 text-amber-950"
          }`}
        >
          <p className="font-semibold tracking-tight">
            {onlyDemoShown ? "Tikai parauga dati" : "Papildu avots (Stripe) nav pieejams"}
          </p>
          <p className={`mt-1.5 leading-relaxed ${onlyDemoShown ? "text-[var(--color-provin-muted)]" : "text-amber-900/90"}`}>
            {onlyDemoShown
              ? "Īstu maksājumu sarakstu varēsi ielādēt vēlāk, kad serverī būs iestatīts STRIPE_SECRET_KEY. Kamēr turpini dizaina un darba plūsmas uzlabošanu ar demo ierakstiem."
              : stripeError}
          </p>
          {!onlyDemoShown && stripeError ? (
            <p className="mt-2 text-amber-900/85">Zemāk redzami arī parauga pasūtījumi (ja ieslēgti).</p>
          ) : null}
        </div>
      ) : null}

      {hasStripeIssue && orders.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-3.5 text-sm text-red-950 shadow-sm">
          {stripeError}
        </div>
      ) : null}

      {!hasStripeIssue && orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Nav rindu</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Kad būs apmaksāti pasūtījumi, tie parādīsies šeit.
          </p>
          {!demoPrefOn ? (
            <p className="mt-4 text-sm text-[var(--color-provin-muted)]">
              Lai redzētu paraugus, noņem{" "}
              <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs">ADMIN_DEMO_ORDERS=0</code> vai
              neiestati šo mainīgo.
            </p>
          ) : null}
        </div>
      ) : null}

      {orders.length > 0 ? (
        <>
          <AdminOrderVinScanDashboardCards
            cards={pickOrderVinScanDashboardCards(
              ordersWithUpsell.map((o) => ({
                sessionId: o.id,
                title: [o.makeModel, o.vin || draftSummaries.get(o.id)?.vin].filter(Boolean).join(" · ") || o.customerName || "Pasūtījums",
                vin: o.vin || draftSummaries.get(o.id)?.vin || null,
                checkoutLine: o.checkoutLine,
                auditComplete: Boolean(o.auditComplete),
                isB2bPack: Boolean(o.isB2bPack),
                hint: draftSummaries.get(o.id)?.vinScan ?? null,
              })),
            )}
          />
          <AdminOrdersTable orders={tableOrders} toolbarEnd={toolbarEnd} />
        </>
      ) : (
        <div className="mt-4 flex justify-end">{toolbarEnd}</div>
      )}

      <div className="mt-8 flex flex-wrap items-start justify-end gap-3 border-t border-slate-100/80 pt-4">
        <AdminOrdersExportButton />
      </div>
    </div>
  );
}
