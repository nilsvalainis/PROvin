import "@/components/iriss-piedavajumi/piedavajumi.css";
import { PiedavajumsNew } from "@/components/admin/iriss-piedavajumi/PiedavajumsNew";
import { isIrissPasutijumiStoreEnabled, listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { irissPdClientOptions } from "@/lib/iriss-piedavajumi";
import { readAutoparksEffectiveCars } from "@/lib/iriss-autoparks-v2-store";
import { listLogisticsOrders } from "@/lib/iriss-logistics-store";
import { readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { parseIrissPdEntry, type IrissPdEntryTab } from "@/lib/iriss-pd-entry";
import { irissPdCarPicks, irissPdLogisticsPicks } from "@/lib/iriss-piedavajumi";
import { irissPdViewerCanUseStock, irissPdViewerFromActor } from "@/lib/iriss-piedavajumi-staff";
import { listIrissPdRows } from "@/lib/iriss-piedavajumi-store";
import { emptyIrissPdClient, type IrissPdClient } from "@/lib/iriss-piedavajumi-types";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const metadata = { title: "Jauns piedāvājums | IRISS" };
export const dynamic = "force-dynamic";

async function clientFromOrder(orderId: string): Promise<IrissPdClient | null> {
  if (!orderId) return null;
  const o = await readIrissPasutijums(orderId).catch(() => null);
  if (!o) return null;
  const name = `${o.clientFirstName ?? ""} ${o.clientLastName ?? ""}`.trim();
  return { ...emptyIrissPdClient(), name, phone: o.phone ?? "", email: o.email ?? "", orderId };
}

/**
 * Viena piedāvājuma ieeja (Nils 27.10): Saite / Autoparks / Loģistika / Tukšs, klients nav obligāts.
 * P4 (Nils 20.11): arī darbiniekam ar Pasūtījumiem (vecā forma vairs netiek lietota). Autoparks / Loģistika
 * cilne tikai ar attiecīgo sadaļu (dati tiek ielādēti tikai tad).
 */
export default async function IrissPiedavajumsNewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = irissPdViewerFromActor(await requireIrissSectionPage("pasutijumi"));
  const parsed = parseIrissPdEntry(await searchParams);
  const canAutoparks = irissPdViewerCanUseStock(viewer, "autoparks");
  const canLogistics = irissPdViewerCanUseStock(viewer, "logistics");
  const tabs: IrissPdEntryTab[] = ["link", ...(canAutoparks ? (["autoparks"] as const) : []), ...(canLogistics ? (["logistics"] as const) : []), "empty"];
  // Darbiniekam bez avota sadaļas auto no Autoparka/Loģistikas netiek veidots - paliek cilne «Saite».
  const entry = tabs.includes(parsed.tab) ? parsed : { ...parsed, tab: "link" as const, carId: "" };
  const [cars, orders, rows, client, irissOrders] = await Promise.all([
    // Efektīvie Pamatdati (v2 labotais VIN/numurs/marka) - izvēlei un dublikātu pārbaudei.
    canAutoparks ? readAutoparksEffectiveCars().catch(() => null) : Promise.resolve(null),
    canLogistics ? listLogisticsOrders().catch(() => null) : Promise.resolve(null),
    listIrissPdRows().catch(() => []),
    clientFromOrder(entry.orderId),
    isIrissPasutijumiStoreEnabled() ? listIrissPasutijumi().catch(() => []) : Promise.resolve([]),
  ]);
  return (
    <PiedavajumsNew
      cars={cars ? irissPdCarPicks(cars, rows) : []}
      carsError={cars || !canAutoparks ? "" : "Autoparku neizdevās ielādēt."}
      logistics={orders ? irissPdLogisticsPicks(orders, rows) : []}
      logisticsError={orders || !canLogistics ? "" : "Loģistiku neizdevās ielādēt."}
      entry={entry}
      client={client}
      clientOptions={irissPdClientOptions(irissOrders)}
      tabs={tabs}
    />
  );
}
