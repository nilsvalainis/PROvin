import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { isSmtpConfigured, sendListingPeekCustomerCommentEmail } from "@/lib/email/send-transactional";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import {
  getListingPeekById,
  listListingPeeks,
  updateListingPeekContact,
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

async function saveContact(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!id || !isValidOrderEmail(email)) {
    redirect("/admin/atras-vertesanas?contact=invalid");
  }
  const updated = await updateListingPeekContact(id, { email, phone });
  if (!updated) {
    redirect("/admin/atras-vertesanas?contact=missing");
  }
  if (updated.status === "completed") {
    await updateListingPeekStatus(id, "in_progress");
  }
  revalidatePath("/admin/atras-vertesanas");
  redirect("/admin/atras-vertesanas?contact=saved");
}

async function sendComment(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const emailOverride = String(formData.get("email") ?? "").trim();
  if (!id || comment.length < 8) {
    redirect("/admin/atras-vertesanas?mail=invalid");
  }
  if (!isSmtpConfigured()) {
    redirect("/admin/atras-vertesanas?mail=smtp");
  }

  const entry = await getListingPeekById(id);
  if (!entry) {
    redirect("/admin/atras-vertesanas?mail=missing");
  }

  const to = emailOverride || entry.email;
  if (!isValidOrderEmail(to)) {
    redirect("/admin/atras-vertesanas?mail=invalid");
  }

  if (to !== entry.email) {
    await updateListingPeekContact(id, { email: to });
  }

  try {
    await sendListingPeekCustomerCommentEmail({ to, comment });
    await updateListingPeekStatus(id, "completed");
  } catch (e) {
    console.error("[atras-vertesanas] send comment failed:", e);
    redirect("/admin/atras-vertesanas?mail=error");
  }
  revalidatePath("/admin/atras-vertesanas");
  redirect("/admin/atras-vertesanas?mail=sent");
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("lv-LV", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function AdminListingPeeksPage({
  searchParams,
}: {
  searchParams?: Promise<{ mail?: string; contact?: string }>;
}) {
  const entries = await listListingPeeks(200);
  const smtpOk = isSmtpConfigured();
  const sp = searchParams ? await searchParams : undefined;
  const mail = sp?.mail;
  const contact = sp?.contact;

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
          cipari; ~3 / diena / IP. Atbildi tikai ar «Nosūtīt e-pastu» zemāk — HTML ar PROVIN AUDITS
          CTA. Gmail Reply = parasts teksts bez pogas. Kļūdainu adresi labo laukā «E-pasts» un
          sūti vēlreiz.
        </p>
      </AdminDashboardHeaderWithMenu>

      {contact === "saved" ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Kontakts saglabāts. Vari nosūtīt e-pastu uz jauno adresi.
        </p>
      ) : null}
      {contact === "invalid" || contact === "missing" ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Kontaktu neizdevās saglabāt
          {contact === "invalid" ? " (e-pasta adrese nav derīga)." : "."}
        </p>
      ) : null}
      {mail === "sent" ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          HTML e-pasts ar AUDITS CTA nosūtīts klientam.
        </p>
      ) : null}
      {mail === "error" || mail === "smtp" || mail === "missing" || mail === "invalid" ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          E-pastu neizdevās nosūtīt
          {mail === "smtp"
            ? " (SMTP nav konfigurēts)."
            : mail === "invalid"
              ? " (komentārs pārāk īss vai e-pasts nav derīgs)."
              : "."}{" "}
          Pārbaudi SMTP / adresi un mēģini vēlreiz.
        </p>
      ) : null}

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
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-[var(--color-provin-muted)]">{formatWhen(e.createdAt)}</p>
                  <form action={saveContact} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={e.id} />
                    <div>
                      <label
                        htmlFor={`email-${e.id}`}
                        className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]"
                      >
                        E-pasts (adresāts)
                      </label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <input
                          id={`email-${e.id}`}
                          type="email"
                          name="email"
                          required
                          defaultValue={e.email}
                          autoComplete="off"
                          className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)] transition hover:bg-slate-50"
                        >
                          Saglabāt
                        </button>
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor={`phone-${e.id}`}
                        className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]"
                      >
                        Tālrunis
                      </label>
                      <input
                        id={`phone-${e.id}`}
                        type="tel"
                        name="phone"
                        defaultValue={e.phone}
                        autoComplete="off"
                        className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]"
                      />
                    </div>
                  </form>
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

              {e.status !== "rejected" ? (
                <form action={sendComment} className="mt-4 border-t border-slate-100 pt-4">
                  <input type="hidden" name="id" value={e.id} />
                  <label
                    htmlFor={`send-email-${e.id}`}
                    className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]"
                  >
                    Adresāts (e-pasts)
                  </label>
                  <input
                    id={`send-email-${e.id}`}
                    type="email"
                    name="email"
                    required
                    defaultValue={e.email}
                    autoComplete="off"
                    className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]"
                  />
                  <label
                    htmlFor={`comment-${e.id}`}
                    className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]"
                  >
                    Komentārs klientam (e-pastā + AUDITS CTA)
                    {e.status === "completed" ? " — nosūtīt vēlreiz" : ""}
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
                      {e.status === "completed" ? "Nosūtīt vēlreiz" : "Nosūtīt e-pastu"}
                    </button>
                    {!smtpOk ? (
                      <p className="text-[12px] text-amber-700">SMTP nav konfigurēts.</p>
                    ) : (
                      <p className="text-[12px] text-[var(--color-provin-muted)]">
                        Labo adresi augšā un sūti — saglabāsies automātiski.
                      </p>
                    )}
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
