"use client";

import {
  BarChart3,
  Building2,
  Car,
  ChevronsLeft,
  ChevronsRight,
  Cog,
  Euro,
  Factory,
  FileText,
  Handshake,
  Home,
  MessagesSquare,
  List,
  LogOut,
  PenLine,
  Plus,
  Radar,
  ScanLine,
  Search,
  Settings,
  Sun,
  Tag,
  Truck,
  Wallet,
  Warehouse,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IrissPavadzimesSidebarCard } from "@/components/admin/IrissPavadzimesSidebarCard";
import { IrissLimitsSidebarCard, useIrissLimits } from "@/components/admin/IrissLimitsSidebarCard";
import { IrissProjectIndicator } from "@/components/admin/IrissProjectIndicator";
import { useAdminClientReady, useAdminMobileViewport } from "@/components/admin/useAdminMobileViewport";
import { adminChromeDataset } from "@/lib/admin-chrome-attrs";
import { isModifiedClick } from "@/lib/admin-motion";
import { requestAdminGlobalSearch } from "@/lib/admin-global-search";
import { finiteBadgeCount } from "@/lib/admin-sidebar-badge";
import {
  ADMIN_DESKTOP_BADGE_POLL_MS,
  ADMIN_MOBILE_BADGE_POLL_MS,
  scheduleAdminIdleWork,
} from "@/lib/admin-mobile-shell";
import { ADMIN_MOBILE_TABBAR_DOCK_NAV } from "@/lib/admin-mobile-shell";
import { AdminBodyPortal } from "@/components/admin/AdminBodyPortal";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { AdminMobileCountBadge, AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import type { AdminMobileIconName } from "@/lib/admin-mobile-ds";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { useAdminMobileColorScheme } from "@/components/admin/useAdminMobileViewport";

/** Variants A: grupēta kreisā sānjosla visiem admin paneļiem (PRO + IRISS). Mobilajā — apakšējā cilņu josla + „Vairāk”. */

type Item = { href: string; label: string; icon: LucideIcon; badge?: "fast" | "partners" | "orders" | "irissMatches" | "irissLogistics"; plus?: boolean; match: (p: string) => boolean };
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
  groupOps: "Pārvaldība",
  orders: "Pasūtījumi",
  morning: "Rīta kopsavilkums",
  vinScan: "VIN pārbaude",
  dealerCheck: "Dīlera dati",
  fast: "Ātrie vērtējumi",
  irissMenu: "Sākums",
  irissHome: "Pasūtījumi",
  irissNew: "Jauns pasūtījums",
  irissOffers: "Piedāvājumi",
  irissScan: "Radars",
  irissLogistics: "Loģistika",
  irissAutoparks: "Autoparks",
  irissList: "Sludinājumi",
  irissReport: "Mēneša atskaite",
  irissWaybills: "Pavadzīmes",
  irissSettings: "Iestatījumi",
  blogs: "Blogs",
  aggregates: "Agregāti",
  stats: "Statistika",
  templates: "Tekstu šabloni",
  invoices: "Rēķini",
  partners: "Partneri",
  demoDealers: "Demo dīleri",
  costs: "Izmaksas",
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
/** PRO sākuma izvēlne (telefons): paziņojumi + sadaļas. Datorā atver Pasūtījumus. */
const PRO_MENU: Item = { href: "/admin/pro", label: "Sākums", icon: Home, match: (p) => p === "/admin/pro" || p === "/admin/pro/" };
const MORNING: Item = { href: "/admin/kopsavilkums", label: L.morning, icon: Sun, match: starts("/admin/kopsavilkums") };
const FAST: Item = { href: "/admin/atras-vertesanas", label: L.fast, icon: Zap, badge: "fast", match: starts("/admin/atras-vertesanas") };
const VIN: Item = { href: "/admin/vin-scan", label: L.vinScan, icon: ScanLine, match: starts("/admin/vin-scan") };
const DEALER_CHECK: Item = {
  href: "/admin/dilera-dati",
  label: L.dealerCheck,
  icon: Factory,
  match: starts("/admin/dilera-dati"),
};
const PARTNERI: Item = { href: "/admin/partneri", label: L.partners, icon: Handshake, badge: "partners", match: starts("/admin/partneri") };
const DEMO_DILERI: Item = { href: "/admin/b2b-demo", label: L.demoDealers, icon: Building2, match: starts("/admin/b2b-demo") };
const IZMAKSAS: Item = { href: "/admin/izmaksas", label: L.costs, icon: Wallet, match: starts("/admin/izmaksas") };
const I_IZMAKSAS: Item = { href: "/admin/iriss/izmaksas", label: L.costs, icon: Wallet, match: starts("/admin/iriss/izmaksas") };
const I_MENU: Item = {
  href: "/admin/iriss",
  label: L.irissMenu,
  icon: Home,
  match: (p) => p === "/admin/iriss" || p === "/admin/iriss/",
};
const I_HOME: Item = { href: "/admin/iriss/pasutijumi", label: L.irissHome, icon: Car, plus: true, match: starts("/admin/iriss/pasutijumi") };
/** j70: tikai Admin (AdminSidebar darbiniekiem netiek rādīts). Q13 badge vēl atvērts - nav pievienots. */
const I_PIEDAVAJUMI: Item = { href: "/admin/iriss/piedavajumi", label: L.irissOffers, icon: Tag, match: starts("/admin/iriss/piedavajumi") };
const I_SCAN: Item = { href: "/admin/iriss/scan", label: L.irissScan, icon: Radar, match: starts("/admin/iriss/scan") };
const I_LOGISTICS: Item = {
  href: "/admin/iriss/logistika",
  label: L.irissLogistics,
  icon: Truck,
  match: starts("/admin/iriss/logistika"),
};
const I_AUTOPARKS: Item = { href: "/admin/iriss/autoparks", label: L.irissAutoparks, icon: Warehouse, match: starts("/admin/iriss/autoparks") };
const I_WAYBILLS: Item = { href: "/admin/iriss/pavadzimes", label: L.irissWaybills, icon: FileText, match: starts("/admin/iriss/pavadzimes") };
/** IRISS izvēlnē skaitļu nav (Nils 26.10: "99+" traucē) - jaunumi redzami pašā sadaļā. Mēneša atskaite izvēlnē paslēpta, lapa paliek. */
const I_LIST: Item = { href: "/admin/iriss/sludinajumi", label: L.irissList, icon: List, match: starts("/admin/iriss/sludinajumi") };
const I_SETTINGS: Item = { href: "/admin/iriss/iestatijumi", label: L.irissSettings, icon: Settings, match: starts("/admin/iriss/iestatijumi") };

/** Tā pati VIN pārbaudes lapa arī IRISS izvēlnē (dublēts ieraksts). */
const I_VIN: Item = { ...VIN, label: L.vinScan };

export const ADMIN_NAV_GROUPS: Group[] = [
  { title: L.groupPro, items: [MORNING, SAKUMS, VIN, DEALER_CHECK, FAST] },
  { title: L.groupIriss, items: [I_MENU, I_HOME, I_PIEDAVAJUMI, I_LIST, I_SCAN, I_LOGISTICS, I_AUTOPARKS, I_VIN, I_WAYBILLS, I_SETTINGS] },
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
      DEMO_DILERI,
    ],
  },
  { title: L.groupOps, items: [IZMAKSAS] },
];

/** PRO un IRISS izvēlnes nejaucas: katrai darba zonai savas grupas. */
export type AdminWorkspace = "pro" | "iriss";
const WS_GROUPS: Record<AdminWorkspace, Group[]> = {
  pro: ADMIN_NAV_GROUPS.filter((g) => g.title !== L.groupIriss),
  /** IRISS: Pārvaldība starp Iestatījumi un Pavadzīmes (sānjoslas kartītes). */
  iriss: [
    { title: L.groupIriss, items: [I_MENU, I_HOME, I_PIEDAVAJUMI, I_LIST, I_SCAN, I_LOGISTICS, I_AUTOPARKS, I_VIN, I_WAYBILLS, I_SETTINGS] },
    { title: L.groupOps, items: [I_IZMAKSAS] },
  ],
};
export const ADMIN_WS_COOKIE = "admin_ws";
/** Lapas, kas pieder abām zonām — zonu nosaka pēdējā izvēle. */
const SHARED_PATHS = ["/admin/vin-scan"];

function readWsCookie(): AdminWorkspace | null {
  if (typeof document === "undefined") return null;
  const m = /(?:^|; )admin_ws=(pro|iriss)/.exec(document.cookie);
  return m ? (m[1] as AdminWorkspace) : null;
}
export function writeWsCookie(ws: AdminWorkspace) {
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
      on ? "bg-white text-[var(--color-apple-text)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#636366] hover:text-[var(--color-apple-text)]"
    }`;
  return (
    <div className="flex gap-0.5 rounded-lg bg-[#f2f2f7] p-0.5" role="group" aria-label="Darba zona">
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
/** Sānjosla datorā bez sava scroll: pavadzīmes tikai 2, pārējās caur "Visas ›". */
const IRISS_SIDEBAR_WAYBILL_LIMIT = 2;

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

const badgePollRefs = new Map<string, number>();

function useCountValue(url: string, key: "openCount" | "unseenCount" | "activeCount" | "overdueCount" | "urgentCount" | "irissMatchCount" | "irissLogisticsCount"): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const e = countEntry(url);
    const sync = () => {
      setN(finiteBadgeCount(e.data?.[key]));
    };
    sync();
    e.subs.add(sync);
    return () => {
      e.subs.delete(sync);
    };
  }, [url, key]);
  return n;
}

function useBadgeUrlPolling(url: string) {
  const pathname = usePathname();
  const mobile = useAdminMobileViewport();
  const ready = useAdminClientReady();
  useEffect(() => {
    if (!ready) return;
    const prev = badgePollRefs.get(url) ?? 0;
    badgePollRefs.set(url, prev + 1);
    if (prev === 0) {
      const pollMs = mobile ? ADMIN_MOBILE_BADGE_POLL_MS : ADMIN_DESKTOP_BADGE_POLL_MS;
      let t = 0;
      const startPolling = () => {
        void refreshCount(url);
        t = window.setInterval(() => {
          if (document.visibilityState === "visible") void refreshCount(url);
        }, pollMs);
      };
      const cancelIdle = mobile ? scheduleAdminIdleWork(startPolling) : (startPolling(), () => undefined);
      const onFocus = () => void refreshCount(url);
      window.addEventListener("focus", onFocus);
      window.addEventListener("admin-orders-changed", onFocus);
      window.addEventListener("admin-iriss-matches-changed", onFocus);
      return () => {
        cancelIdle();
        window.clearInterval(t);
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("admin-orders-changed", onFocus);
        window.removeEventListener("admin-iriss-matches-changed", onFocus);
        const left = (badgePollRefs.get(url) ?? 1) - 1;
        if (left <= 0) badgePollRefs.delete(url);
        else badgePollRefs.set(url, left);
      };
    }
    return () => {
      const left = (badgePollRefs.get(url) ?? 1) - 1;
      if (left <= 0) badgePollRefs.delete(url);
      else badgePollRefs.set(url, left);
    };
  }, [mobile, pathname, ready, url]);
}

function ordersBadgeTone(badges: { ordersOverdue: number; ordersUrgent: number }) {
  return {
    gray: badges.ordersOverdue === 0 && badges.ordersUrgent === 0,
    warn: badges.ordersOverdue === 0 && badges.ordersUrgent > 0,
  };
}

function navBadgeTone(kind: Item["badge"], badges: { ordersOverdue: number; ordersUrgent: number }) {
  if (kind === "orders") return ordersBadgeTone(badges);
  if (kind === "irissMatches") return { gray: true, warn: false };
  if (kind === "irissLogistics") return { gray: true, warn: false };
  return { gray: false, warn: false };
}

/** Visi žetoni vienā pieprasījumā (agrāk 3). */
const BADGES_URL = "/api/admin/badges";

function useBadges() {
  useBadgeUrlPolling(BADGES_URL);
  const fast = useCountValue(BADGES_URL, "openCount");
  const partners = useCountValue(BADGES_URL, "unseenCount");
  const orders = useCountValue(BADGES_URL, "activeCount");
  const ordersOverdue = useCountValue(BADGES_URL, "overdueCount");
  const ordersUrgent = useCountValue(BADGES_URL, "urgentCount");
  const irissMatches = useCountValue(BADGES_URL, "irissMatchCount");
  const irissLogistics = useCountValue(BADGES_URL, "irissLogisticsCount");
  return { fast, partners, orders, ordersOverdue, ordersUrgent, irissMatches, irissLogistics } as const;
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
export function AdminSidebar({
  collapsed,
  onToggle,
  workspace: workspaceProp,
}: {
  collapsed: boolean;
  onToggle: () => void;
  workspace?: AdminWorkspace;
}) {
  const pathname = usePathname() || "";
  const badges = useBadges();
  const offer = useNewIrissOffer();
  const wsFromPath = useAdminWorkspace();
  const ws = workspaceProp ?? wsFromPath;
  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-[#e5e5ea] bg-white transition-[width] duration-200 md:flex ${collapsed ? "w-[64px]" : "w-[232px]"}`}
      aria-label="Galvenā izvēlne"
      data-iriss-nav=""
    >
      <div className={`flex h-12 shrink-0 items-center ${collapsed ? "justify-center" : "justify-between gap-2 pl-5 pr-2"}`}>
        {collapsed ? null : (
          <>
            <Link href="/admin/dashboard" className="admin-nav-link min-w-0 truncate text-[15px] font-bold tracking-tight text-[var(--color-apple-text)]">
              PROVIN
            </Link>
            {ws === "iriss" ? (
              <>
                <span className="min-w-0 flex-1" aria-hidden />
                <IrissProjectIndicator />
              </>
            ) : null}
          </>
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
        <button
          type="button"
          onClick={() => requestAdminGlobalSearch()}
          title="Meklēt"
          aria-label="Meklēt"
          className={`admin-nav-link mb-1 flex h-9 w-full items-center gap-2.5 rounded-lg text-[13.5px] text-[var(--color-apple-text)] transition hover:bg-black/[0.04] ${collapsed ? "justify-center" : "px-2.5"}`}
        >
          <Search className="h-[17px] w-[17px] shrink-0 text-[#8e8e93]" strokeWidth={2} aria-hidden />
          {collapsed ? null : <span className="min-w-0 flex-1 truncate">Meklēt</span>}
        </button>
        {WS_GROUPS[ws].map((g) => (
          <div key={g.title} className="mt-2 first:mt-0">
            {collapsed ? (
              <div className="mx-auto my-2 h-px w-6 bg-[#e5e5ea] first:hidden" aria-hidden />
            ) : (
              <p className="px-2.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">{g.title}</p>
            )}
            {g.items.filter((it) => it !== I_MENU).map((it) => {
              const on = it.match(pathname);
              const n = it.badge ? badges[it.badge] : 0;
              const tone = navBadgeTone(it.badge, badges);
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
        {ws === "iriss" && !collapsed ? <IrissPavadzimesSidebarCard limit={IRISS_SIDEBAR_WAYBILL_LIMIT} /> : null}
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

function CapsuleGlyph({ name }: { name: "sakums" | "vairak" | "meklet" }) {
  if (name === "sakums") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
        <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />
      </svg>
    );
  }
  if (name === "vairak") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
        <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

const MORE_ROW_ICON: Record<string, AdminMobileIconName> = {
  "/admin/kopsavilkums": "rits",
  "/admin/dashboard": "pasutijumi",
  "/admin/vin-scan": "vinParbaude",
  "/admin/atras-vertesanas": "atrie",
  "/admin/commission-invoice": "rekini",
  "/admin/partneri": "partneri",
  "/admin/b2b-demo": "dileri",
  "/admin/blogs": "labot",
  "/admin/agregatu-zinasanas": "iestatijumi",
  "/admin/statistika": "statistika",
  "/admin/teksti": "komentars",
  "/admin/iriss": "atzime",
  "/admin/iriss/pasutijumi": "pasutijumi",
  "/admin/iriss/piedavajumi": "pdf",
  "/admin/iriss/sludinajumi": "sludinajums",
  "/admin/iriss/scan": "radars",
  "/admin/iriss/logistika": "logistika",
  "/admin/iriss/autoparks": "avatar",
  "/admin/iriss/atskaite": "atskaite",
  "/admin/iriss/pavadzimes": "pavadzimes",
  "/admin/iriss/iestatijumi": "iestatijumi",
  "/admin/izmaksas": "rekini",
  "/admin/iriss/izmaksas": "rekini",
};

/** Mobilā apakšējā josla: peldoša C kapsula ar 3 ikonām (Sākums, Vairāk, Meklēt). */
export function AdminMobileTabBar({ workspace: workspaceProp }: { workspace?: AdminWorkspace } = {}) {
  const pathname = usePathname() || "";
  const workspaceFromPath = useAdminWorkspace();
  const workspace = workspaceProp ?? workspaceFromPath;
  const badges = useBadges();
  const [more, setMore] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const limits = useIrissLimits();
  const theme = useAdminMobileColorScheme();
  useAdminScrollLock(more || limitsOpen);

  /**
   * Cilne, uz kuru lietotājs tikko pieskārās. Atzīme pārvietojas uzreiz, kamēr serveris gatavo lapu.
   * Agrāk te bija view transition ap router.push: animācija sākās pirms navigācijas, tās laikā lapa
   * nereaģēja uz pieskārieniem, un saturs nomainījās vēlāk zem pirksta (Nils 21.10: "atveras cita sadaļa").
   */
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => {
    setMore(false);
    setPendingHref(null);
  }, [pathname]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [more]);

  const home = workspace === "iriss" ? I_MENU : PRO_MENU;
  const tabHrefs = new Set([home.href]);
  const shownPath = pendingHref ?? pathname;
  const moreGroups = WS_GROUPS[workspace].map((g) => ({
    ...g,
    items: g.items.filter((it) => !tabHrefs.has(it.href)),
  })).filter((g) => g.items.length > 0);
  const moreBadge = moreGroups.reduce((sum, g) => sum + g.items.reduce((s, it) => s + (it.badge ? badges[it.badge] : 0), 0), 0);
  const onHome = home.match(shownPath) && !more;

  const tabClass = (on: boolean) =>
    `admin-nav-link relative z-[1] flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full ${
      on ? "bg-black/[0.06] text-[#1c1c1e]" : "text-[#8e8e93]"
    }`;

  return (
    <>
      <nav className={ADMIN_MOBILE_TABBAR_DOCK_NAV} aria-label="Galvenā izvēlne">
          <Link
            href={home.href}
            aria-label="Sākums"
            aria-current={onHome ? "page" : undefined}
            className={tabClass(onHome)}
            onClick={(e) => {
              if (isModifiedClick(e)) return;
              setMore(false);
              setPendingHref(home.href);
            }}
          >
            <CapsuleGlyph name="sakums" />
          </Link>
          <button type="button" onClick={() => setMore((v) => !v)} className={tabClass(more)} aria-expanded={more} aria-label="Vairāk">
            <span className="relative">
              <CapsuleGlyph name="vairak" />
              {moreBadge > 0 ? <AdminMobileCountBadge n={moreBadge} floating /> : null}
            </span>
          </button>
          <button type="button" onClick={() => requestAdminGlobalSearch()} className={tabClass(false)} aria-label="Meklēt">
            <CapsuleGlyph name="meklet" />
          </button>
      </nav>
      {more ? (
        <AdminBodyPortal>
          <div
            className="admin-m pointer-events-auto fixed inset-0 z-[20] flex flex-col md:hidden"
            {...adminChromeDataset(workspace, theme)}
            role="dialog"
            aria-modal="true"
            aria-label="Vairāk"
          >
            <div className="am-overlay relative z-[20] flex min-h-0 flex-1 flex-col bg-[var(--bg)] pb-[calc(64px+16px+env(safe-area-inset-bottom,0px))]">
              <header className="am-topbar px-4 pb-3 pt-[max(10px,env(safe-area-inset-top))]">
                <h1 className="text-[34px] font-bold leading-none tracking-tight text-[var(--label)]">Vairāk</h1>
                <div className="relative mt-3 flex h-11 rounded-full bg-[var(--am-fill)] p-0.5" role="group" aria-label="Darba zona">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-[var(--am-s1)] shadow-sm"
                    style={{
                      transform: workspace === "iriss" ? "translateX(100%)" : "translateX(0)",
                      transition: "transform var(--d-std) var(--ease-out)",
                    }}
                  />
                  <Link
                    href="/admin/dashboard"
                    onClick={() => {
                      writeWsCookie("pro");
                      setMore(false);
                    }}
                    className={`relative z-[1] flex h-full flex-1 items-center justify-center rounded-full text-[12px] font-semibold ${
                      workspace === "pro" ? "text-[var(--am-ink)]" : "text-[var(--am-ink2)]"
                    }`}
                  >
                    PRO
                  </Link>
                  <Link
                    href="/admin/iriss"
                    onClick={() => {
                      writeWsCookie("iriss");
                      setMore(false);
                    }}
                    className={`relative z-[1] flex h-full flex-1 items-center justify-center rounded-full text-[12px] font-semibold ${
                      workspace === "iriss" ? "text-[var(--am-ink)]" : "text-[var(--am-ink2)]"
                    }`}
                  >
                    IRISS
                  </Link>
                </div>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4">
                {moreGroups.map((g) => (
                  <div key={g.title}>
                    {g.title === L.groupPro || g.title === L.groupIriss ? null : (
                      <p className="px-1 pb-1 pt-4 text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--am-ink2)]">{g.title}</p>
                    )}
                    <div className="overflow-hidden rounded-[22px] bg-[var(--am-s1)] shadow-[var(--am-card-shadow)]">
                      {g.items.map((it) => {
                        const n = it.badge ? badges[it.badge] : 0;
                        const icon = MORE_ROW_ICON[it.href] ?? "uzPrieksu";
                        return (
                          <Link
                            key={it.href}
                            href={it.href}
                            onClick={() => setMore(false)}
                            className="admin-nav-link flex min-h-[50px] items-center gap-3 border-b border-[var(--am-hair)] px-4 last:border-b-0"
                          >
                            <AdminMobileIcon name={icon} className="h-5 w-5 text-[var(--am-ink2)]" />
                            <span className="min-w-0 flex-1 truncate text-[16px] text-[var(--am-ink)]">{it.label}</span>
                            <AdminMobileCountBadge n={n} />
                            <AdminMobileIcon name="uzPrieksu" className="h-4 w-4 text-[var(--am-ink3)]" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {workspace === "iriss" && limits ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMore(false);
                      setLimitsOpen(true);
                    }}
                    className="mt-4 flex h-[50px] w-full items-center gap-3 rounded-[22px] bg-[var(--am-s1)] px-4 text-[16px] text-[var(--am-ink)] shadow-[var(--am-card-shadow)]"
                  >
                    LIMITI
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="mt-4 flex h-[50px] w-full items-center gap-3 rounded-[22px] bg-[var(--am-s1)] px-4 text-[16px] text-[var(--am-ink)] shadow-[var(--am-card-shadow)]"
                >
                  <AdminMobileIcon name="iziet" className="h-5 w-5 text-[var(--am-ink2)]" />
                  {L.logout}
                </button>
              </div>
            </div>
          </div>
        </AdminBodyPortal>
      ) : null}
      <AdminMobileSheet
        open={Boolean(limitsOpen && limits)}
        title="LIMITI"
        onClose={() => setLimitsOpen(false)}
        opaque
      >
        <IrissLimitsSidebarCard data={limits} />
      </AdminMobileSheet>
    </>
  );
}
