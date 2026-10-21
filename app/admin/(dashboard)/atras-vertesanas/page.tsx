import Link from "next/link";
import { Suspense } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminListingPeekConversionCard } from "@/components/admin/AdminListingPeekConversionCard";
import { AdminListingPeekMobileFilters } from "@/components/admin/AdminListingPeekMobileFilters";
import { AdminListingPeekSla } from "@/components/admin/AdminListingPeekSla";
import { formatAdminMobilePhone } from "@/lib/admin-mobile-ds";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import { loadListingPeekConversionStats } from "@/lib/listing-peek-conversion-load";
import { listListingPeeks, type ListingPeekEntry } from "@/lib/listing-peek-store";
import { canonicalizeListingUrl } from "@/lib/order-field-validation";
import { csddCardFacts, listDots, QE_TONE_DOT } from "@/lib/quick-eval-cards";
import { vehicleKey } from "@/lib/quick-eval-match";
import { readQuickEval, type QuickEvalDoc } from "@/lib/quick-eval-store";
import { setQuickEvalStatus } from "./actions";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "pending", label: "Gaida atbildi" },
  { id: "completed", label: "Pabeigti" },
  { id: "rejected", label: "Noraidīti" },
  { id: "all", label: "Visi" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** VIN kā globāla atslēga: cik citos darbos (ātrie vērtējumi + pasūtījumi) šis VIN jau parādījies. */
async function loadVinSeenCounts(entries: ListingPeekEntry[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const k = vehicleKey(e.vin);
    if (k.length >= 4) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const paid = (await listPaidCheckoutSessions().catch(() => [])).filter((r) => !r.isDemo);
  const drafts = await readOrderDraftSummaries(paid.map((r) => r.id)).catch(() => new Map());
  for (const r of paid) {
    const keys = new Set([vehicleKey(r.vin), vehicleKey(drafts.get(r.id)?.vin)].filter((k) => k.length >= 4));
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

async function ListingPeekConversionPanel() {
  const stats = await loadListingPeekConversionStats();
  return <AdminListingPeekConversionCard stats={stats} variant="compact" />;
}

function inTab(e: ListingPeekEntry, tab: TabId): boolean {
  if (tab === "all") return true;
  if (tab === "pending") return e.status === "new" || e.status === "in_progress";
  return e.status === tab;
}

function matchesQuery(e: ListingPeekEntry, q: string): boolean {
  if (!q) return true;
  const hay = [e.email, e.phone, e.vin, e.listingUrl, e.comment].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function AdminListingPeeksPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; q?: string }>;
}) {
  await requireAdminPage();
  const sp = searchParams ? await searchParams : undefined;
  const tab: TabId = (TABS.find((t) => t.id === sp?.tab)?.id ?? "pending") as TabId;
  const q = (sp?.q ?? "").trim();
  const entries = await listListingPeeks(200);
  const counts = Object.fromEntries(TABS.map((t) => [t.id, entries.filter((e) => inTab(e, t.id)).length])) as Record<TabId, number>;
  const rows = entries.filter((e) => inTab(e, tab) && matchesQuery(e, q));
  const shown = rows.slice(0, 80);
  const [vinSeen, docPairs] = await Promise.all([
    loadVinSeenCounts(entries).catch(() => new Map<string, number>()),
    Promise.all(shown.map(async (e) => [e.id, await readQuickEval(e.id).catch(() => null)] as const)),
  ]);
  const docs = new Map<string, QuickEvalDoc | null>(docPairs);
  const tabHref = (t: TabId) => `/admin/atras-vertesanas?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const stats = await loadListingPeekConversionStats().catch(() => null);
  const convLine = stats
    ? stats.conversionRatePct == null || stats.uniquePeople === 0
      ? "Konversija: vēl nav datu"
      : `Konversija ${stats.conversionRatePct.toLocaleString("lv-LV", { maximumFractionDigits: 1 })}% · ${stats.convertedPeople.toLocaleString("lv-LV")} no ${stats.uniquePeople.toLocaleString("lv-LV")} klientiem`
    : undefined;

  return (
    <div className="w-full max-w-none pb-[var(--admin-tabbar-h,5.5rem)] md:pb-0">
      <AdminDashboardHeaderWithMenu mobileTitle="Ātrie vērtējumi" mobileSubtitle={convLine}>
        <p className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)] md:block">Lead</p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Ātrie vērtējumi
        </h1>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-6 max-md:hidden">
        <Suspense fallback={<div className="h-[8.5rem] rounded-2xl border border-slate-200/80 bg-white" />}>
          <ListingPeekConversionPanel />
        </Suspense>
      </div>

      <AdminListingPeekMobileFilters tab={tab} q={q} counts={counts} />

      <div className="mt-5 hidden flex-wrap items-center justify-between gap-2 md:flex">
        <nav className="flex flex-nowrap gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-[12px] font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={tabHref(t.id)}
              className={`inline-flex h-8 shrink-0 items-center rounded-lg px-3 py-1.5 max-md:h-9 max-md:text-[13px] ${tab === t.id ? "bg-white text-[var(--color-apple-text)] shadow-sm" : "text-[var(--color-provin-muted)] hover:text-[var(--color-apple-text)]"}`}
            >
              {t.label} <span className="font-normal">({counts[t.id]})</span>
            </Link>
          ))}
        </nav>
        <form className="flex gap-1.5 max-md:w-full" action="/admin/atras-vertesanas">
          <input type="hidden" name="tab" value={tab} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Meklēt: VIN, e-pasts, tālrunis, saite"
            className="w-[17rem] max-w-[60vw] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--color-provin-accent)] max-md:h-9 max-md:max-w-none max-md:flex-1 max-md:rounded-[10px] max-md:border-0 max-md:bg-[#e5e5ea] max-md:text-base"
          />
          <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-semibold hover:bg-slate-50 max-md:h-9 max-md:px-4 max-md:text-[13px]">
            Meklēt
          </button>
        </form>
      </div>

      {shown.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-10 text-center text-sm text-[var(--color-provin-muted)] max-md:mx-4 max-md:border-[var(--am-hair)] max-md:bg-[var(--am-s1)] max-md:text-[var(--am-ink2)]">
          {q ? "Nekas netika atrasts." : "Šeit nav ierakstu. Jauni ātrie vērtējumi parādīsies šeit."}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white max-md:mx-4 max-md:space-y-2.5 max-md:divide-y-0 max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          {shown.map((e) => {
            const doc = docs.get(e.id) ?? null;
            const listingUrl = canonicalizeListingUrl(e.listingUrl);
            const csdd = doc ? csddCardFacts(doc.sourceBlocks.csdd, e.vin ?? "") : [];
            const title = csdd.find((f) => f.label === "Marka, modelis")?.value || hostOf(listingUrl);
            const dots = doc
              ? listDots({
                  blocks: doc.sourceBlocks,
                  parts: (doc.seed?.parts ?? {}) as Record<string, string | undefined>,
                  sourceAt: doc.sourceAt ?? {},
                  seedAt: doc.seed?.at ?? null,
                  peekVin: e.vin ?? "",
                  listingUrl,
                })
              : [];
            const seen = (vinSeen.get(vehicleKey(e.vin)) ?? 1) - 1;
            const octa = csdd.find((f) => f.label === "OCTA");
            const ta = csdd.find((f) => f.label === "Tehniskā apskate");
            const pending = e.status === "new" || e.status === "in_progress";
            const href = `/admin/atras-vertesanas/${encodeURIComponent(e.id)}`;
            return (
              <li key={e.id} className="relative flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 hover:bg-slate-50/70 max-md:min-h-[88px] max-md:items-start max-md:rounded-[22px] max-md:bg-[var(--am-s1)] max-md:px-4 max-md:py-3.5 max-md:shadow-[var(--am-card-shadow)] max-md:hover:bg-[var(--am-s1)] md:flex-nowrap">
                <Link href={href} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 max-md:flex-col max-md:items-stretch md:flex-nowrap">
                  <span className="w-[11.5rem] shrink-0 max-md:absolute max-md:right-3 max-md:top-3 max-md:w-auto">
                    <AdminListingPeekSla createdAt={e.createdAt} complete={e.status === "completed"} rejected={e.status === "rejected"} />
                  </span>
                  <span className="min-w-0 flex-1 max-md:pr-16">
                    <span className="block truncate text-[13px] font-semibold text-[var(--color-apple-text)] max-md:text-[16px]">
                      {e.status === "new" ? <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--am-ink3,#8a8a8e)]" title="Jauns, vēl nav atvērts" /> : null}
                      {title}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-[var(--color-provin-muted)] max-md:text-[12.5px]">{e.vin || "VIN nav"}</span>
                  </span>
                  <span className="w-[12rem] min-w-0 truncate text-[12px] text-[var(--color-provin-muted)] max-md:w-full">
                    {e.email}
                    {e.phone ? ` · ${formatAdminMobilePhone(e.phone)}` : ""}
                  </span>
                  <span className="qe-source-dots flex shrink-0 items-center gap-1 max-md:hidden" aria-label="Avoti">
                    {dots.map((d) => (
                      <i key={d.id} className={`inline-block h-2.5 w-2.5 rounded-full ${QE_TONE_DOT[d.tone]}`} title={d.title} />
                    ))}
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-1 text-[10px] font-semibold">
                    {seen > 0 ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">VIN jau pārbaudīts ({seen})</span> : null}
                    {octa?.tone === "bad" ? <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800">OCTA beigusies</span> : null}
                    {ta?.tone === "bad" ? (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800">TA beigusies</span>
                    ) : null}
                    {(doc?.exports ?? []).length > 0 ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">Eksportēts</span> : null}
                  </span>
                </Link>
                {pending ? (
                  <form action={setQuickEvalStatus} className="qe-list-reject max-md:hidden">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button type="submit" className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 max-md:py-2">
                      Noraidīt
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > shown.length ? (
        <p className="mt-2 text-[12px] text-[var(--color-provin-muted)]">Rādīti {shown.length} no {rows.length}. Sašaurini meklēšanu.</p>
      ) : null}
    </div>
  );
}
