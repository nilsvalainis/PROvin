import { HomeRiskAuditGuide } from "@/components/home/HomeRiskAuditGuide";
import { isListingPeekPublicQueuePaused } from "@/lib/listing-peek-store";

/** Server gate: reads open peek backlog and passes pause state to the client form. */
export async function HomeRiskAuditGuideSection() {
  let queuePaused = false;
  try {
    queuePaused = await isListingPeekPublicQueuePaused();
  } catch (err) {
    console.warn("[listing-peek] queue snapshot failed; form stays open", err);
  }
  return <HomeRiskAuditGuide queuePaused={queuePaused} />;
}
