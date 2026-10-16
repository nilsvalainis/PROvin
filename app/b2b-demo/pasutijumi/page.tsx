import Link from "next/link";
import { B2bDemoOrdersList } from "@/components/b2b-demo/B2bDemoOrdersClient";
import { B2bDemoShell } from "@/components/b2b-demo/B2bDemoShell";
import { B2B_DEMO_APP_PREFIX } from "@/lib/b2b-demo-host";
import { B2B_DEMO_ORDER_PAGE_DEFAULT } from "@/lib/b2b-demo-order-list";
import { requireB2bDemoPageActor } from "@/lib/b2b-demo-page";
import { listB2bDemoTenantOrderPage } from "@/lib/b2b-demo-store";

export const dynamic = "force-dynamic";

export default async function B2bDemoOrdersPage() {
  const actor = await requireB2bDemoPageActor();
  const page = await listB2bDemoTenantOrderPage(actor.session.tenantId, {
    page: 1,
    limit: B2B_DEMO_ORDER_PAGE_DEFAULT,
  });
  return (
    <B2bDemoShell tenantName={actor.tenant.name} userName={actor.user.name} role={actor.session.role}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pasūtījumi</h1>
        <Link href={`${B2B_DEMO_APP_PREFIX}/pasutijumi/new`} className="rounded-xl bg-[#F26522] px-3 py-2 text-sm font-semibold text-white">
          Jauns
        </Link>
      </div>
      <B2bDemoOrdersList initial={page} />
    </B2bDemoShell>
  );
}
