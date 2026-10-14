import { B2bDemoOrderForm } from "@/components/b2b-demo/B2bDemoOrdersClient";
import { B2bDemoShell } from "@/components/b2b-demo/B2bDemoShell";
import { requireB2bDemoPageActor } from "@/lib/b2b-demo-page";

export const dynamic = "force-dynamic";

export default async function B2bDemoNewOrderPage() {
  const actor = await requireB2bDemoPageActor();
  return (
    <B2bDemoShell tenantName={actor.tenant.name} userName={actor.user.name} role={actor.session.role}>
      <h1 className="mb-4 text-xl font-semibold">Jauns pasūtījums</h1>
      <p className="mb-4 text-sm text-slate-500">PDF piedāvājums no šī ieraksta būs nākamajā posmā. tenant_id tiek piešķirts automātiski.</p>
      <B2bDemoOrderForm mode="create" />
    </B2bDemoShell>
  );
}
