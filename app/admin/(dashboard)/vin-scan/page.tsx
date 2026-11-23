import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminAtraParbaudeShell, type AtraDealerInitial } from "@/components/admin/AdminAtraParbaudePage";
import { normalizeVin } from "@/lib/order-field-validation";
import { Suspense } from "react";
import { AdminSourceHealthCompact, type SourceHealthItem } from "@/components/admin/AdminSourceHealthStrip";
import { readSourceHealth } from "@/lib/source-health-store";
import { VIN_SCAN_CATALOG } from "@/lib/vin-scan/catalog";
import { requireIrissSectionPage } from "@/lib/staff-auth";
import { thecarapiVinScanEnabled } from "@/lib/vin-scan/thecarapi-flags";
import { ATRA_TITLE, type AtraSearchParams } from "@/lib/atra-parbaude";
import { currentDealerCheckCreatorId } from "@/lib/dealer-check-actor";
import {
  isSafeDealerCheckId,
  parseDealerCheckSearchPlate,
  parseDealerCheckSearchVin,
  type DealerCheckRecord,
} from "@/lib/dealer-check";
import { prefetchDealerCheckCsdd } from "@/lib/dealer-check-csdd-prefetch";
import type { DealerCheckHistoryEntry } from "@/lib/dealer-check-history";
import { listDealerCheckEntries, readOwnedDealerCheck } from "@/lib/dealer-check-store";

export const metadata = {
  title: ATRA_TITLE,
};

export const dynamic = "force-dynamic";

/**
 * «Ātrā pārbaude» = VIN pārbaude + dīlera dati. URL paliek /admin/vin-scan
 * (/admin/dilera-dati pāradresē šeit ar tiem pašiem parametriem).
 * Darbinieks ar VIN sadaļu redz tikai bezmaksas daļu; maksas (OneAuto, JoJ, Speckr) - tikai admins.
 */
export default async function AdminVinScanPage({ searchParams }: { searchParams?: Promise<AtraSearchParams> }) {
  const actor = await requireIrissSectionPage("vin");
  const sp = searchParams ? await searchParams : undefined;
  const isAdmin = actor.kind === "admin";
  /** LIST kartīte: `/admin/vin-scan?vin=` aizpilda lauku; klients palaiž skenēšanu, ja VIN derīgs. */
  const initialVin = normalizeVin(sp?.vin ?? "");
  const dealer = isAdmin ? await loadDealerInitial(sp) : null;
  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu hideOnPhone>
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          {ATRA_TITLE}
        </h1>
      </AdminDashboardHeaderWithMenu>
      <AdminAtraParbaudeShell
        initialVin={dealer?.initialRecord?.vin || dealer?.initialVin || initialVin}
        initialPlate={dealer?.initialPlate ?? ""}
        autoScan={Boolean(initialVin) && !dealer?.initialRecord && !dealer?.fromAutoparks}
        isAdmin={isAdmin}
        thecarapiEnabled={thecarapiVinScanEnabled()}
        dealer={dealer}
        phoneDealerTab={sp?.skats === "dilera"}
        footer={
          // Straumēts: lapa neatgaida Blob nolasīšanu pirms pirmā zīmējuma.
          <Suspense fallback={<p className="text-[11px] text-[#86868b]">Avotu stāvoklis…</p>}>
            <SourceHealthSection />
          </Suspense>
        }
      />
    </div>
  );
}

/** Tas pats, ko agrāk darīja «Dīlera dati» lapa: saglabātā pārbaude (?id=), saraksts, CSDD no Autoparks (?vn= / ?no=autoparks). */
async function loadDealerInitial(sp: AtraSearchParams | undefined): Promise<AtraDealerInitial> {
  const initialId = isSafeDealerCheckId(sp?.id ?? "") ? (sp?.id ?? "") : "";
  let saved: DealerCheckRecord | null = null;
  let initialEntries: DealerCheckHistoryEntry[] = [];
  try {
    const creator = await currentDealerCheckCreatorId();
    initialEntries = await listDealerCheckEntries(creator);
    if (initialId) saved = await readOwnedDealerCheck(initialId, creator);
  } catch {
    saved = null;
    initialEntries = [];
  }
  const searchVin = saved?.vin || parseDealerCheckSearchVin(sp?.vin ?? "");
  const searchPlate = saved?.plate || parseDealerCheckSearchPlate(sp?.vn ?? "");
  const fromAutoparks = !saved && sp?.no === "autoparks";
  // CSDD iepriekš tikai Autoparks / numura saitēm (kā agrāk dīlera lapā); parasts ?vin= CSDD lieki neprasa.
  const prefetched = saved?.csddSnapshot
    ? { vin: searchVin, plate: searchPlate, csdd: saved.csddSnapshot, message: "" }
    : fromAutoparks || searchPlate
      ? await prefetchDealerCheckCsdd({ vin: searchVin, plate: searchPlate })
      : { vin: searchVin, plate: searchPlate, csdd: null, message: "" };
  return {
    initialVin: prefetched.vin || searchVin,
    initialPlate: prefetched.plate || searchPlate,
    initialCsdd: prefetched.csdd,
    initialCsddMessage: prefetched.message,
    fromAutoparks,
    initialRecord: saved,
    initialEntries,
  };
}

async function SourceHealthSection() {
  const health = await readSourceHealth();
  const items: SourceHealthItem[] = VIN_SCAN_CATALOG.filter((c) => !c.disabled).map((c) => ({ id: c.id, label: c.label }));
  return <AdminSourceHealthCompact doc={health} items={items} />;
}
