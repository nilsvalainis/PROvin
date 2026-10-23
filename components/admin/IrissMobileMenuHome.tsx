"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IrissKomandaAivaramChat } from "@/components/admin/IrissKomandaAivaramChat";
import { IrissWaybillRequestArchive } from "@/components/admin/IrissWaybillMobileForm";
import { AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { MenuGrid } from "@/components/admin/mobile/MenuGrid";
import { renderIrissWidget } from "@/components/admin/mobile/MenuWidgetContent";
import { IRISS_DEFAULT_LAYOUT_IDS, irissMenuCatalog } from "@/lib/admin-menu-catalog";
import { IrissWaybillGauges } from "@/components/admin/IrissWaybillGauges";
import { useIrissWaybillPlateStrip } from "@/components/admin/useIrissWaybillPlateStrip";
import {
  cheapIrissMenuCount,
  IRISS_DESKTOP_MEDIA,
  irissDesktopHomeHref,
  irissMobileMenuItemsFor,
  type IrissMobileMenuItem,
} from "@/lib/iriss-mobile-menu";
import { isWaybillOnlyStaff, type IrissSection } from "@/lib/staff-roles";
import { useWaybillPageOpenAtTop } from "@/components/admin/useWaybillPageOpenAtTop";

const noop = () => undefined;

/** Skaitītājs, kas pieaug, atgriežoties lietotnē un ik minūti: skaitļi atjaunojas paši. */
function useRefreshTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", bump);
    const timer = window.setInterval(bump, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", bump);
      window.clearInterval(timer);
    };
  }, []);
  return tick;
}

function useCheapIrissBadgeCounts(enabled: boolean, refreshKey: number): { irissMatches: number; irissLogistics: number } {
  const [counts, setCounts] = useState({ irissMatches: 0, irissLogistics: 0 });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetch("/api/admin/badges", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          irissMatchCount?: number;
          irissLogisticsCount?: number;
        } | null;
        if (cancelled || !res.ok || !json) return;
        setCounts({
          irissMatches: Number(json.irissMatchCount) || 0,
          irissLogistics: Number(json.irissLogisticsCount) || 0,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);
  return counts;
}

/** Izvēlne ir tikai telefonam. Datorā (md+) uzreiz atver pirmo sadaļu (parasti Pasūtījumi). */
function useDesktopRedirect(href: string | null) {
  const router = useRouter();
  useEffect(() => {
    if (!href) return;
    const mq = window.matchMedia(IRISS_DESKTOP_MEDIA);
    const go = () => {
      if (mq.matches) router.replace(href);
    };
    go();
    mq.addEventListener("change", go);
    return () => mq.removeEventListener("change", go);
  }, [href, router]);
}

export function IrissMobileMenuHome({
  sections,
  isAdmin,
}: {
  sections: readonly IrissSection[];
  isAdmin: boolean;
}) {
  const items = irissMobileMenuItemsFor(sections, isAdmin);
  const catalog = useMemo(() => irissMenuCatalog(sections, isAdmin), [sections, isAdmin]);
  /** Partneris (tikai Pavadzīmes): tas pats sākums, bet tikai pavadzīmju logrīks, forma, Arhīvs un Iziet. */
  const waybillOnly = !isAdmin && isWaybillOnlyStaff(sections);
  // Kolēģa pavadzīmju logrīks: atveras augšā (jaunākās augšā), nevis pārlūka atjaunotajā apakšā.
  useWaybillPageOpenAtTop();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  useDesktopRedirect(waybillOnly ? null : irissDesktopHomeHref(items));
  const canReadWaybills = isAdmin || sections.includes("pavadzimes");
  const tick = useRefreshTick();
  const badges = useCheapIrissBadgeCounts(isAdmin, tick);
  const plates = useIrissWaybillPlateStrip(canReadWaybills, tick);
  const counts = {
    irissMatches: badges.irissMatches,
    irissLogistics: badges.irissLogistics,
    waybills: plates.busyCount,
  };

  if (waybillOnly) {
    const logout = async () => {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
      router.replace("/admin/login");
      router.refresh();
    };
    return (
      <div className="iriss-mobile-menu-home pb-[max(16px,env(safe-area-inset-bottom))] md:mx-auto md:max-w-md md:pt-6">
        <AdminMobileTopBar title="IRISS" />
        <div className="px-4">
          <IrissWaybillGauges allHref={null} />
        </div>
        {formOpen ? (
          <div className="mt-4 px-4">
            <IrissKomandaAivaramChat draftVehicle={null} onDraftConsumed={noop} />
          </div>
        ) : (
          <div className="mt-4 px-4">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-[#111827] text-[15px] font-semibold text-white"
            >
              Izveidot pavadzīmi
            </button>
          </div>
        )}
        {archiveOpen ? (
          <div className="mt-4 px-4">
            <IrissWaybillRequestArchive />
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => setArchiveOpen((v) => !v)}
            className="flex min-h-11 items-center px-3 text-[13px] font-medium text-[var(--label-secondary,#5e636e)]"
          >
            Arhīvs
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex min-h-11 items-center px-3 text-[13px] font-medium text-[var(--label-secondary,#5e636e)]"
          >
            Iziet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="iriss-mobile-menu-home pb-4">
      <AdminMobileTopBar title="IRISS" />
      <div className="md:hidden">
        {canReadWaybills ? (
          <div className="px-4">
            <IrissWaybillGauges />
          </div>
        ) : null}
        <MenuGrid
          workspace="iriss"
          catalog={catalog}
          defaultIds={IRISS_DEFAULT_LAYOUT_IDS}
          badgeOf={(item) =>
            item.id === "w-logistika"
              ? badges.irissLogistics
              : item.id === "w-pavadzimes"
                ? plates.busyCount
                : item.id === "w-sludinajumi"
                  ? badges.irissMatches
                  : item.badge
                    ? cheapIrissMenuCount({ badge: item.badge } as IrissMobileMenuItem, counts)
                    : 0
          }
          alertOf={(item) =>
            item.id === "w-pavadzimes" && plates.items.some((w) => w.busy && w.hoursLeft != null && w.hoursLeft <= 12)
          }
          renderWidget={(item, size) =>
            renderIrissWidget(item, size, {
              irissLogistics: badges.irissLogistics,
              irissMatches: badges.irissMatches,
              waybills: plates.items,
              waybillsLoaded: plates.loaded,
              pro: null,
              openCount: 0,
            })
          }
        />
      </div>
      {items.length === 0 ? (
        <p className="hidden px-6 py-8 text-[14px] text-[var(--label-secondary,#5e636e)] md:block">Nav pieejamu sadaļu.</p>
      ) : null}
    </div>
  );
}
