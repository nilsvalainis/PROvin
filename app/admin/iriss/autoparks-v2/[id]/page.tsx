import "../autoparks-v2.css";
import { notFound, redirect } from "next/navigation";
import { AutoparksV2Cabinet } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Cabinet";
import { autoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { getAutoparksV2PageActor } from "@/lib/iriss-autoparks-v2-access";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";
import { staffHasSection } from "@/lib/staff-roles";

export const metadata = { title: "Auto kabinets | IRISS" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Auto kabinets v2. Pamatdati (bez summām) ielādē serveris; pārējās cilnes - savi API ar savām tiesībām. */
export default async function AutoparksV2CarPage({ params }: Props) {
  const access = await getAutoparksV2PageActor();
  if (!access) redirect("/admin/iriss");
  const { id } = await params;
  const found = await readAutoparksV2Car(id);
  if (!found) notFound();
  // "Izveidot piedāvājumu" tikai ar Pasūtījumu tiesību (j20 Nila atbilde 5).
  const canCreateOffer = access.actor.kind === "admin" || staffHasSection(access.actor.user, "pasutijumi");
  return <AutoparksV2Cabinet initialBasics={autoparksV2Basics(found.car, found.v2)} perms={access.perms} canCreateOffer={canCreateOffer} />;
}
