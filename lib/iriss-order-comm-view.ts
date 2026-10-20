import type { IrissCommTimelineItem } from "@/lib/iriss-communication-timeline";

export const IRISS_COMM_VISI = "Visi";
export const IRISS_COMM_TYPE_ALL = "Viss";
export const IRISS_COMM_SENT = "Nosūtīts";
export const IRISS_COMM_REPLY = "Klienta atbilde";
export const IRISS_COMM_MISSED = "Neatzīmēts zvans";
export const IRISS_COMM_QUICK = "Ātrā saziņa";
export const IRISS_COMM_TEMPLATES = "Šabloni";
export const IRISS_COMM_NOTES = "Piezīmes";
export const IRISS_COMM_COMPOSER = "Rakstīt piezīmi vai WhatsApp melnrakstu…";

export const IRISS_COMM_TYPE_FILTERS = [
  { id: "all", label: "Viss" },
  { id: "sent", label: "Nosūtīts" },
  { id: "answered", label: "Klienta atbilde" },
  { id: "missed", label: "Neatzīmēts zvans" },
] as const;

export type IrissCommTypeFilter = (typeof IRISS_COMM_TYPE_FILTERS)[number]["id"];

export function formatIrissCommDateLeft(stamp: string): { date: string; time: string } {
  const m = stamp.trim().match(/^(\d{2}\.\d{2})\s+(\d{2}:\d{2})$/);
  return m ? { date: m[1]!, time: m[2]! } : { date: stamp.trim(), time: "" };
}

export function irissCommBubbleSide(item: Pick<IrissCommTimelineItem, "status" | "title" | "kind">): "ours" | "client" {
  if (item.status === "answered" || item.status === "opened") return "client";
  if (/Klienta atbilde|Klients atvēra|Klients vēlas/i.test(item.title)) return "client";
  return "ours";
}

export function irissCommTypeMatches(
  item: Pick<IrissCommTimelineItem, "status" | "title">,
  type: IrissCommTypeFilter,
): boolean {
  if (type === "all") return true;
  if (type === "sent") return item.status === "sent" || /Nosūtīts/i.test(item.title);
  if (type === "answered") return item.status === "answered" || /Klienta atbilde|Klients atvēra/i.test(item.title);
  return item.status === "missed" || /Neatzīmēts zvans/i.test(item.title);
}
