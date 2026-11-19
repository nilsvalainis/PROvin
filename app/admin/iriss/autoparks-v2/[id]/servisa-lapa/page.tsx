import "../../autoparks-v2.css";
import { notFound, redirect } from "next/navigation";
import { AutoparksV2ServisaLapa } from "@/components/admin/iriss-autoparks-v2/AutoparksV2ServisaLapa";
import { getAutoparksV2PageActor } from "@/lib/iriss-autoparks-v2-access";
import { buildServisaLapa, servisaLapaAllowed } from "@/lib/iriss-autoparks-v2-servisa-lapa";
import { getAutoparksV2Serviss } from "@/lib/iriss-autoparks-v2-serviss-store";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";

export const metadata = { title: "Servisa darbu lapa | IRISS" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** «Drukāt servisa lapu» (Serviss cilne): A4 servisa darbu lapa + CSDD diagnostika. Tiesības kā Servisam (ap_serviss). */
export default async function AutoparksV2ServisaLapaPage({ params }: Props) {
  const access = await getAutoparksV2PageActor();
  if (!access || !servisaLapaAllowed(access.perms)) redirect("/admin/iriss");
  const { id } = await params;
  const [found, serviss] = await Promise.all([readAutoparksV2Car(id), getAutoparksV2Serviss(id, access.perms)]);
  if (!found || !serviss) notFound();
  const s = buildServisaLapa({ car: found.car, v2: found.v2, diagFiles: serviss.diag.files, now: new Date() });
  return <AutoparksV2ServisaLapa s={s} />;
}
