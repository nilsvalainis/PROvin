import { B2bDemoAuctionStub } from "@/components/b2b-demo/B2bDemoAuctionStub";
import { B2bDemoShell } from "@/components/b2b-demo/B2bDemoShell";
import { auctionSessionStatus } from "@/lib/b2b-demo-auction-crypto";
import { requireB2bDemoPageActor } from "@/lib/b2b-demo-page";
import { listB2bDemoAuctionSessions } from "@/lib/b2b-demo-store";
import { B2B_DEMO_AUCTION_PLATFORMS } from "@/lib/b2b-demo-types";

export const dynamic = "force-dynamic";

export default async function B2bDemoAuctionsPage() {
  const actor = await requireB2bDemoPageActor();
  const rows = await listB2bDemoAuctionSessions(actor.session.tenantId);
  const items = B2B_DEMO_AUCTION_PLATFORMS.map((platform) =>
    auctionSessionStatus(rows.find((r) => r.platform === platform) ?? null, actor.session.tenantId, platform),
  );
  return (
    <B2bDemoShell tenantName={actor.tenant.name} userName={actor.user.name} role={actor.session.role}>
      <h1 className="mb-4 text-xl font-semibold">Izsoļu sesijas</h1>
      <B2bDemoAuctionStub items={items} />
    </B2bDemoShell>
  );
}
