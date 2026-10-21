"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminMobileCountBadge, AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import type { ProHomeSummary, ProHomeTile } from "@/lib/admin-pro-home";
import { formatAdminMobileDeadlineTag, type AdminMobileIconName } from "@/lib/admin-mobile-ds";

type Counts = { proHome: ProHomeSummary; openCount: number; unseenCount: number; activeCount: number };

type MenuItem = { href: string; label: string; icon: AdminMobileIconName; badge?: "orders" | "fast" | "partners" };

const GROUPS: MenuItem[][] = [
  [
    { href: "/admin/dashboard", label: "Pasūtījumi", icon: "pasutijumi", badge: "orders" },
    { href: "/admin/vin-scan", label: "VIN pārbaude", icon: "vinParbaude" },
    { href: "/admin/atras-vertesanas", label: "Ātrie vērtējumi", icon: "atrie", badge: "fast" },
    { href: "/admin/kopsavilkums", label: "Rīta kopsavilkums", icon: "rits" },
  ],
  [
    { href: "/admin/partneri", label: "Partneri", icon: "partneri", badge: "partners" },
    { href: "/admin/b2b-demo", label: "Demo dīleri", icon: "dileri" },
    { href: "/admin/izmaksas", label: "Izmaksas", icon: "rekini" },
  ],
  [
    { href: "/admin/blogs", label: "Blogs", icon: "labot" },
    { href: "/admin/agregatu-zinasanas", label: "Agregātu zināšanas", icon: "iestatijumi" },
    { href: "/admin/statistika", label: "Statistika", icon: "statistika" },
    { href: "/admin/teksti", label: "Teksti", icon: "komentars" },
  ],
];

const DESKTOP_MQ = "(min-width: 768px)";

/** "tuvākais 18 h" (vēl nekavētais). Kavētos rāda atsevišķi sarkanā rindā. */
function deadlineLabel(tile: ProHomeTile | undefined): { text: string; tone: string } {
  if (!tile || tile.count === 0) return { text: "nav aktīvu", tone: "muted" };
  if (tile.nextDeadlineFromUnix == null) return { text: "", tone: "muted" };
  const tag = formatAdminMobileDeadlineTag(tile.nextDeadlineFromUnix);
  return { text: `tuvākais ${tag.label.replace(/^Atlikušas /, "")}`, tone: tag.tone };
}

function Tile({ href, title, count, sub, tone, overdue }: { href: string; title: string; count: number | null; sub: string; tone: string; overdue?: number }) {
  return (
    <Link href={href} className={`admin-nav-link pro-home-tile tone-${tone}`}>
      <span className="t">{title}</span>
      <span className="n">{count == null ? "…" : count}</span>
      {overdue ? <span className="o">{overdue} kavē</span> : null}
      {sub ? <span className="s">{sub}</span> : null}
    </Link>
  );
}

/** Tāds pats sākums kā IRISS zonā: augšā svarīgākie paziņojumi ar atlikušo laiku, zem tiem sadaļas. */
export function ProMobileMenuHome() {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const go = () => {
      if (mq.matches) router.replace("/admin/dashboard");
    };
    go();
    mq.addEventListener("change", go);
    return () => mq.removeEventListener("change", go);
  }, [router]);

  useEffect(() => {
    let off = false;
    void fetch("/api/admin/badges", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: Partial<Counts> | null) => {
        if (off || !json?.proHome) return;
        setCounts({
          proHome: json.proHome,
          openCount: Number(json.openCount) || 0,
          unseenCount: Number(json.unseenCount) || 0,
          activeCount: Number(json.activeCount) || 0,
        });
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, []);

  const orders = deadlineLabel(counts?.proHome.orders);
  const dealers = deadlineLabel(counts?.proHome.dealers);
  const badgeOf = (b?: MenuItem["badge"]) =>
    !counts || !b ? 0 : b === "orders" ? counts.activeCount : b === "fast" ? counts.openCount : counts.unseenCount;

  return (
    <div className="pro-mobile-menu-home pb-4 md:hidden">
      <AdminMobileTopBar title="PRO" subtitle="Izvēlies sadaļu. Augšā svarīgākais šobrīd." />
      <div className="px-4">
        <section className="pro-home-now" aria-label="Šobrīd">
          <Tile
            href="/admin/dashboard"
            title="Pasūtījumi"
            count={counts ? counts.proHome.orders.count : null}
            sub={orders.text}
            tone={orders.tone}
            overdue={counts?.proHome.orders.overdue}
          />
          <Tile
            href="/admin/dashboard"
            title="Dīleri"
            count={counts ? counts.proHome.dealers.count : null}
            sub={dealers.text}
            tone={dealers.tone}
            overdue={counts?.proHome.dealers.overdue}
          />
          <Tile
            href="/admin/atras-vertesanas"
            title="Ātrie"
            count={counts ? counts.openCount : null}
            sub={counts && counts.openCount > 0 ? "neatbildēti" : "viss atbildēts"}
            tone={counts && counts.openCount > 0 ? "urgent" : "muted"}
          />
        </section>
        <div className="flex flex-col gap-3 pt-3">
          {GROUPS.map((group) => (
            <div key={group[0]!.href} className="overflow-hidden rounded-[14px] bg-[var(--surface,#fff)] shadow-[var(--am-card-shadow)]">
              {group.map((item) => {
                const n = badgeOf(item.badge);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="admin-nav-link flex min-h-11 items-center gap-3 border-b border-[var(--line,#e5e5ea)] px-4 last:border-b-0"
                  >
                    <AdminMobileIcon name={item.icon} className="h-5 w-5 text-[var(--label-secondary)]" />
                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[var(--label)]">{item.label}</span>
                    {n > 0 ? <AdminMobileCountBadge n={n} /> : null}
                    <AdminMobileIcon name="uzPrieksu" className="h-4 w-4 text-[var(--am-ink3)]" />
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
