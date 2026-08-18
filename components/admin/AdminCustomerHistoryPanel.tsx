"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { META_ORDER_LUCIDE } from "@/lib/admin-lucide-registry";
import type { CustomerHistory, CustomerHistoryPeekStatus } from "@/lib/admin-customer-history";
import type { CustomerContactMatchVia } from "@/lib/admin-customer-identity";
import { formatMoneyEur } from "@/lib/format-money";
import { formatOrderTimestampSec } from "@/lib/format-order-datetime";
import { formatListingPeekSubmittedAt } from "@/lib/listing-peek-deadline";
import { SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS } from "@/lib/admin-source-blocks";

const STATUS_LABEL: Record<CustomerHistoryPeekStatus, string> = {
  new: "Jauns",
  in_progress: "Procesā",
  completed: "Pabeigts",
  rejected: "Noraidīts",
};

const MATCH_LABEL: Record<CustomerContactMatchVia, string> = {
  email: "pēc e-pasta",
  phone: "pēc tālruņa",
  email_and_phone: "pēc e-pasta un tālruņa",
};

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "telegram" | "repeat" | "peek" | "muted";
}) {
  const cls =
    tone === "telegram"
      ? "border-amber-300/90 bg-amber-50 text-amber-950"
      : tone === "repeat"
        ? "border-slate-300 bg-slate-50 text-slate-800"
        : tone === "peek"
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-slate-200 bg-white text-[var(--color-provin-muted)]";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${cls}`}
    >
      {children}
    </span>
  );
}

export function AdminCustomerHistoryPanel({
  sessionId,
  history,
  shellClassName,
}: {
  sessionId: string;
  history: CustomerHistory | null;
  shellClassName: string;
}) {
  const data = history;
  const empty = !data || (data.peeks.length === 0 && data.otherPaid.length === 0);
  const sectionTitle = `font-medium uppercase tracking-wide text-[var(--color-provin-muted)] ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS}`;

  return (
    <section id="admin-order-section-klienta-vesture" className="min-w-0">
      <AdminCollapsibleShell
        sessionId={sessionId}
        blockId="meta-customer-history"
        className={shellClassName}
        header={
          <h2 className={`${sectionTitle} flex flex-wrap items-center gap-x-2 gap-y-0 px-2 py-2`}>
            <AdminProvinLucide icon={META_ORDER_LUCIDE.history} />
            Klienta vēsture
          </h2>
        }
      >
        <div className="space-y-3 px-2 pb-3">
          <p className="text-[10px] leading-relaxed text-[var(--color-provin-muted)]">
            Tikai operatoram — nav PDF. Sakritība pēc e-pasta vai tālruņa. Šeit ir teksts, ko klients jau ir
            saņēmis ātrajā vērtējumā.
          </p>

          {data ? (
            <div className="flex flex-wrap gap-1.5">
              {data.flags.telegramGroup ? <Badge tone="telegram">Telegram grupa (9,99 €)</Badge> : null}
              {data.flags.repeatPaid ? <Badge tone="repeat">Atkārtots klients</Badge> : null}
              {data.flags.hasPeek ? (
                <Badge tone="peek">
                  {data.flags.hasSentPeekComment
                    ? `Ātrais vērtējums (${data.peeks.length})`
                    : "Ātrais vērtējums — atbilde nav saglabāta"}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {empty ? (
            <p className="text-[12px] leading-relaxed text-[var(--color-provin-muted)]">
              Nav saistītu ātro vērtējumu vai citu apmaksātu pasūtījumu ar šo e-pastu vai tālruni.
            </p>
          ) : null}

          {data && data.peeks.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
                Ātrajā vērtējumā nosūtītais teksts
              </h3>
              <ul className="space-y-2">
                {data.peeks.map((peek) => (
                  <li
                    key={peek.id}
                    className="rounded-xl border border-emerald-100/90 bg-emerald-50/40 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <p className="text-[11px] font-semibold text-[var(--color-apple-text)]">
                        {formatListingPeekSubmittedAt(peek.createdAt)}
                        <span className="ml-2 font-normal text-[var(--color-provin-muted)]">
                          {STATUS_LABEL[peek.status]} · {MATCH_LABEL[peek.matchVia]}
                        </span>
                      </p>
                      {peek.commentSentAt ? (
                        <p className="text-[10px] text-[var(--color-provin-muted)]">
                          Nosūtīts {formatListingPeekSubmittedAt(peek.commentSentAt)}
                        </p>
                      ) : null}
                    </div>
                    <a
                      href={peek.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block break-all text-[11px] text-[var(--color-provin-accent)] hover:underline"
                    >
                      {peek.listingUrl}
                    </a>
                    {peek.comment ? (
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-emerald-100 bg-white px-3 py-2 text-[12px] leading-relaxed text-[var(--color-apple-text)]">
                        {peek.comment}
                      </pre>
                    ) : (
                      <p className="mt-2 text-[12px] leading-relaxed text-amber-900/90">
                        {peek.status === "completed"
                          ? "Šim ierakstam nosūtītais teksts nav saglabāts (vecāks ieraksts)."
                          : "Atbilde šim ātrajam vērtējumam vēl nav nosūtīta."}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-[11px]">
                <Link
                  href="/admin/atras-vertesanas"
                  className="font-medium text-[var(--color-provin-accent)] hover:underline"
                >
                  Atvērt ātro vērtējumu sarakstu →
                </Link>
              </p>
            </div>
          ) : null}

          {data && data.otherPaid.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
                Citi apmaksātie pasūtījumi
              </h3>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white">
                {data.otherPaid.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2">
                    <div className="min-w-0">
                      <Link
                        href={row.href}
                        className="text-[12px] font-semibold text-[var(--color-apple-text)] hover:underline"
                      >
                        {row.productLabel}
                      </Link>
                      <p className="text-[10px] text-[var(--color-provin-muted)]">
                        {formatOrderTimestampSec(row.created)}
                        {row.vin ? ` · ${row.vin}` : ""}
                        {` · ${MATCH_LABEL[row.matchVia]}`}
                      </p>
                    </div>
                    <p className="text-[12px] tabular-nums text-[var(--color-apple-text)]">
                      {formatMoneyEur(row.amountTotal, row.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </AdminCollapsibleShell>
    </section>
  );
}
