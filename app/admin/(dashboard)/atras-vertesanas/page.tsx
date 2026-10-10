import Link from "next/link";
import { Suspense } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminListingPeekConversionCard } from "@/components/admin/AdminListingPeekConversionCard";
import { AdminListingPeekSla } from "@/components/admin/AdminListingPeekSla";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import { loadListingPeekConversionStats } from "@/lib/listing-peek-conversion-load";
import { listListingPeeks, type ListingPeekEntry } from "@/lib/listing-peek-store";
import { canonicalizeListingUrl } from "@/lib/order-field-validation";
import { csddCardFacts, listDots, QE_TONE_DOT } from "@/lib/quick-eval-cards";
import { vehicleKey } from "@/lib/quick-eval-match";
import { readQuickEval, type QuickEvalDoc } from "@/lib/quick-eval-store";
import { setQuickEvalStatus } from "./actions";

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
  const sp = searchParams ? await searchParams : undefined;
  const tab: TabId = (TABS.find((t) => t.id === sp?.tab)?.id ?? "pending") as TabId;
  const q = (sp?.q ?? "").trim();
  const entries = await listListingPeeks(200);
  const vinSeen = await loadVinSeenCounts(entries).catch(() => new Map<string, number>());
  const counts = Object.fromEntries(TABS.map((t) => [t.id, entries.filter((e) => inTab(e, t.id)).length])) as Record<TabId, number>;
  const rows = entries.filter((e) => inTab(e, tab) && matchesQuery(e, q));
  const shown = rows.slice(0, 80);
  const docs = new Map<string, QuickEvalDoc | null>(
    await Promise.all(shown.map(async (e) => [e.id, await readQuickEval(e.id).catch(() => null)] as const)),
  );
  const tabHref = (t: TabId) => `/admin/atras-vertesanas?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Lead</p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Ātrie vērtējumi
        </h1>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-6">
        <Suspense fallback={<div className="h-[8.5rem] rounded-2xl border border-slate-200/80 bg-white" />}>
          <ListingPeekConversionPanel />
        </Suspense>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-[12px] font-semibold">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={tabHref(t.id)}
              className={`rounded-lg px-3 py-1.5 ${tab === t.id ? "bg-white text-[var(--color-apple-text)] shadow-sm" : "text-[var(--color-provin-muted)] hover:text-[var(--color-apple-text)]"}`}
            >
              {t.label} <span className="font-normal">({counts[t.id]})</span>
            </Link>
          ))}
        </nav>
        <form className="flex gap-1.5" action="/admin/atras-vertesanas">
          <input type="hidden" name="tab" value={tab} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Meklēt: VIN, e-pasts, tālrunis, saite"
            className="w-[17rem] max-w-[60vw] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--color-provin-accent)]"
          />
          <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-semibold hover:bg-slate-50">
            Meklēt
          </button>
        </form>
      </div>

      {shown.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-10 text-center text-sm text-[var(--color-provin-muted)]">
          {q ? "Nekas netika atrasts." : "Šeit nav ierakstu."}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 hover:bg-slate-50/70 md:flex-nowrap">
                <Link href={href} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 md:flex-nowrap">
                  <span className="w-[11.5rem] shrink-0">
                    <AdminListingPeekSla createdAt={e.createdAt} complete={e.status === "completed"} rejected={e.status === "rejected"} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--color-apple-text)]">
                      {e.status === "new" ? <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-provin-accent)]" title="Jauns, vēl nav atvērts" /> : null}
                      {title}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-[var(--color-provin-muted)]">{e.vin || "VIN nav"}</span>
                  </span>
                  <span className="w-[12rem] min-w-0 truncate text-[12px] text-[var(--color-provin-muted)] max-md:w-full">
                    {e.email}
                    {e.phone ? ` · ${e.phone}` : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-1" aria-label="Avoti">
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
                  <form action={setQuickEvalStatus}>
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
