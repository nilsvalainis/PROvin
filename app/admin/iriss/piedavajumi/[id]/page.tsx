import "@/components/iriss-piedavajumi/piedavajumi.css";
import { notFound } from "next/navigation";
import { PiedavajumsDetail } from "@/components/admin/iriss-piedavajumi/PiedavajumsDetail";
import { irissPdClientOptions } from "@/lib/iriss-piedavajumi";
import { irissPdForViewer, irissPdViewerCanEdit, irissPdViewerFromActor } from "@/lib/iriss-piedavajumi-staff";
import { readIrissPdFresh } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdId } from "@/lib/iriss-piedavajumi-types";
import { isIrissPasutijumiStoreEnabled, listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const metadata = { title: "Piedāvājums | IRISS" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ note?: string }> };

/**
 * P4 (Nils 20.11): viena PD forma visiem. Darbinieks (Pasūtījumi) redz PVN režīmu un «Klientam kopā», bet ne
 * iekšējās summas, avotu un piezīmes (maskēts jau serverī); citu veidotos PD - tikai lasīšanai.
 */
export default async function IrissPiedavajumsPage({ params, searchParams }: Props) {
  const viewer = irissPdViewerFromActor(await requireIrissSectionPage("pasutijumi"));
  const { id } = await params;
  if (!isSafeIrissPdId(id)) notFound();
  const nowMs = Date.now();
  const rec = await readIrissPdFresh(id, nowMs);
  if (!rec) notFound();
  const orders = isIrissPasutijumiStoreEnabled() ? await listIrissPasutijumi().catch(() => []) : [];
  const sp = (await searchParams) ?? {};
  return (
    <PiedavajumsDetail
      initial={irissPdForViewer(rec, viewer)}
      clientOptions={irissPdClientOptions(orders)}
      note={typeof sp.note === "string" ? sp.note.slice(0, 300) : ""}
      staff={viewer.kind === "staff"}
      readOnly={!irissPdViewerCanEdit(rec, viewer)}
    />
  );
}
