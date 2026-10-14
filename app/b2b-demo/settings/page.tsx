import { B2bDemoSettingsForm } from "@/components/b2b-demo/B2bDemoSettingsForm";
import { B2bDemoShell } from "@/components/b2b-demo/B2bDemoShell";
import { requireB2bDemoPageActor } from "@/lib/b2b-demo-page";
import { emptyB2bDemoSettings } from "@/lib/b2b-demo-settings";
import { readB2bDemoTenantSettings } from "@/lib/b2b-demo-store";

export const dynamic = "force-dynamic";

export default async function B2bDemoSettingsPage() {
  const actor = await requireB2bDemoPageActor();
  const settings = (await readB2bDemoTenantSettings(actor.session.tenantId)) ?? emptyB2bDemoSettings(actor.session.tenantId);
  return (
    <B2bDemoShell tenantName={actor.tenant.name} userName={actor.user.name} role={actor.session.role}>
      <h1 className="mb-2 text-xl font-semibold">Iestatījumi</h1>
      <p className="mb-5 max-w-2xl text-sm text-slate-500">
        Logo, rekvizīti, komisija, transports, PVN un PDF teksti pieder tikai šim dīlerim. ĪRISS skaitļi (1190 / 800 /
        600 / 1000) šeit nav noklusējums.
      </p>
      <B2bDemoSettingsForm initial={settings} readOnly={actor.session.role !== "owner"} />
    </B2bDemoShell>
  );
}
