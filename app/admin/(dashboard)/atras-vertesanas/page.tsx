import { revalidatePath } from "next/cache";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { isSmtpConfigured, sendListingPeekCustomerCommentEmail } from "@/lib/email/send-transactional";
import {
  getListingPeekById,
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

async function sendComment(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  if (!id || comment.length < 8) return;
  if (!isSmtpConfigured()) return;

  const entry = await getListingPeekById(id);
  if (!entry?.email) return;

  try {
    await sendListingPeekCustomerCommentEmail({ to: entry.email, comment });
    await updateListingPeekStatus(id, "completed");
  } catch (e) {
    console.error("[atras-vertesanas] send comment failed:", e);
    return;
  }
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
  const smtpOk = isSmtpConfigured();

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
          Bezmaksas sludinājuma komentāri. Limits: 1 / 7 dienas / e-pasts vai telefona pēdējie 8
          cipari; ~3 / diena / IP. Tikai skatījums uz sludinājumu — bez datubāžu analīzes. Atbildē
          klientam e-pastā vienmēr ir PROVIN AUDITS CTA.
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
        <ul className="mt-6 space-y-4">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] text-[var(--color-provin-muted)]">{formatWhen(e.createdAt)}</p>
                  <a
                    href={`mailto:${e.email}`}
                    className="mt-1 block font-medium text-[var(--color-apple-text)] hover:underline"
                  >
                    {e.email}
                  </a>
                  {e.phone ? (
                    <a
                      href={`tel:${e.phone.replace(/\s/g, "")}`}
                      className="mt-0.5 block text-[13px] text-[var(--color-provin-muted)] hover:underline"
                    >
                      {e.phone}
                    </a>
                  ) : null}
                  <a
                    href={e.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block break-all text-[13px] text-[var(--color-provin-accent)] hover:underline"
                  >
                    {e.listingUrl}
                  </a>
                </div>
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
              </div>

              {e.status !== "completed" && e.status !== "rejected" ? (
                <form action={sendComment} className="mt-4 border-t border-slate-100 pt-4">
                  <input type="hidden" name="id" value={e.id} />
                  <label
                    htmlFor={`comment-${e.id}`}
                    className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]"
                  >
                    Komentārs klientam (e-pastā + AUDITS CTA)
                  </label>
                  <textarea
                    id={`comment-${e.id}`}
                    name="comment"
                    required
                    minLength={8}
                    rows={4}
                    placeholder="Īss komentārs tikai par to, kas redzams sludinājumā…"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={!smtpOk}
                      className="rounded-full bg-[var(--color-provin-accent)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Nosūtīt e-pastu
                    </button>
                    {!smtpOk ? (
                      <p className="text-[12px] text-amber-700">SMTP nav konfigurēts.</p>
                    ) : null}
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
