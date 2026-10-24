/**
 * Paziņojumi Nilam par klienta lēmumu un termiņa beigām (e-pasts + push).
 * Push teksts bez klienta vārda un tālruņa (redzams bloķētajā ekrānā).
 * Push tikai Nilam (admin lietotājs), ne darbiniekiem (Nila lēmums 23.10 21:01).
 */

import { pushVinTail, type AdminPushMessage } from "@/lib/admin-push-shared";
import { formatOfferDeadlineLv } from "@/lib/iriss-offer-valid-until";

export const IRISS_OFFER_PUSH_USER_KEY = "admin";

export type IrissOfferNotifyFacts = {
  orderId: string;
  offerId: string;
  vehicle: string;
  vin: string;
  clientFirstName: string;
  clientLastName: string;
  total: string;
  deadlineAt: string;
};

export function irissOfferOrderAdminPath(orderId: string): string {
  return `/admin/iriss/pasutijumi/${encodeURIComponent(orderId)}`;
}

/** "Jānis B." - vārds + uzvārda pirmais burts. */
export function irissOfferClientShortName(first: string, last: string): string {
  const f = first.replace(/\s+/g, " ").trim();
  const l = last.replace(/\s+/g, " ").trim();
  const initial = l ? `${Array.from(l)[0]!.toUpperCase()}.` : "";
  return [f, initial].filter(Boolean).join(" ");
}

function vehicleLabel(f: Pick<IrissOfferNotifyFacts, "vehicle">): string {
  return f.vehicle.replace(/\s+/g, " ").trim().slice(0, 120) || "Auto";
}

export function irissOfferDecisionPushMessage(
  f: Pick<IrissOfferNotifyFacts, "orderId" | "offerId" | "vehicle" | "vin">,
  decision: "approve" | "decline",
): AdminPushMessage {
  const vin = pushVinTail(f.vin);
  return {
    title: decision === "approve" ? "Piedāvājums apstiprināts" : "Piedāvājums noraidīts",
    body: `${vehicleLabel(f)}${vin ? ` · ${vin}` : ""}`,
    url: irissOfferOrderAdminPath(f.orderId),
    tag: `offer-${f.offerId}`,
    audience: "iriss",
  };
}

export function irissOfferQuestionPushMessage(
  f: Pick<IrissOfferNotifyFacts, "orderId" | "offerId" | "vehicle" | "vin">,
): AdminPushMessage {
  const vin = pushVinTail(f.vin);
  return {
    title: "Jautājums par piedāvājumu",
    body: `${vehicleLabel(f)}${vin ? ` · ${vin}` : ""}`,
    url: irissOfferOrderAdminPath(f.orderId),
    tag: `offer-${f.offerId}`,
    audience: "iriss",
  };
}

export function irissOfferExpiredPushMessage(
  f: Pick<IrissOfferNotifyFacts, "orderId" | "offerId" | "vehicle" | "vin">,
): AdminPushMessage {
  const vin = pushVinTail(f.vin);
  return {
    title: "Piedāvājuma termiņš beidzies",
    body: `${vehicleLabel(f)}${vin ? ` · ${vin}` : ""} - bez atbildes`,
    url: irissOfferOrderAdminPath(f.orderId),
    tag: `offer-${f.offerId}`,
    audience: "iriss",
  };
}

export type IrissOfferDecisionEmail = {
  subject: string;
  title: string;
  decisionLabel: string;
  approved: boolean;
  lines: { label: string; value: string }[];
  text: string;
  url: string;
};

export function buildIrissOfferDecisionEmail(
  f: IrissOfferNotifyFacts,
  decision: "approve" | "decline",
  decidedAt: string,
  origin: string,
): IrissOfferDecisionEmail {
  const approved = decision === "approve";
  const decisionLabel = approved ? "Apstiprināts" : "Noraidīts";
  const vehicle = vehicleLabel(f);
  const title = `${approved ? "Piedāvājums apstiprināts" : "Piedāvājums noraidīts"}: ${vehicle}`;
  const vin = pushVinTail(f.vin);
  const url = `${origin.replace(/\/$/, "")}${irissOfferOrderAdminPath(f.orderId)}`;
  const lines = [
    { label: "Lēmums", value: decisionLabel },
    { label: "Laiks", value: formatOfferDeadlineLv(decidedAt) },
    { label: "Klients", value: irissOfferClientShortName(f.clientFirstName, f.clientLastName) },
    { label: "Auto", value: `${vehicle}${vin ? ` · VIN ${vin}` : ""}` },
    { label: "Summa", value: f.total.trim() },
    { label: "Termiņš", value: formatOfferDeadlineLv(f.deadlineAt) },
  ].filter((l) => l.value);
  const text = [title, "", ...lines.map((l) => `${l.label}: ${l.value}`), "", `Atvērt pasūtījumu: ${url}`].join("\n");
  return { subject: title, title, decisionLabel, approved, lines, text, url };
}

export type IrissOfferQuestionEmail = {
  subject: string;
  title: string;
  question: string;
  lines: { label: string; value: string }[];
  text: string;
  url: string;
};

export function buildIrissOfferQuestionEmail(f: IrissOfferNotifyFacts, question: string, origin: string): IrissOfferQuestionEmail {
  const vehicle = vehicleLabel(f);
  const title = `Jautājums par piedāvājumu: ${vehicle}`;
  const vin = pushVinTail(f.vin);
  const url = `${origin.replace(/\/$/, "")}${irissOfferOrderAdminPath(f.orderId)}`;
  const lines = [
    { label: "Klients", value: irissOfferClientShortName(f.clientFirstName, f.clientLastName) },
    { label: "Auto", value: `${vehicle}${vin ? ` · VIN ${vin}` : ""}` },
    { label: "Summa", value: f.total.trim() },
  ].filter((l) => l.value);
  const text = [title, "", question, "", ...lines.map((l) => `${l.label}: ${l.value}`), "", `Atvērt pasūtījumu: ${url}`].join("\n");
  return { subject: title, title, question, lines, text, url };
}
