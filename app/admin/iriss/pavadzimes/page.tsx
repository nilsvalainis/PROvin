import { IrissPavadzimesListClient } from "@/components/admin/IrissPavadzimesListClient";
import { loadIrissPavadzimesPageData } from "@/lib/iriss-pavadzimes-list";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = { title: "Pavadzīmes" };
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function IrissPavadzimesPage() {
  await requireAdminPage();
  let data: Awaited<ReturnType<typeof loadIrissPavadzimesPageData>>;
  try {
    data = await loadIrissPavadzimesPageData();
  } catch {
    data = { rows: [], pendingParse: 0, dropboxConfigured: false, dropboxError: "Neizdevās ielādēt" };
  }

  return (
    <div className="relative min-h-full w-full max-w-none bg-[#F8F8F9] pb-24 sm:pb-8">
      <h1 className="mb-2 px-1 text-[34px] font-bold leading-none tracking-tight text-[var(--color-apple-text)] md:hidden">
        Pavadzīmes
      </h1>
      <IrissPavadzimesListClient initial={data} />
    </div>
  );
}
