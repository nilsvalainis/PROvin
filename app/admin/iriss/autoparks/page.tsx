import { redirect } from "next/navigation";
import { autoparksV2Perms } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2CanOpen } from "@/lib/iriss-autoparks-v2-perms";
import { requireLogisticsPage } from "@/lib/staff-auth";

export const metadata = {
  title: "Autoparks | IRISS",
};

export const dynamic = "force-dynamic";

/**
 * Nils 27.10: vecā Autoparka versija (v1) dzēsta - saite "Autoparks" vienmēr ved uz Autoparks v2.
 * Lietotājs bez nevienas `ap_*` tiesības redz paskaidrojumu, nevis veco versiju.
 */
export default async function IrissAutoparksPage() {
  const actor = await requireLogisticsPage();
  if (autoparksV2CanOpen(autoparksV2Perms(actor))) redirect("/admin/iriss/autoparks-v2");
  return (
    <div className="mx-auto mt-10 max-w-[420px] rounded-[var(--iriss-r-lg,20px)] bg-[var(--iriss-surface,#fff)] p-6 text-center shadow-sm">
      <h1 className="text-[18px] font-bold text-[var(--iriss-ink)]">Autoparks</h1>
      <p className="mt-2 text-[14px] leading-snug text-[var(--iriss-ink-2)]">
        Tev vēl nav Autoparka tiesību. Administrators tās piešķir sadaļā Iestatījumi - Lietotāji (Autoparks apakšsadaļas).
      </p>
    </div>
  );
}
