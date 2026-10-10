import { notFound, redirect } from "next/navigation";
import { IrissPasutijumsEditor } from "@/components/admin/IrissPasutijumsEditor";
import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import type { IrissListingSourceRun } from "@/lib/iriss-listings-types";
import { isIrissPasutijumiStoreEnabled, isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { stripIrissOfferImageDataUrls } from "@/lib/iriss-pasutijums-offer-images";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function IrissPasutijumsDetailPage({
  params,
  searchParams,
}: Props & { searchParams?: Promise<{ newOffer?: string; noClientPdf?: string }> }) {
  if (!isIrissPasutijumiStoreEnabled()) {
    redirect("/admin/iriss/pasutijumi");
  }
  const { id } = await params;
  if (!isSafeIrissPasutijumsId(id)) {
    notFound();
  }
  const rec = await readIrissPasutijums(id);
  if (!rec) {
    notFound();
  }
  const sp = (await searchParams) ?? {};
  const autoOpenNewOffer = sp.newOffer === "1";
  const forceNoClientPdf = sp.noClientPdf === "1";
  let listingSourceRuns: IrissListingSourceRun[] = [];
  try {
    const latest = await readIrissListingsLatestView();
    listingSourceRuns = (latest?.sources ?? []).filter((s) => s.orderId === id);
  } catch {
    listingSourceRuns = [];
  }
  return (
    <IrissPasutijumsEditor
      initialRecord={stripIrissOfferImageDataUrls(rec)}
      autoOpenNewOffer={autoOpenNewOffer}
      forceNoClientPdf={forceNoClientPdf}
      listingSourceRuns={listingSourceRuns}
    />
  );
}
