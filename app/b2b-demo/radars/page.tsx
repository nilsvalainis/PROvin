import { B2bDemoShell } from "@/components/b2b-demo/B2bDemoShell";
import { requireB2bDemoPageActor } from "@/lib/b2b-demo-page";

export const dynamic = "force-dynamic";

export default async function B2bDemoRadarPage() {
  const actor = await requireB2bDemoPageActor();
  return (
    <B2bDemoShell tenantName={actor.tenant.name} userName={actor.user.name} role={actor.session.role}>
      <h1 className="mb-3 text-xl font-semibold">Radars</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
        Šeit būs šī dīlera meklēšanas radars, izolēts ar tenant_id. Modulis vēl nav ieslēgts. Citu dīleru dati šeit nav
        redzami.
      </p>
    </B2bDemoShell>
  );
}
