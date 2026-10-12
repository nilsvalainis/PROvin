"use client";

import {
  BarChart3,
  Car,
  ChevronsLeft,
  ChevronsRight,
  Cog,
  Euro,
  FileText,
  Handshake,
  Home,
  LayoutGrid,
  List,
  LogOut,
  MoreHorizontal,
  PenLine,
  Plus,
  Radar,
  ScanLine,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** Variants A: grupēta kreisā sānjosla visiem admin paneļiem (PRO + IRISS). Mobilajā — apakšējā cilņu josla + „Vairāk”. */

type Item = { href: string; label: string; icon: LucideIcon; badge?: "fast" | "partners" | "orders"; plus?: boolean; match: (p: string) => boolean };
type Group = { title: string; items: Item[] };

const starts = (prefix: string) => (p: string) => p.startsWith(prefix);

/**
 * Centrālā izvēlnes nosaukumu konfigurācija — pārdēvēšanai maini tikai šeit
 * (attiecas uz sānjoslu, mobilo tab joslu un „Vairāk” lapu). Maršruti nemainās.
 * Konsultācijas (/admin/konsultacijas) apzināti paslēptas no izvēlnes; maršruts saglabāts.
 */
export const ADMIN_NAV_LABELS = {
  groupPro: "PRO",
  groupIriss: "IRISS",
  groupWeb: "WEB",
  groupB2b: "B2B",
  orders: "Pasūtījumi",
  vinScan: "VIN pārbaude",
  fast: "Ātrie vērtējumi",
  irissHome: "Pasūtījumi",
  irissNew: "Jauns pasūtījums",
  irissScan: "Meklētājs",
  irissList: "Filtri",
  irissWaybills: "Pavadzīmes",
  blogs: "Blogs",
  aggregates: "Agregāti",
  stats: "Statistika",
  invoices: "Rēķini",
  partners: "Partneri",
  logout: "Iziet",
} as const;
const L = ADMIN_NAV_LABELS;

const SAKUMS: Item = {
  href: "/admin/dashboard",
  label: L.orders,
  icon: Home,
  badge: "orders",
  match: (p) => p === "/admin" || p.startsWith("/admin/dashboard") || p.startsWith("/admin/orders/"),
};
const FAST: Item = { href: "/admin/atras-vertesanas", label: L.fast, icon: Zap, badge: "fast", match: starts("/admin/atras-vertesanas") };
const VIN: Item = { href: "/admin/vin-scan", label: L.vinScan, icon: ScanLine, match: starts("/admin/vin-scan") };
const PARTNERI: Item = { href: "/admin/partneri", label: L.partners, icon: Handshake, badge: "partners", match: starts("/admin/partneri") };
const I_HOME: Item = { href: "/admin/iriss/pasutijumi", label: L.irissHome, icon: Car, plus: true, match: starts("/admin/iriss/pasutijumi") };
const I_SCAN: Item = { href: "/admin/iriss/scan", label: L.irissScan, icon: Radar, match: starts("/admin/iriss/scan") };
const I_WAYBILLS: Item = { href: "/admin/iriss/pavadzimes", label: L.irissWaybills, icon: FileText, match: starts("/admin/iriss/pavadzimes") };
const I_LIST: Item = { href: "/admin/iriss/sludinajumi", label: L.irissList, icon: List, match: starts("/admin/iriss/sludinajumi") };

export const ADMIN_NAV_GROUPS: Group[] = [
  { title: L.groupPro, items: [SAKUMS, VIN, FAST] },
  { title: L.groupIriss, items: [I_HOME, I_SCAN, I_LIST, I_WAYBILLS] },
  {
    title: L.groupWeb,
    items: [
      { href: "/admin/blogs", label: L.blogs, icon: PenLine, match: starts("/admin/blogs") },
      { href: "/admin/agregatu-zinasanas", label: L.aggregates, icon: Cog, match: starts("/admin/agregatu-zinasanas") },
      { href: "/admin/statistika", label: L.stats, icon: BarChart3, match: starts("/admin/statistika") },
    ],
  },
  {
    title: L.groupB2b,
    items: [
      { href: "/admin/commission-invoice", label: L.invoices, icon: Euro, match: starts("/admin/commission-invoice") },
      PARTNERI,
    ],
  },
];

const STORAGE_KEY = "admin-sidebar-collapsed";

function useCount(url: string, key: "openCount" | "unseenCount" | "activeCount" | "overdueCount"): number {
  const pathname = usePathname();
  const [n, setN] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const v = data[key];
      setN(typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
    } catch {
      /* žetons nav kritisks */
    }
  }, [url, key]);
  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 45_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, refresh]);
  return n;
}

function useBadges() {
  const fast = useCount("/api/admin/listing-peeks/open-count", "openCount");
  const partners = useCount("/api/admin/partners/unseen-count", "unseenCount");
  const orders = useCount("/api/admin/orders/active-count", "activeCount");
  const ordersOverdue = useCount("/api/admin/orders/active-count", "overdueCount");
  return { fast, partners, orders, ordersOverdue } as const;
}

/** Žetons: sarkans pēc noklusējuma; „Pasūtījumi” — pelēks, sarkans tikai ja kāds kavē termiņu. */
function Badge({ n, dot = false, gray = false }: { n: number; dot?: boolean; gray?: boolean }) {
  if (n <= 0) return null;
  const bg = gray ? "bg-[#8e8e93]" : "bg-rose-600";
  if (dot) return <span className={`absolute right-1.5 top-1 h-2 w-2 rounded-full ${bg}`} aria-hidden />;
  return (
    <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full ${bg} px-1 text-[10px] font-bold leading-none text-white`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

async function logout() {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/admin/login";
}

function useNewIrissOffer() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const create = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/iriss-pasutijumi", { method: "POST", credentials: "include", headers: { Accept: "application/json" } });
      const data = (await res.json().catch(() => ({}))) as { id?: unknown };
      if (!res.ok || typeof data.id !== "string") return;
      router.push(`/admin/iriss/pasutijumi/${encodeURIComponent(data.id)}?newOffer=1&noClientPdf=1`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [busy, router]);
  return { busy, create };
}

export function useAdminSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

/** Desktop (md+) sānjosla. Noklusējumā atvērta; sakļauta = ikonu josla (stāvoklis localStorage). */
export function AdminSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname() || "";
  const badges = useBadges();
  const offer = useNewIrissOffer();
  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-[#e5e5ea] bg-white transition-[width] duration-200 md:flex ${collapsed ? "w-[64px]" : "w-[232px]"}`}
      aria-label="Galvenā izvēlne"
    >
      <div className={`flex h-12 shrink-0 items-center ${collapsed ? "justify-center" : "justify-between pl-5 pr-2"}`}>
        {collapsed ? null : (
          <Link href="/admin/dashboard" className="admin-nav-link text-[15px] font-bold tracking-tight text-[var(--color-apple-text)]">
            PROVIN
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8e93] transition hover:bg-black/[0.05] hover:text-[var(--color-apple-text)]"
          aria-label={collapsed ? "Izvērst izvēlni" : "Sakļaut izvēlni"}
          title={collapsed ? "Izvērst izvēlni" : "Sakļaut izvēlni"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" aria-hidden /> : <ChevronsLeft className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 [scrollbar-width:thin]">
        {ADMIN_NAV_GROUPS.map((g) => (
          <div key={g.title} className="mt-2 first:mt-0">
            {collapsed ? (
              <div className="mx-auto my-2 h-px w-6 bg-[#e5e5ea] first:hidden" aria-hidden />
            ) : (
              <p className="px-2.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">{g.title}</p>
            )}
            {g.items.map((it) => {
              const on = it.match(pathname);
              const n = it.badge ? badges[it.badge] : 0;
              const gray = it.badge === "orders" && badges.ordersOverdue === 0;
              const Icon = it.icon;
              return (
                <div key={it.href} className="relative">
                <Link
                                    href={it.href}
                  title={collapsed ? it.label : undefined}
                  aria-current={on ? "page" : undefined}
                  className={`admin-nav-link relative flex h-9 items-center gap-2.5 rounded-lg text-[13.5px] transition ${collapsed ? "justify-center" : "px-2.5"} ${
                    on ? "bg-[#e8efff] font-semibold text-[var(--color-provin-accent)]" : "text-[var(--color-apple-text)] hover:bg-black/[0.04]"
                  }`}
                >
                  <Icon className={`h-[17px] w-[17px] shrink-0 ${on ? "" : "text-[#8e8e93]"}`} strokeWidth={2} aria-hidden />
                  {collapsed ? <Badge n={n} dot gray={gray} /> : <><span className="min-w-0 flex-1 truncate">{it.label}</span><Badge n={n} gray={gray} />{it.plus ? <span className="w-6 shrink-0" aria-hidden /> : null}</>}
                </Link>
                  {it.plus && !collapsed ? (
                    <button
                      type="button"
                      onClick={() => void offer.create()}
                      disabled={offer.busy}
                      title={L.irissNew}
                      aria-label={L.irissNew}
                      className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#8e8e93] transition hover:bg-black/[0.06] hover:text-[var(--color-apple-text)] disabled:opacity-50"
                    >
                      {offer.busy ? <span className="text-[10px]">…</span> : <Plus className="h-4 w-4" aria-hidden />}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={`shrink-0 border-t border-[#e5e5ea] p-2.5 ${collapsed ? "flex justify-center" : ""}`}>
        <button
          type="button"
          onClick={() => void logout()}
          title={L.logout}
          className={`flex h-9 items-center gap-2.5 rounded-lg text-[13px] text-[#8e8e93] transition hover:bg-black/[0.04] hover:text-[var(--color-apple-text)] ${collapsed ? "w-9 justify-center" : "w-full px-2.5"}`}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {collapsed ? null : <span>{L.logout}</span>}
        </button>
      </div>
    </aside>
  );
}

/** Mobilā apakšējā cilņu josla: 4 konteksta cilnes + „Vairāk” (pilns grupētais saraksts apakšējā lapā). */
export function AdminMobileTabBar({ workspace }: { workspace: "pro" | "iriss" }) {
  const pathname = usePathname() || "";
  const badges = useBadges();
  const offer = useNewIrissOffer();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [pathname]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [more]);

  const PRO_HUB: Item = { href: "/admin/dashboard", label: "PRO", icon: LayoutGrid, match: () => false };
  const IRISS_HUB: Item = { href: "/admin/iriss/pasutijumi", label: "IRISS", icon: Car, match: starts("/admin/iriss") };
  const tabs: Item[] = workspace === "iriss" ? [I_HOME, I_SCAN, I_LIST, PRO_HUB] : [SAKUMS, VIN, FAST, IRISS_HUB];
  const inTabs = tabs.some((t) => t.match(pathname));
  const moreBadge = workspace === "iriss" ? badges.fast + badges.partners : badges.partners;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-[35] flex border-t border-[#e5e5ea] bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
        aria-label="Galvenā izvēlne"
      >
        {tabs.map((t) => {
          const on = t.match(pathname);
          const n = t.badge ? badges[t.badge] : 0;
          const gray = t.badge === "orders" && badges.ordersOverdue === 0;
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href} aria-current={on ? "page" : undefined} className={`admin-nav-link relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${on ? "font-semibold text-[var(--color-provin-accent)]" : "text-[#8e8e93]"}`}>
              <span className="relative">
                <Icon className="h-[21px] w-[21px]" strokeWidth={on ? 2.3 : 1.9} aria-hidden />
                {n > 0 ? <span className="absolute -right-2.5 -top-1.5"><Badge n={n} gray={gray} /></span> : null}
              </span>
              <span className="max-w-full truncate px-0.5">{t.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} className={`relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${!inTabs || more ? "font-semibold text-[var(--color-provin-accent)]" : "text-[#8e8e93]"}`} aria-expanded={more} aria-label="Vairāk">
          <span className="relative">
            <MoreHorizontal className="h-[21px] w-[21px]" aria-hidden />
            {moreBadge > 0 ? <span className="absolute -right-2.5 -top-1.5"><Badge n={moreBadge} /></span> : null}
          </span>
          Vairāk
        </button>
      </nav>
      {more ? (
        <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true" aria-label="Visas sadaļas">
          <button type="button" aria-label="Aizvērt" className="absolute inset-0 bg-black/35" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
            <div className="mx-auto mb-1 h-1.5 w-9 rounded-full bg-[#d1d1d6]" aria-hidden />
            {ADMIN_NAV_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">{g.title}</p>
                <div className="overflow-hidden rounded-xl bg-[#f2f2f7]">
                  {g.items.map((it) => {
                    const on = it.match(pathname);
                    const n = it.badge ? badges[it.badge] : 0;
              const gray = it.badge === "orders" && badges.ordersOverdue === 0;
                    const Icon = it.icon;
                    return (
                      <div key={it.href} className="relative border-b border-[#e5e5ea] last:border-b-0">
                      <Link href={it.href} onClick={() => setMore(false)} className={`admin-nav-link flex h-11 items-center gap-3 px-3 text-[15px] ${on ? "font-semibold text-[var(--color-provin-accent)]" : "text-[var(--color-apple-text)]"}`}>
                        <Icon className={`h-[18px] w-[18px] ${on ? "" : "text-[#8e8e93]"}`} aria-hidden />
                        <span className="flex-1">{it.label}</span>
                        <Badge n={n} gray={gray} />
                        {it.plus ? <span className="w-8 shrink-0" aria-hidden /> : null}
                      </Link>
                        {it.plus ? (
                          <button type="button" onClick={() => void offer.create()} disabled={offer.busy} aria-label={L.irissNew} className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#3a3a3c] disabled:opacity-50">
                            <Plus className="h-[18px] w-[18px]" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => void logout()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f2f2f7] text-[15px] text-red-600">
              <LogOut className="h-4 w-4" aria-hidden /> {L.logout}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
