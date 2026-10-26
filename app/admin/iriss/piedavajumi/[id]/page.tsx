import "@/components/iriss-piedavajumi/piedavajumi.css";
import { notFound } from "next/navigation";
import { PiedavajumsDetail } from "@/components/admin/iriss-piedavajumi/PiedavajumsDetail";
import { irissPdClientOptions } from "@/lib/iriss-piedavajumi";
import { requireAdminPage } from "@/lib/admin-auth";
import { readIrissPdFresh } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdId } from "@/lib/iriss-piedavajumi-types";
import { isIrissPasutijumiStoreEnabled, listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";

export const metadata = { title: "Piedāvājums | IRISS" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ note?: string }> };

export default async function IrissPiedavajumsPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { id } = await params;
  if (!isSafeIrissPdId(id)) notFound();
  const nowMs = Date.now();
  const rec = await readIrissPdFresh(id, nowMs);
  if (!rec) notFound();
  const orders = isIrissPasutijumiStoreEnabled() ? await listIrissPasutijumi().catch(() => []) : [];
  const sp = (await searchParams) ?? {};
  return (
    <PiedavajumsDetail
      initial={rec}
      nowMs={nowMs}
      clientOptions={irissPdClientOptions(orders)}
      note={typeof sp.note === "string" ? sp.note.slice(0, 300) : ""}
    />
  );
}
