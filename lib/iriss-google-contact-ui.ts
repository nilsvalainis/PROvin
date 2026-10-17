import { orderHasClientContact } from "@/lib/iriss-google-contact-fields";
import type { IrissGoogleContactStatus, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export type IrissGoogleContactBadge = {
  text: string;
  tone: "ok" | "err" | "muted";
};

export function irissGoogleContactBadge(opts: {
  configured: boolean;
  status?: IrissGoogleContactStatus;
  hasContact: boolean;
}): IrissGoogleContactBadge | null {
  if (!opts.hasContact) return null;
  if (!opts.configured || opts.status === "unconfigured") return { text: "Nav konfigurēts", tone: "muted" };
  if (opts.status === "saved") return { text: "Saglabāts Google kontaktos", tone: "ok" };
  if (opts.status === "error") return { text: "Kļūda", tone: "err" };
  if (opts.status === "skipped") return null;
  return null;
}

export function irissGoogleContactBadgeFromOrder(
  rec: Pick<IrissPasutijumsRecord, "clientFirstName" | "clientLastName" | "phone" | "email" | "googleContactStatus">,
  configured: boolean,
): IrissGoogleContactBadge | null {
  return irissGoogleContactBadge({
    configured,
    status: rec.googleContactStatus,
    hasContact: orderHasClientContact(rec),
  });
}
