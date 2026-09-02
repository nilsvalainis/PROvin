import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminListingPeekActionRow } from "@/components/admin/AdminListingPeekActionRow";
import { AdminListingPeekCommentComposer } from "@/components/admin/AdminListingPeekCommentComposer";
import { AdminListingPeekPhoneField } from "@/components/admin/AdminListingPeekPhoneField";
import {
  AdminListingPeekCardShell,
  AdminListingPeekSla,
} from "@/components/admin/AdminListingPeekSla";
import { isSmtpConfigured, sendListingPeekCustomerCommentEmail } from "@/lib/email/send-transactional";
import { parseListingPeekCustomerComment } from "@/lib/listing-peek-comment-presets";
import { canonicalizeListingUrl, isValidOrderEmail, isValidOrderPhone } from "@/lib/order-field-validation";
import {
  getListingPeekById,
  listListingPeeks,
  markListingPeekCommentSent,
  updateListingPeekContact,
  updateListingPeekStatus,
  type ListingPeekStatus,
} from "@/lib/listing-peek-store";
import { loadListingPeekConversionStats } from "@/lib/listing-peek-conversion-load";
import { AdminListingPeekConversionCard } from "@/components/admin/AdminListingPeekConversionCard";

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
  if (phone && !isValidOrderPhone(phone)) {
    redirect("/admin/atras-vertesanas?contact=invalid");
  }
  const updated = await updateListingPeekContact(id, { email, phone });
  if (!updated) {
    redirect("/admin/atras-vertesanas?contact=missing");
  }
  revalidatePath("/admin/atras-vertesanas");
  redirect("/admin/atras-vertesanas?contact=saved");
}

async function sendComment(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  if (!id || comment.length < 8) {
    redirect("/admin/atras-vertesanas?mail=invalid");
  }
  if (!isSmtpConfigured()) {
    redirect("/admin/atras-vertesanas?mail=smtp");
  }

  const entry = await getListingPeekById(id);
  if (!entry?.email || !isValidOrderEmail(entry.email)) {
    redirect("/admin/atras-vertesanas?mail=missing");
  }

  try {
    await sendListingPeekCustomerCommentEmail({
      to: entry.email,
      comment,
      listingUrl: entry.listingUrl,
    });
    await markListingPeekCommentSent(id, comment);
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
  const peekConversion = await loadListingPeekConversionStats();
  const smtpOk = isSmtpConfigured();
  const sp = searchParams ? await searchParams : undefined;
  const mail = sp?.mail;
  const contact = sp?.contact;

  const pending = entries.filter((e) => e.status === "new" || e.status === "in_progress");
  const done = entries.filter((e) => e.status === "completed" || e.status === "rejected");

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
          Bezmaksas sludinājuma komentāri. Sagataves saliekas vēstulē, ko vari papildināt;
          Flash / Gemini apstrādā visu tekstu. Gmail Reply = parasts teksts.
        </p>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-6">
        <AdminListingPeekConversionCard stats={peekConversion} variant="compact" />
      </div>

      {contact === "saved" ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          E-pasts un tālrunis saglabāti.
        </p>
      ) : null}
      {contact === "invalid" || contact === "missing" ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          E-pastu neizdevās saglabāt
          {contact === "invalid" ? " (adrese nav derīga)." : "."}
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
              ? " (komentārs pārāk īss)."
              : "."}{" "}
          Pārbaudi SMTP un mēģini vēlreiz.
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
        <div className="mt-6 space-y-8">
          {pending.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                Gaida atbildi ({pending.length})
              </h2>
              <ul className="space-y-3">
                {pending.map((e) => (
                  <PeekCard
                    key={e.id}
                    entry={e}
                    smtpOk={smtpOk}
                    setStatus={setStatus}
                    saveContact={saveContact}
                    sendComment={sendComment}
                    showSend
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {done.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                Apstrādāti ({done.length})
              </h2>
              <ul className="space-y-2">
                {done.map((e) => (
                  <PeekCard
                    key={e.id}
                    entry={e}
                    smtpOk={smtpOk}
                    setStatus={setStatus}
                    saveContact={saveContact}
                    sendComment={sendComment}
                    showSend={false}
                    compact
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PeekCard({
  entry: e,
  smtpOk,
  setStatus,
  saveContact,
  sendComment,
  showSend,
  compact = false,
}: {
  entry: Awaited<ReturnType<typeof listListingPeeks>>[number];
  smtpOk: boolean;
  setStatus: (formData: FormData) => Promise<void>;
  saveContact: (formData: FormData) => Promise<void>;
  sendComment: (formData: FormData) => Promise<void>;
  showSend: boolean;
  compact?: boolean;
}) {
  const isDone = e.status === "completed";
  const isRejected = e.status === "rejected";
  const listingUrl = canonicalizeListingUrl(e.listingUrl);

  return (
    <AdminListingPeekCardShell createdAt={e.createdAt} complete={isDone} rejected={isRejected}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <AdminListingPeekSla createdAt={e.createdAt} complete={isDone} rejected={isRejected} />

          <form action={saveContact} className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <input type="hidden" name="id" value={e.id} />
            <label className="min-w-0">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
                E-pasts
              </span>
              <input
                type="email"
                name="email"
                required
                defaultValue={e.email}
                aria-label="E-pasts"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]"
              />
            </label>
            <AdminListingPeekPhoneField defaultValue={e.phone} />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)] transition hover:bg-slate-50 sm:col-span-2 sm:w-fit"
            >
              Labot
            </button>
          </form>

          <div className="mt-2 space-y-1.5">
            <a
              href={listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`block min-w-0 break-all text-[var(--color-provin-accent)] hover:underline ${
                compact ? "text-[12px] line-clamp-1" : "text-[13px]"
              }`}
            >
              {listingUrl}
            </a>
            <AdminListingPeekActionRow listingUrl={listingUrl} phone={e.phone} />
          </div>
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

      {showSend ? (
        <form action={sendComment} className="mt-3 border-t border-slate-100 pt-3">
          <input type="hidden" name="id" value={e.id} />
          <AdminListingPeekCommentComposer
            fieldId={`peek-${e.id}`}
            listingUrl={listingUrl}
            smtpOk={smtpOk}
          />
        </form>
      ) : isDone ? (
        <PeekSentFollowUp entry={e} smtpOk={smtpOk} sendComment={sendComment} />
      ) : null}
    </AdminListingPeekCardShell>
  );
}

function PeekSentFollowUp({
  entry: e,
  smtpOk,
  sendComment,
}: {
  entry: Awaited<ReturnType<typeof listListingPeeks>>[number];
  smtpOk: boolean;
  sendComment: (formData: FormData) => Promise<void>;
}) {
  const parsed = e.comment ? parseListingPeekCustomerComment(e.comment) : null;
  return (
    <details className="mt-3 border-t border-emerald-100/90 pt-3">
      <summary className="cursor-pointer text-[12px] font-semibold text-[var(--color-provin-accent)]">
        {e.comment ? "Lasīt nosūtīto / sūtīt vēlreiz" : "Sūtīt jaunu ziņu"}
        {e.commentSentAt ? (
          <span className="ml-2 font-normal text-[var(--color-provin-muted)]">
            {formatWhen(e.commentSentAt)}
          </span>
        ) : null}
      </summary>
      {e.comment ? (
        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-emerald-100 bg-white px-3 py-2 text-[12px] leading-relaxed text-[var(--color-apple-text)]">
          {e.comment}
        </pre>
      ) : (
        <p className="mt-2 text-[12px] text-[var(--color-provin-muted)]">
          Iepriekšējā vēstule nav saglabāta (vecāks ieraksts). Vari sastādīt jaunu.
        </p>
      )}
      <form action={sendComment} className="mt-3">
        <input type="hidden" name="id" value={e.id} />
        <AdminListingPeekCommentComposer
          fieldId={`peek-${e.id}-followup`}
          listingUrl={canonicalizeListingUrl(e.listingUrl)}
          smtpOk={smtpOk}
          initialLines={parsed?.lines}
          initialCloser={parsed?.closer}
          initialLetter={e.comment}
          submitLabel="Nosūtīt vēlreiz"
        />
      </form>
    </details>
  );
}
