"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { isValidOrderEmail, isValidOrderPhone } from "@/lib/order-field-validation";
import { updateListingPeekContact, updateListingPeekStatus, type ListingPeekStatus } from "@/lib/listing-peek-store";

const STATUSES: ListingPeekStatus[] = ["new", "in_progress", "completed", "rejected"];

function safeBack(raw: FormDataEntryValue | null): string {
  const s = String(raw ?? "");
  return s.startsWith("/admin/atras-vertesanas") ? s : "/admin/atras-vertesanas";
}

export async function setQuickEvalStatus(formData: FormData) {
  if (!(await getAdminSession())) return;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ListingPeekStatus;
  if (!id || !STATUSES.includes(status)) return;
  await updateListingPeekStatus(id, status);
  revalidatePath("/admin/atras-vertesanas");
  const back = formData.get("back");
  if (back) redirect(safeBack(back));
}

export async function saveQuickEvalContact(formData: FormData) {
  if (!(await getAdminSession())) return;
  const id = String(formData.get("id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const back = safeBack(formData.get("back"));
  const sep = back.includes("?") ? "&" : "?";
  if (!id || !isValidOrderEmail(email) || (phone && !isValidOrderPhone(phone))) redirect(`${back}${sep}contact=invalid`);
  const updated = await updateListingPeekContact(id, { email, phone });
  if (!updated) redirect(`${back}${sep}contact=missing`);
  revalidatePath("/admin/atras-vertesanas");
  redirect(`${back}${sep}contact=saved`);
}
