import { redirect } from "next/navigation";
import { B2bDemoShell } from "@/components/b2b-demo/B2bDemoShell";
import { B2bDemoUsersPanel } from "@/components/b2b-demo/B2bDemoUsersPanel";
import { B2B_DEMO_APP_PREFIX } from "@/lib/b2b-demo-host";
import { requireB2bDemoPageActor } from "@/lib/b2b-demo-page";
import { listB2bDemoTenantUsers } from "@/lib/b2b-demo-store";

export const dynamic = "force-dynamic";

export default async function B2bDemoUsersPage() {
  const actor = await requireB2bDemoPageActor();
  if (actor.session.role !== "owner") redirect(`${B2B_DEMO_APP_PREFIX}/pasutijumi`);
  const users = await listB2bDemoTenantUsers(actor.session.tenantId);
  return (
    <B2bDemoShell tenantName={actor.tenant.name} userName={actor.user.name} role={actor.session.role}>
      <h1 className="mb-4 text-xl font-semibold">Lietotāji</h1>
      <B2bDemoUsersPanel users={users} />
    </B2bDemoShell>
  );
}
