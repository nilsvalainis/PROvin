import { revalidatePath } from "next/cache";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import {
  listListingPeeks,
  updateListingPeekStatus,
  type ListingPeekStatus,
} from "@/lib/listing-peek-store";

export const dynamic = "force-dynamic";

const STATUSES: ListingPeekStatus[] = ["new", "in_progress", "completed", "rejected"];

const STATUS_LABEL: Record<ListingPeekStatus, string> = {
  new: "Jauns",
  in_progress: "Procesā",
  completed: "Pabeigts",
  rejected: "Noraidīts",
};

async function setStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ListingPeekStatus;
  if (!id || !STATUSES.includes(status)) return;
  await updateListingPeekStatus(id, status);
  revalidatePath("/admin/atras-vertesanas");
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("lv-LV", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function AdminListingPeeksPage() {
  const entries = await listListingPeeks(200);

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Lead
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Ātrie vērtējumi
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-[var(--color-provin-muted)]">
          Īsie bezmaksas sludinājuma komentāri no Riska & Audita Ceļveža. Limits: 1 /
          7 dienas / e-pasts, 1 / 7 dienas / saite, ~3 / diena / IP. Tikai skatījums uz
          sludinājumu — bez datubāžu analīzes.
        </p>
      </AdminDashboardHeaderWithMenu>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Nav pieprasījumu</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Kad kāds iesniegs īso vērtējumu mājaslapā, ieraksti parādīsies šeit.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
              <tr>
                <th className="px-3 py-2.5">Datums</th>
                <th className="px-3 py-2.5">Kontakti</th>
                <th className="px-3 py-2.5">Konteksts</th>
                <th className="px-3 py-2.5">Sludinājums</th>
                <th className="px-3 py-2.5">Statuss</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--color-provin-muted)]">
                    {formatWhen(e.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={`mailto:${e.email}`}
                      className="font-medium text-[var(--color-apple-text)] hover:underline"
                    >
                      {e.email}
                    </a>
                    {e.phone ? (
                      <p className="mt-0.5">
                        <a
                          href={`tel:${e.phone.replace(/\s/g, "")}`}
                          className="text-[13px] text-[var(--color-provin-muted)] hover:underline"
                        >
                          {e.phone}
                        </a>
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--color-provin-muted)]">
                    {e.location === "lv" ? "Latvijā lietots" : "Nesen ievests"}
                  </td>
                  <td className="max-w-[16rem] px-3 py-3">
                    <a
                      href={e.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-[var(--color-provin-accent)] hover:underline"
                    >
                      {e.listingUrl}
                    </a>
                  </td>
                  <td className="px-3 py-3">
                    <form action={setStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={e.id} />
                      <select
                        name="status"
                        defaultValue={e.status}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-[var(--color-apple-text)]"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)] transition hover:bg-slate-50"
                      >
                        OK
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
