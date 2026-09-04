"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { homeContentMaxClass } from "@/lib/home-layout";

const NAV = [
  { href: "/partneriem/konts", key: "navHome" as const },
  { href: "/partneriem/konts/pasutijumi", key: "navArchive" as const },
  { href: "/partneriem/konts/rekviziti", key: "navRequisites" as const },
];

function isNavActive(href: string, pathname: string): boolean {
  if (href === "/partneriem/konts") return pathname === "/partneriem/konts";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function B2bPartnerAccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Partner");
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partner/me", { credentials: "include" });
        if (!res.ok) {
          router.replace("/partneriem");
          return;
        }
        if (!cancelled) setReady(true);
      } catch {
        router.replace("/partneriem");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return null;

  return (
    <div className="px-4 pb-10 pt-5 sm:px-6 sm:pb-14 sm:pt-6 lg:pb-16">
      <div className={homeContentMaxClass}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-white/10 pb-3">
          <nav className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2" aria-label={t("accountNavAria")}>
            {NAV.map((item) => {
              const active = isNavActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-100"
                      : "text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200"
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            className="shrink-0 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200"
            onClick={() => {
              void fetch("/api/partner/session", { method: "DELETE", credentials: "include" }).catch(() => {});
              router.push("/partneriem");
            }}
          >
            {t("signOut")}
          </button>
        </div>
        <div className="pt-8">{children}</div>
      </div>
    </div>
  );
}
