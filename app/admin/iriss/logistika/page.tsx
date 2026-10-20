import { IrissLogisticsHomeClient } from "@/components/admin/IrissLogisticsHomeClient";
import { requireLogisticsPage } from "@/lib/staff-auth";

export const metadata = {
  title: "Loģistika | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissLogistikaPage() {
  const actor = await requireLogisticsPage();
  const name = actor.kind === "admin" ? actor.name : actor.user.name;
  return (
    <IrissLogisticsHomeClient viewerName={name} canEnableTotp={actor.kind === "staff" && !actor.user.totpEnabled} />
  );
}
