"use client";

import {
  BarChart3,
  CalendarRange,
  Car,
  ChevronsLeft,
  ChevronsRight,
  Cog,
  Euro,
  FileText,
  Handshake,
  Home,
  MessagesSquare,
  List,
  LogOut,
  MoreHorizontal,
  PenLine,
  Plus,
  Radar,
  ScanLine,
  Sun,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IrissPavadzimesSidebarCard } from "@/components/admin/IrissPavadzimesSidebarCard";

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
  morning: "Rīta kopsavilkums",
  vinScan: "VIN pārbaude",
  fast: "Ātrie vērtējumi",
  irissHome: "Pasūtījumi",
  irissNew: "Jauns pasūtījums",
  irissScan: "Radars",
  irissList: "Klientu filtri",
  irissReport: "Mēneša atskaite",
  irissWaybills: "Pavadzīmes",
  irissSettings: "Iestatījumi",
  blogs: "Blogs",
  aggregates: "Agregāti",
  stats: "Statistika",
  templates: "Tekstu šabloni",
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
const MORNING: Item = { href: "/admin/kopsavilkums", label: L.morning, icon: Sun, match: starts("/admin/kopsavilkums") };
const FAST: Item = { href: "/admin/atras-vertesanas", label: L.fast, icon: Zap, badge: "fast", match: starts("/admin/atras-vertesanas") };
const VIN: Item = { href: "/admin/vin-scan", label: L.vinScan, icon: ScanLine, match: starts("/admin/vin-scan") };
const PARTNERI: Item = { href: "/admin/partneri", label: L.partners, icon: Handshake, badge: "partners", match: starts("/admin/partneri") };
const I_HOME: Item = { href: "/admin/iriss/pasutijumi", label: L.irissHome, icon: Car, plus: true, match: starts("/admin/iriss/pasutijumi") };
const I_SCAN: Item = { href: "/admin/iriss/scan", label: L.irissScan, icon: Radar, match: starts("/admin/iriss/scan") };
const I_WAYBILLS: Item = { href: "/admin/iriss/pavadzimes", label: L.irissWaybills, icon: FileText, match: starts("/admin/iriss/pavadzimes") };
const I_LIST: Item = { href: "/admin/iriss/sludinajumi", label: L.irissList, icon: List, match: starts("/admin/iriss/sludinajumi") };
const I_REPORT: Item = { href: "/admin/iriss/atskaite", label: L.irissReport, icon: CalendarRange, match: starts("/admin/iriss/atskaite") };
const I_SETTINGS: Item = { href: "/admin/iriss/iestatijumi", label: L.irissSettings, icon: Cog, match: starts("/admin/iriss/iestatijumi") };

/** Tā pati VIN pārbaudes lapa arī IRISS izvēlnē (dublēts ieraksts). */
const I_VIN: Item = { ...VIN, label: L.vinScan };

export const ADMIN_NAV_GROUPS: Group[] = [
  { title: L.groupPro, items: [MORNING, SAKUMS, VIN, FAST] },
  { title: L.groupIriss, items: [I_HOME, I_LIST, I_SCAN, I_VIN, I_REPORT, I_WAYBILLS, I_SETTINGS] },
  {
    title: L.groupWeb,
    items: [
      { href: "/admin/blogs", label: L.blogs, icon: PenLine, match: starts("/admin/blogs") },
      { href: "/admin/agregatu-zinasanas", label: L.aggregates, icon: Cog, match: starts("/admin/agregatu-zinasanas") },
      { href: "/admin/statistika", label: L.stats, icon: BarChart3, match: starts("/admin/statistika") },
      {
        href: "/admin/teksti",
        label: L.templates,
        icon: MessagesSquare,
        match: starts("/admin/teksti"),
      },
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

/** PRO un IRISS izvēlnes nejaucas: katrai darba zonai savas grupas. */
export type AdminWorkspace = "pro" | "iriss";
const WS_GROUPS: Record<AdminWorkspace, Group[]> = {
  pro: ADMIN_NAV_GROUPS.filter((g) => g.title !== L.groupIriss),
  iriss: ADMIN_NAV_GROUPS.filter((g) => g.title === L.groupIriss),
};
export const ADMIN_WS_COOKIE = "admin_ws";
/** Lapas, kas pieder abām zonām — zonu nosaka pēdējā izvēle. */
const SHARED_PATHS = ["/admin/vin-scan"];

function readWsCookie(): AdminWorkspace | null {
  if (typeof document === "undefined") return null;
  const m = /(?:^|; )admin_ws=(pro|iriss)/.exec(document.cookie);
  return m ? (m[1] as AdminWorkspace) : null;
}
function writeWsCookie(ws: AdminWorkspace) {
  document.cookie = `${ADMIN_WS_COOKIE}=${ws}; Path=/admin; Max-Age=31536000; SameSite=Lax`;
}

/** Zona no URL; kopīgām lapām — pēdējā izmantotā (sīkdatne, lai /admin pēc pieteikšanās atver to pašu). */
export function useAdminWorkspace(): AdminWorkspace {
  const pathname = usePathname() || "";
  const shared = SHARED_PATHS.some((p) => pathname.startsWith(p));
  const fromPath: AdminWorkspace = pathname.startsWith("/admin/iriss") ? "iriss" : "pro";
  const [stored, setStored] = useState<AdminWorkspace | null>(null);
  useEffect(() => {
    if (shared) setStored(readWsCookie());
    else writeWsCookie(fromPath);
  }, [shared, fromPath, pathname]);
  return shared ? (stored ?? "pro") : fromPath;
}

function WorkspaceSwitch({ ws }: { ws: AdminWorkspace }) {
  const seg = (on: boolean) =>
    `admin-nav-link flex h-7 flex-1 items-center justify-center rounded-md text-[12px] font-semibold tracking-wide transition ${
      on ? "bg-white text-[var(--color-apple-text)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#8e8e93] hover:text-[var(--color-apple-text)]"
    }`;
  return (
    <div className="flex gap-0.5 rounded-lg bg-[#f2f2f7] p-0.5" role="tablist" aria-label="Darba zona">
      <Link href="/admin/dashboard" onClick={() => writeWsCookie("pro")} className={seg(ws === "pro")} aria-current={ws === "pro" ? "page" : undefined}>
        PRO
      </Link>
      <Link href="/admin/iriss/pasutijumi" onClick={() => writeWsCookie("iriss")} className={seg(ws === "iriss")} aria-current={ws === "iriss" ? "page" : undefined}>
        IRISS
      </Link>
    </div>
  );
}

const STORAGE_KEY = "admin-sidebar-collapsed";

/**
 * Žetonu skaiti — viens kopīgs avots katram URL (modulī), nevis atsevišķs fetch katram žetonam/komponentam.
 * Agrāk: katrs žetons sāka ar 0, „Pasūtījumi” skaits un „kavē” nāca no 2 dažādiem pieprasījumiem
 * (dažādos brīžos → skaitlis/krāsa lēca), un pēc pārlādes žetons pazuda līdz atbildei.
 * Tagad: pēdējā zināmā vērtība no sessionStorage uzreiz pēc montēšanas, viens pieprasījums uz URL,
 * visi abonenti saņem to pašu atbildi; kļūdas gadījumā vērtība netiek nomesta uz 0.
 */
type CountData = Record<string, number>;
const countStore = new Map<string, { data: CountData | null; inflight: Promise<void> | null; subs: Set<() => void> }>();
const SS_PREFIX = "admin-badge:";

function countEntry(url: string) {
  let e = countStore.get(url);
  if (!e) {
    e = { data: null, inflight: null, subs: new Set() };
    try {
      const raw = window.sessionStorage.getItem(SS_PREFIX + url);
      if (raw) e.data = JSON.parse(raw) as CountData;
    } catch {
      /* nav kritiski */
    }
    countStore.set(url, e);
  }
  return e;
}

function refreshCount(url: string): Promise<void> {
  const e = countEntry(url);
  if (e.inflight) return e.inflight;
  e.inflight = (async () => {
    try {
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!json) return;
      const next: CountData = {};
      for (const [k, v] of Object.entries(json)) {
        if (typeof v === "number" && Number.isFinite(v)) next[k] = Math.max(0, Math.floor(v));
      }
      // Trūkstošs lauks (apakšvaicājums neizdevās) paliek ar iepriekšējo vērtību — nelec uz 0.
      e.data = { ...(e.data ?? {}), ...next };
      try {
        window.sessionStorage.setItem(SS_PREFIX + url, JSON.stringify(next));
      } catch {
        /* nav kritiski */
      }
      e.subs.forEach((f) => f());
    } catch {
      /* žetons nav kritisks — paturam iepriekšējo vērtību */
    } finally {
      e.inflight = null;
    }
  })();
  return e.inflight;
}

function useCount(url: string, key: "openCount" | "unseenCount" | "activeCount" | "overdueCount" | "urgentCount"): number {
  const pathname = usePathname();
  const [n, setN] = useState(0);
  useEffect(() => {
    const e = countEntry(url);
    const sync = () => setN(e.data?.[key] ?? 0);
    sync();
    e.subs.add(sync);
    return () => {
      e.subs.delete(sync);
    };
  }, [url, key]);
  useEffect(() => {
    void refreshCount(url);
    // Fona cilnē nepollējam (telefonā taupa tīklu/bateriju); atgriežoties — focus atjauno.
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCount(url);
    }, 45_000);
    const onFocus = () => void refreshCount(url);
    window.addEventListener("focus", onFocus);
    window.addEventListener("admin-orders-changed", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("admin-orders-changed", onFocus);
    };
  }, [pathname, url]);
  return n;
}

function ordersBadgeTone(badges: { ordersOverdue: number; ordersUrgent: number }) {
  return {
    gray: badges.ordersOverdue === 0 && badges.ordersUrgent === 0,
    warn: badges.ordersOverdue === 0 && badges.ordersUrgent > 0,
  };
}

/** Visi žetoni vienā pieprasījumā (agrāk 3). */
const BADGES_URL = "/api/admin/badges";

function useBadges() {
  const fast = useCount(BADGES_URL, "openCount");
  const partners = useCount(BADGES_URL, "unseenCount");
  const orders = useCount(BADGES_URL, "activeCount");
  const ordersOverdue = useCount(BADGES_URL, "overdueCount");
  const ordersUrgent = useCount(BADGES_URL, "urgentCount");
  return { fast, partners, orders, ordersOverdue, ordersUrgent } as const;
}

/**
 * Žetons (askētisks): tikai skaitlis bez fona — 12px, tabulārie cipari, labajā malā.
 * Nesteidzams: pelēks #6B7280; steidzams: sarkans #DC2626 trekns. Krāsa ar inline stilu,
 * jo admin-ios-theme.css piespiež `span { color: #000 }`.
 * „Pasūtījumi” — pelēks, sarkans tikai ja kāds kavē termiņu.
 */
function Badge({
  n,
  dot = false,
  gray = false,
  warn = false,
}: {
  n: number;
  dot?: boolean;
  gray?: boolean;
  warn?: boolean;
}) {
  if (n <= 0) return null;
  const color = gray ? "#6B7280" : warn ? "#D97706" : "#DC2626";
  const weight = gray ? 500 : 700;
  if (dot) {
    return (
      <span className="absolute right-1 top-0.5 text-[10px] leading-none tabular-nums" style={{ color, fontWeight: weight }}>
        {n > 99 ? "99+" : n}
      </span>
    );
  }
  return (
    <span className="ml-auto shrink-0 text-right text-[12px] leading-none tabular-nums" style={{ color, fontWeight: weight }}>
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
  const create = useCallback(() => {
    router.push("/admin/iriss/pasutijumi/new");
  }, [router]);
  return { busy: false, create };
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
  const ws = useAdminWorkspace();
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
      {collapsed ? null : (
        <div className="shrink-0 px-2.5 pb-1">
          <WorkspaceSwitch ws={ws} />
        </div>
      )}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 [scrollbar-width:thin]">
        {WS_GROUPS[ws].map((g) => (
          <div key={g.title} className="mt-2 first:mt-0">
            {collapsed ? (
              <div className="mx-auto my-2 h-px w-6 bg-[#e5e5ea] first:hidden" aria-hidden />
            ) : (
              <p className="px-2.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">{g.title}</p>
            )}
            {g.items.map((it) => {
              const on = it.match(pathname);
              const n = it.badge ? badges[it.badge] : 0;
              const tone = it.badge === "orders" ? ordersBadgeTone(badges) : { gray: false, warn: false };
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
                  {collapsed ? <Badge n={n} dot gray={tone.gray} warn={tone.warn} /> : <><span className="min-w-0 flex-1 truncate">{it.label}</span><Badge n={n} gray={tone.gray} warn={tone.warn} />{it.plus ? <span className="w-6 shrink-0" aria-hidden /> : null}</>}
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
        {ws === "iriss" && !collapsed ? <IrissPavadzimesSidebarCard /> : null}
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

/** Mobilā apakšējā cilņu josla: 4 iPhone cilnes. PRO/IRISS centrs ir „Vairāk”. */
export function AdminMobileTabBar({ workspace: workspaceProp }: { workspace?: AdminWorkspace } = {}) {
  const pathname = usePathname() || "";
  const workspaceFromPath = useAdminWorkspace();
  const workspace = workspaceProp ?? workspaceFromPath;
  const badges = useBadges();
  const offer = useNewIrissOffer();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [pathname]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [more]);

  const irissTabs: Item[] = [
    I_HOME,
    { ...I_LIST, label: "Sludinājumi" },
    I_SCAN,
  ];
  const proTabs: Item[] = [SAKUMS, VIN, { ...FAST, label: "Ātrie" }];
  const tabs: Item[] = workspace === "iriss" ? irissTabs : proTabs;
  const inTabs = tabs.some((t) => t.match(pathname));
  const moreBadge = workspace === "iriss" ? badges.fast + badges.partners + badges.orders : badges.partners + badges.fast;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-[35] flex h-[calc(49px+env(safe-area-inset-bottom,0px))] border-t border-[#e5e5ea] bg-[rgba(249,249,249,0.94)] pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
        aria-label="Galvenā izvēlne"
      >
        {tabs.map((t) => {
          const on = t.match(pathname) && !more;
          const n = t.badge ? badges[t.badge] : 0;
          const tone = t.badge === "orders" ? ordersBadgeTone(badges) : { gray: false, warn: false };
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`admin-nav-link relative flex h-[49px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] pt-0.5 text-[10px] font-medium ${
                on ? "text-[var(--color-provin-accent)]" : "text-[#8e8e93]"
              }`}
            >
              <span className="relative">
                <Icon className="h-[26px] w-[26px]" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
                {n > 0 ? (
                  <span className="absolute -right-3.5 -top-0.5">
                    <Badge n={n} gray={tone.gray} warn={tone.warn} dot />
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate px-0.5 leading-none">{t.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className={`relative flex h-[49px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] pt-0.5 text-[10px] font-medium ${
            !inTabs || more ? "text-[var(--color-provin-accent)]" : "text-[#8e8e93]"
          }`}
          aria-expanded={more}
          aria-label="Vairāk"
        >
          <span className="relative">
            <MoreHorizontal className="h-[26px] w-[26px]" aria-hidden />
            {moreBadge > 0 ? (
              <span className="absolute -right-3.5 -top-0.5">
                <Badge n={moreBadge} dot />
              </span>
            ) : null}
          </span>
          <span className="leading-none">Vairāk</span>
        </button>
      </nav>
      {more ? (
        <div
          className="fixed inset-x-0 top-0 z-[34] flex flex-col bg-[#f2f2f7] md:hidden"
          style={{ bottom: "var(--admin-tabbar-h, 49px)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Vairāk"
        >
          <div className="flex shrink-0 items-end justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
            <h1 className="text-[34px] font-bold leading-none tracking-tight text-[var(--color-apple-text)]">Vairāk</h1>
            <button type="button" onClick={() => setMore(false)} className="pb-1 text-[17px] font-medium text-[var(--color-provin-accent)]">
              Aizvērt
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            <div className="mb-2">
              <WorkspaceSwitch ws={workspace} />
            </div>
            {WS_GROUPS[workspace].map((g) => (
              <div key={g.title}>
                <p className="px-1 pb-1 pt-3 text-[13px] font-normal uppercase tracking-[0.04em] text-[#8e8e93]">{g.title}</p>
                <div className="overflow-hidden rounded-xl bg-white">
                  {g.items.map((it) => {
                    const on = it.match(pathname);
                    const n = it.badge ? badges[it.badge] : 0;
                    const tone = it.badge === "orders" ? ordersBadgeTone(badges) : { gray: false, warn: false };
                    const Icon = it.icon;
                    return (
                      <div key={it.href} className="relative border-b border-[#e5e5ea] last:border-b-0">
                      <Link href={it.href} onClick={() => setMore(false)} className={`admin-nav-link flex min-h-11 items-center gap-3 px-3 py-2 text-[17px] ${on ? "font-semibold text-[var(--color-provin-accent)]" : "text-[var(--color-apple-text)]"}`}>
                        <span className="grid h-[29px] w-[29px] place-items-center rounded-[7px] bg-[#f2f2f7]">
                          <Icon className={`h-[18px] w-[18px] ${on ? "" : "text-[#8e8e93]"}`} aria-hidden />
                        </span>
                        <span className="flex-1">{it.label}</span>
                        <Badge n={n} gray={tone.gray} warn={tone.warn} />
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
            <button type="button" onClick={() => void logout()} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-[17px] text-red-600">
              <LogOut className="h-4 w-4" aria-hidden /> {L.logout}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
