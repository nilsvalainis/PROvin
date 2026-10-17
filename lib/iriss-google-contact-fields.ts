import { orderHasMatchableGoogleContact } from "@/lib/google-contact-match";
import type { IrissGoogleContactStatus, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export type IrissClientContactFields = Pick<
  IrissPasutijumsRecord,
  "clientFirstName" | "clientLastName" | "phone" | "email"
>;

export { orderHasMatchableGoogleContact };

export function orderHasClientContact(rec: IrissClientContactFields): boolean {
  return Boolean(rec.clientFirstName.trim() || rec.clientLastName.trim() || rec.phone.trim() || rec.email.trim());
}

export function clientContactFieldsChanged(a: IrissClientContactFields, b: IrissClientContactFields): boolean {
  return (
    a.clientFirstName.trim() !== b.clientFirstName.trim() ||
    a.clientLastName.trim() !== b.clientLastName.trim() ||
    a.phone.trim() !== b.phone.trim() ||
    a.email.trim() !== b.email.trim()
  );
}

export function applyGoogleContactSync(
  rec: IrissPasutijumsRecord,
  result: { status: IrissGoogleContactStatus; resourceName?: string; error?: string },
  atIso = new Date().toISOString(),
): IrissPasutijumsRecord {
  const next: IrissPasutijumsRecord = {
    ...rec,
    googleContactStatus: result.status,
    googleContactUpdatedAt: atIso,
  };
  if (result.resourceName) next.googleContactResourceName = result.resourceName;
  if (result.status === "error" && result.error) next.googleContactError = result.error.slice(0, 240);
  else delete next.googleContactError;
  return next;
}

export function shouldSyncGoogleContact(
  existing: IrissPasutijumsRecord | null,
  saved: IrissPasutijumsRecord,
): boolean {
  if (!orderHasMatchableGoogleContact(saved)) return false;
  if (!existing) return true;
  if (saved.googleContactStatus === "error") return true;
  if (!saved.googleContactResourceName) return true;
  return clientContactFieldsChanged(existing, saved);
}
