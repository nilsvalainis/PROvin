import { notFound } from "next/navigation";
import { B2bDemoOrderForm } from "@/components/b2b-demo/B2bDemoOrdersClient";
import { B2bDemoShell } from "@/components/b2b-demo/B2bDemoShell";
import { requireB2bDemoPageActor } from "@/lib/b2b-demo-page";
import { getB2bDemoTenantOrder } from "@/lib/b2b-demo-store";

export const dynamic = "force-dynamic";

export default async function B2bDemoOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireB2bDemoPageActor();
  const { id } = await params;
  const order = await getB2bDemoTenantOrder(actor.session.tenantId, id);
  if (!order) notFound();
  return (
    <B2bDemoShell tenantName={actor.tenant.name} userName={actor.user.name} role={actor.session.role}>
      <h1 className="mb-4 text-xl font-semibold">{order.brandModel || "Pasūtījums"}</h1>
      <B2bDemoOrderForm mode="edit" initial={order} />
    </B2bDemoShell>
  );
}
