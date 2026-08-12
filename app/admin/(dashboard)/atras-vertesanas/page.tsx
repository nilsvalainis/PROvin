import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { ListingPeeksAdminList } from "@/components/admin/ListingPeeksAdminList";
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

async function setStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ListingPeekStatus;
  if (!id || !STATUSES.includes(status)) return;
  await updateListingPeekStatus(id, status);
  revalidatePath("/admin/atras-vertesanas");
}

async function saveEmail(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!id || !isValidOrderEmail(email)) {
    redirect("/admin/atras-vertesanas?contact=invalid");
  }
  const updated = await updateListingPeekContact(id, { email });
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
    await sendListingPeekCustomerCommentEmail({ to: entry.email, comment });
    await updateListingPeekStatus(id, "completed");
  } catch (e) {
    console.error("[atras-vertesanas] send comment failed:", e);
    redirect("/admin/atras-vertesanas?mail=error");
  }
  revalidatePath("/admin/atras-vertesanas");
  redirect("/admin/atras-vertesanas?mail=sent");
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

  const pendingCount = entries.filter((e) => e.status === "new" || e.status === "in_progress").length;

  return (
    <div className="w-full max-w-none pb-24 sm:pb-8">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Lead</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
            Ātrie vērtējumi
          </h1>
          {pendingCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-amber-900">
              {pendingCount} gaida
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 max-w-xl text-[13px] leading-snug text-[var(--color-provin-muted)] sm:text-sm">
          Bezmaksas sludinājuma komentāri. Atbildi ar «Nosūtīt e-pastu» — HTML ar PROVIN AUDITS CTA. Gmail Reply =
          parasts teksts.
        </p>
      </AdminDashboardHeaderWithMenu>

      {contact === "saved" ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          E-pasts saglabāts.
        </p>
      ) : null}
      {contact === "invalid" || contact === "missing" ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          E-pastu neizdevās saglabāt
          {contact === "invalid" ? " (adrese nav derīga)." : "."}
        </p>
      ) : null}
      {mail === "sent" ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          HTML e-pasts ar AUDITS CTA nosūtīts klientam.
        </p>
      ) : null}
      {mail === "error" || mail === "smtp" || mail === "missing" || mail === "invalid" ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          E-pastu neizdevās nosūtīt
          {mail === "smtp" ? " (SMTP nav konfigurēts)." : mail === "invalid" ? " (komentārs pārāk īss)." : "."}{" "}
          Pārbaudi SMTP un mēģini vēlreiz.
        </p>
      ) : null}

      <ListingPeeksAdminList
        entries={entries}
        smtpOk={smtpOk}
        setStatus={setStatus}
        saveEmail={saveEmail}
        sendComment={sendComment}
      />
    </div>
  );
}
