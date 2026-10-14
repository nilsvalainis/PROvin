import Link from "next/link";
import type { AuditDeadlineStatus } from "@/lib/admin-audit-deadline";
import type { MorningQueueItem, MorningSummary } from "@/lib/admin-morning-summary";

const TONE: Record<AuditDeadlineStatus, string> = {
  ok: "bg-[#f2f2f7] text-[#3a3a3c]",
  urgent: "bg-amber-100 text-amber-950",
  overdue: "bg-red-100 text-red-800",
};

function CountTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "urgent" | "overdue";
}) {
  const wrap =
    tone === "overdue" && value > 0
      ? "border-red-200 bg-red-50"
      : tone === "urgent" && value > 0
        ? "border-amber-200 bg-amber-50"
        : "border-[#e5e5ea] bg-white";
  return (
    <div className={`flex min-h-[5.5rem] flex-1 flex-col justify-center rounded-2xl border px-3 py-3 ${wrap}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">{label}</p>
      <p className="mt-1 text-[2rem] font-bold leading-none tabular-nums text-[var(--color-apple-text)]">{value}</p>
    </div>
  );
}

function ItemCard({ item }: { item: MorningQueueItem }) {
  const pill = item.deadlineStatus ? TONE[item.deadlineStatus] : "bg-[#f2f2f7] text-[#3a3a3c]";
  return (
    <li>
      <Link
        href={item.href}
        className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-[#e5e5ea] bg-white px-4 py-3 shadow-sm active:scale-[0.99]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold text-[var(--color-apple-text)]">{item.title}</p>
          {item.subtitle ? <p className="mt-0.5 truncate text-[12px] text-[#8e8e93]">{item.subtitle}</p> : null}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${pill}`}>
          {item.deadlineLabel ?? (item.isNew ? "Jauns" : "Atvērt")}
        </span>
      </Link>
    </li>
  );
}

function Section({ title, items }: { title: string; items: MorningQueueItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="px-0.5 text-[13px] font-semibold text-[#3a3a3c]">
        {title} <span className="font-normal text-[#8e8e93]">{items.length}</span>
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <ItemCard key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </ul>
    </section>
  );
}

export function AdminMorningSummaryView({
  summary,
  stripeError,
}: {
  summary: MorningSummary;
  stripeError: string | null;
}) {
  const { counts } = summary;
  const empty =
    summary.overdueAudits.length +
      summary.dueTodayAudits.length +
      summary.urgentAudits.length +
      summary.unansweredPeeks.length ===
    0;

  return (
    <div className="mx-auto w-full max-w-lg pb-8">
      <div className="flex gap-2">
        <CountTile label="Atvērti" value={counts.open} tone="ok" />
        <CountTile label="Steidzami" value={counts.urgent} tone="urgent" />
        <CountTile label="Kavēti" value={counts.overdue} tone="overdue" />
      </div>
      <p className="mt-2 px-0.5 text-[12px] text-[#8e8e93]">
        Auditi {counts.openAudits} · vērtējumi {counts.openPeeks}
        {counts.dueTodayAudits > 0 ? ` · šodien ${counts.dueTodayAudits}` : ""}
      </p>

      {stripeError ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          {stripeError}
        </p>
      ) : null}

      {empty ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[#e5e5ea] bg-white px-5 py-10 text-center text-[15px] text-[#8e8e93]">
          Nav atvērtu auditu vai neatbildētu vērtējumu.
        </p>
      ) : null}

      <Section title="Kavētie auditi" items={summary.overdueAudits} />
      <Section title="Šodienas termiņi" items={summary.dueTodayAudits} />
      <Section title="Steidzamie auditi" items={summary.urgentAudits} />
      <Section title="Jauni un neatbildētie vērtējumi" items={summary.unansweredPeeks} />

      <div className="mt-8 flex flex-col gap-2">
        <Link
          href="/admin/dashboard"
          className="flex min-h-12 items-center justify-center rounded-2xl bg-[#f2f2f7] text-[15px] font-semibold text-[var(--color-apple-text)]"
        >
          Visi pasūtījumi
        </Link>
        <Link
          href="/admin/atras-vertesanas"
          className="flex min-h-12 items-center justify-center rounded-2xl bg-[#f2f2f7] text-[15px] font-semibold text-[var(--color-apple-text)]"
        >
          Ātrie vērtējumi
        </Link>
      </div>
    </div>
  );
}
