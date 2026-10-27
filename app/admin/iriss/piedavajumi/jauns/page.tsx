import "@/components/iriss-piedavajumi/piedavajumi.css";
import { redirect } from "next/navigation";
import { irissCreateOfferHrefLegacy } from "@/components/admin/IrissCreateOfferButton";
import { PiedavajumsNew } from "@/components/admin/iriss-piedavajumi/PiedavajumsNew";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { listLogisticsOrders } from "@/lib/iriss-logistics-store";
import { readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { parseIrissPdEntry } from "@/lib/iriss-pd-entry";
import { irissPdCarPicks, irissPdLogisticsPicks } from "@/lib/iriss-piedavajumi";
import { listIrissPdRows } from "@/lib/iriss-piedavajumi-store";
import { emptyIrissPdClient, type IrissPdClient } from "@/lib/iriss-piedavajumi-types";
import { getAdminOrStaffActor } from "@/lib/staff-auth";
import { requireAdminPage } from "@/lib/admin-auth";

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
 * PD ir tikai administratoram - darbinieks ar Pasūtījumu tiesību paliek pie esošās formas (tas pats avots).
 */
export default async function IrissPiedavajumsNewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getAdminOrStaffActor();
  const entry = parseIrissPdEntry(await searchParams);
  if (actor?.kind === "staff") {
    redirect(irissCreateOfferHrefLegacy(entry.tab === "autoparks" || entry.tab === "logistics" ? entry.tab : undefined, entry.carId || undefined));
  }
  await requireAdminPage();
  const [state, orders, rows, client] = await Promise.all([
    readAutoparksState().catch(() => null),
    listLogisticsOrders().catch(() => null),
    listIrissPdRows().catch(() => []),
    clientFromOrder(entry.orderId),
  ]);
  return (
    <PiedavajumsNew
      cars={state ? irissPdCarPicks(state.cars, rows) : []}
      carsError={state ? "" : "Autoparku neizdevās ielādēt."}
      logistics={orders ? irissPdLogisticsPicks(orders, rows) : []}
      logisticsError={orders ? "" : "Loģistiku neizdevās ielādēt."}
      entry={entry}
      client={client}
    />
  );
}
