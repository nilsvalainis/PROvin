import { redirect } from "next/navigation";
import { B2bDemoLoginForm } from "@/components/b2b-demo/B2bDemoLoginForm";
import { B2B_DEMO_APP_PREFIX } from "@/lib/b2b-demo-host";
import { resolveB2bDemoActor } from "@/lib/b2b-demo-auth";
import { b2bDemoDevLoginPrefill, ensureB2bDemoSeed } from "@/lib/b2b-demo-seed";
import { tenantCount } from "@/lib/b2b-demo-store";

export const dynamic = "force-dynamic";

export default async function B2bDemoLoginPage() {
  await ensureB2bDemoSeed();
  const actor = await resolveB2bDemoActor();
  if (actor) redirect(`${B2B_DEMO_APP_PREFIX}/pasutijumi`);
  const empty = (await tenantCount()) === 0;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F26522]">IRISS B2B</p>
        <h1 className="mt-1 text-2xl font-semibold">Dīlera demo</h1>
        <p className="mt-2 text-sm text-slate-500">
          Atsevišķs produkts no PROVIN atskaitēm. Bez Stripe. Katram dīlerim savi lietotāji un iestatījumi.
        </p>
        <div className="mt-6">
          <B2bDemoLoginForm allowBootstrap={empty} devPrefill={b2bDemoDevLoginPrefill()} />
        </div>
      </div>
    </div>
  );
}
