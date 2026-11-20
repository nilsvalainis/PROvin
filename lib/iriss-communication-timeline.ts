/**
 * IRISS pasūtījuma komunikācijas vēsture.
 * Apvieno jau esošos datus (piezīmes, statusi, piedāvājumi, avanss, PDF)
 * ar neobligātu operatora žurnālu. Vecos JSON nemaina.
 */

import { applyProvinHumanDashes } from "@/lib/source-summary-comment-format";
import {
  irissAdvanceHasContent,
  irissAdvanceMethodLabel,
  parseIrissAdvanceAmount,
  type IrissAdvanceDraft,
} from "@/lib/iriss-advance";
import { formatIrissOfferLinkStamp, type IrissOfferClientLinkAdminView } from "@/lib/iriss-offer-client-link";
import { irissPdNumberLabel, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import {
  displayIrissPasutijumsListStatusLabel,
  IRISS_ORDER_STAGE_LV,
  type IrissGeneratedDocument,
  type IrissOfferRecord,
  type IrissPasutijumsRecord,
  type IrissStatusHistoryEntry,
} from "@/lib/iriss-pasutijumi-types";

export const IRISS_COMM_CHANNELS = [
  "all",
  "call",
  "whatsapp",
  "email",
  "offer",
  "advance",
  "status",
] as const;

export type IrissCommFilter = (typeof IRISS_COMM_CHANNELS)[number];

export const IRISS_COMM_CHANNEL_LV: Record<IrissCommFilter, string> = {
  all: "Visi",
  call: "Zvani",
  whatsapp: "WhatsApp",
  email: "E-pasti",
  offer: "Piedāvājumi",
  advance: "Avanss",
  status: "Statuss",
};

export type IrissCommKind =
  | "note"
  | "call"
  | "whatsapp"
  | "email"
  | "offer"
  | "advance"
  | "status"
  | "document";

export type IrissCommStatus =
  | "sent"
  | "opened"
  | "received"
  | "answered"
  | "missed"
  | "note"
  | "logged";

export type IrissCommunicationEvent = {
  id: string;
  at: string;
  kind: IrissCommKind;
  title: string;
  body?: string;
  status?: IrissCommStatus;
  durationMin?: number;
};

export type IrissCommTimelineItem = IrissCommunicationEvent & {
  stamp: string;
  statusLabel: string;
  derived: boolean;
};

const STATUS_LV: Record<IrissCommStatus, string> = {
  sent: "Nosūtīts",
  opened: "Atvērts",
  received: "Saņemts",
  answered: "Atbildēts",
  missed: "Neatbildēja",
  note: "Piezīme",
  logged: "Ierakstīts",
};

function clip(v: unknown, max: number): string {
  const t = typeof v === "string" ? applyProvinHumanDashes(v) : "";
  return t.length > max ? t.slice(0, max) : t;
}

function isIso(raw: string): boolean {
  return raw.trim().length >= 10 && Number.isFinite(Date.parse(raw));
}

export function irissCommStatusLabel(status: IrissCommStatus | undefined): string {
  return status ? STATUS_LV[status] : "";
}

export function normalizeIrissCommunicationEvents(raw: unknown): IrissCommunicationEvent[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: IrissCommunicationEvent[] = [];
  for (const item of raw.slice(0, 200)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = clip(o.id, 64);
    const at = clip(o.at, 64);
    const kind = typeof o.kind === "string" ? o.kind : "";
    const title = clip(o.title, 240);
    if (!id || !isIso(at) || !title) continue;
    if (!["note", "call", "whatsapp", "email", "offer", "advance", "status", "document"].includes(kind)) {
      continue;
    }
    const statusRaw = typeof o.status === "string" ? o.status : "";
    const status = (
      ["sent", "opened", "received", "answered", "missed", "note", "logged"] as const
    ).includes(statusRaw as IrissCommStatus)
      ? (statusRaw as IrissCommStatus)
      : undefined;
    const durationRaw = typeof o.durationMin === "number" ? o.durationMin : Number(o.durationMin);
    out.push({
      id,
      at,
      kind: kind as IrissCommKind,
      title,
      ...(clip(o.body, 4000) ? { body: clip(o.body, 4000) } : {}),
      ...(status ? { status } : {}),
      ...(Number.isFinite(durationRaw) && durationRaw > 0
        ? { durationMin: Math.min(240, Math.round(durationRaw)) }
        : {}),
    });
  }
  return out.length ? out : undefined;
}

function stampFromIso(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const hour = get("hour");
  const minute = get("minute");
  if (!day || !month) return "";
  return `${day}.${month} ${hour}:${minute}`;
}

function item(
  event: IrissCommunicationEvent,
  derived: boolean,
): IrissCommTimelineItem {
  return {
    ...event,
    title: applyProvinHumanDashes(event.title),
    body: event.body ? applyProvinHumanDashes(event.body) : event.body,
    stamp: stampFromIso(event.at),
    statusLabel: irissCommStatusLabel(event.status),
    derived,
  };
}

function noteLines(notes: string): string[] {
  return notes
    .split(/\n+/)
    .map((line) => applyProvinHumanDashes(line).trim())
    .filter(Boolean);
}

export function deriveIrissCommunicationTimeline(input: {
  notes: string;
  /** Pasūtījuma izveides laiks - piezīmēm bez laika, ja statusu vēstures vēl nav (agrāk 1970-01-01 = "01.01 03:00"). */
  createdAt?: string;
  statusHistory?: IrissStatusHistoryEntry[];
  offers?: IrissOfferRecord[];
  generatedDocuments?: IrissGeneratedDocument[];
  advance?: IrissAdvanceDraft;
  storedEvents?: IrissCommunicationEvent[];
  offerLinks?: IrissOfferClientLinkAdminView[];
  /** Nils 20.11 (audits 4): jaunās PD sistēmas notikumi (`irissPdCommunicationEvents`). */
  pdEvents?: IrissCommunicationEvent[];
}): IrissCommTimelineItem[] {
  const out: IrissCommTimelineItem[] = [];
  const seen = new Set<string>();
  const push = (event: IrissCommunicationEvent, derived: boolean) => {
    if (seen.has(event.id)) return;
    seen.add(event.id);
    out.push(item(event, derived));
  };

  for (const ev of input.storedEvents ?? []) push(ev, false);

  noteLines(input.notes).forEach((line, index) => {
    const stamped = line.match(/^(\d{2}\.\d{2}\s+\d{2}:\d{2})\s+([\s\S]+)$/);
    push(
      {
        id: `note-${index}`,
        at: input.statusHistory?.[0]?.at || input.createdAt || "1970-01-01T00:00:00.000Z",
        kind: "note",
        title: stamped?.[2] ?? line,
        status: "note",
      },
      true,
    );
  });

  for (const entry of input.statusHistory ?? []) {
    push(
      {
        id: `status-${entry.at}-${entry.from}-${entry.to}`,
        at: entry.at,
        kind: "status",
        title: applyProvinHumanDashes(
          // P5: posma maiņa ar roku - rāda posmu (piem. «Rezervēts -> Ceļā»).
          entry.stage
            ? `${displayIrissPasutijumsListStatusLabel(entry.from)} -> ${IRISS_ORDER_STAGE_LV[entry.stage]}`
            : `${displayIrissPasutijumsListStatusLabel(entry.from)} -> ${displayIrissPasutijumsListStatusLabel(entry.to)}`,
        ),
        body: entry.reason,
        status: "logged",
      },
      true,
    );
  }

  (input.offers ?? []).forEach((offer, index) => {
    push(
      {
        id: `offer-${offer.id}`,
        at: offer.createdAt || offer.updatedAt,
        kind: "offer",
        title: offer.title.trim() || `Piedāvājums ${index + 1}`,
        body: offer.brandModel.trim() || undefined,
        status: "sent",
      },
      true,
    );
  });

  for (const link of input.offerLinks ?? []) {
    if (link.firstViewedAt) {
      push(
        {
          id: `link-open-${link.offerId}-${link.firstViewedAt}`,
          at: link.firstViewedAt,
          kind: "offer",
          title: "Klients atvēra piedāvājuma saiti",
          body: formatIrissOfferLinkStamp(link.firstViewedAt) || undefined,
          status: "opened",
        },
        true,
      );
    }
    if (link.question?.trim()) {
      push(
        {
          id: `link-q-${link.offerId}`,
          at: link.questionAt || link.createdAt,
          kind: "offer",
          title: "Klienta jautājums",
          body: link.question.trim(),
          status: "answered",
        },
        true,
      );
    }
    if (link.decision === "approve" || link.decision === "decline") {
      push(
        {
          id: `link-dec-${link.offerId}`,
          at: link.decidedAt || link.createdAt,
          kind: "offer",
          title: link.decision === "approve" ? "Piedāvājums apstiprināts" : "Piedāvājums noraidīts",
          status: link.decision === "approve" ? "received" : "logged",
        },
        true,
      );
    }
  }

  for (const ev of input.pdEvents ?? []) push(ev, true);

  if (input.advance && irissAdvanceHasContent(input.advance)) {
    const amount = parseIrissAdvanceAmount(input.advance.amount);
    const paid = input.advance.paidAt ? `${input.advance.paidAt}T12:00:00.000Z` : "";
    if (paid) {
      push(
        {
          id: `advance-${input.advance.invoiceNo || input.advance.paidAt}`,
          at: paid,
          kind: "advance",
          title: amount > 0 ? `Avanss ${Math.round(amount)} € saņemts` : "Avanss saņemts",
          body: [
            irissAdvanceMethodLabel(input.advance.method),
            input.advance.invoiceNo ? `rēķins ${input.advance.invoiceNo}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          status: "received",
        },
        true,
      );
    }
  }

  for (const doc of input.generatedDocuments ?? []) {
    push(
      {
        id: `doc-${doc.id}`,
        at: doc.createdAt,
        kind: "document",
        title: doc.name || "Dokuments",
        status: "sent",
      },
      true,
    );
  }

  out.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  return out;
}

export function filterIrissCommunicationTimeline(
  items: readonly IrissCommTimelineItem[],
  filter: IrissCommFilter,
): IrissCommTimelineItem[] {
  if (filter === "all") return [...items];
  return items.filter((item) => {
    if (filter === "offer") return item.kind === "offer";
    if (filter === "advance") return item.kind === "advance";
    if (filter === "status") return item.kind === "status";
    return item.kind === filter;
  });
}

export function irissCommunicationCount(items: readonly IrissCommTimelineItem[]): number {
  return items.length;
}

export function appendIrissCommunicationEvent(
  prev: IrissCommunicationEvent[] | undefined,
  event: IrissCommunicationEvent,
): IrissCommunicationEvent[] {
  const next = [...(prev ?? []).filter((row) => row.id !== event.id), event];
  next.sort((a, b) => a.at.localeCompare(b.at));
  return next.slice(-200);
}

export function newIrissCommunicationEvent(
  kind: IrissCommKind,
  title: string,
  opts?: { body?: string; status?: IrissCommStatus; durationMin?: number; at?: string },
): IrissCommunicationEvent {
  const at = opts?.at || new Date().toISOString();
  return {
    id: `op-${kind}-${at}`,
    at,
    kind,
    title: applyProvinHumanDashes(title).trim() || "Ieraksts",
    ...(opts?.body ? { body: applyProvinHumanDashes(opts.body).trim() } : {}),
    ...(opts?.status ? { status: opts.status } : {}),
    ...(opts?.durationMin && opts.durationMin > 0 ? { durationMin: opts.durationMin } : {}),
  };
}

export function timelineFromPasutijums(
  rec: IrissPasutijumsRecord,
  offerLinks: IrissOfferClientLinkAdminView[] = [],
  pdEvents: IrissCommunicationEvent[] = [],
): IrissCommTimelineItem[] {
  return deriveIrissCommunicationTimeline({
    notes: rec.notes,
    createdAt: rec.createdAt,
    statusHistory: rec.statusHistory,
    offers: rec.offers,
    generatedDocuments: rec.generatedDocuments,
    advance: rec.advance,
    storedEvents: rec.communicationEvents,
    offerLinks,
    pdEvents,
  });
}

/**
 * Nils 20.11 (audits 4): jaunās PD sistēmas notikumi pasūtījuma «Komunikācija» laika joslā
 * (izveidots, nosūtīts, atvērts klientam, jautājums, apstiprināts, noraidīts, atcelts) - līdzās vecajiem piedāvājumiem.
 * Tīra funkcija: no PD vēstures, klienta ziņām un pirmās atvēršanas laika. Cenas un iekšējās piezīmes netiek iekļautas.
 */

/** = IRISS_PD_CLIENT_ACTOR (lib/iriss-piedavajumi; tests pārbauda vienādību - šeit bez smagā importa). */
export const IRISS_PD_COMM_CLIENT_ACTOR = "Klients (piedāvājuma saite)";
const CLIENT_ACTOR = IRISS_PD_COMM_CLIENT_ACTOR;

function afterColon(text: string): string {
  const i = text.indexOf(":");
  return i >= 0 ? text.slice(i + 1).trim() : "";
}

export function irissPdCommunicationEvents(
  rec: Pick<IrissPiedavajums, "id" | "number" | "createdAt" | "history" | "messages" | "vehicle">,
  opts: { firstViewedAt?: string } = {},
): IrissCommunicationEvent[] {
  const label = irissPdNumberLabel(rec.number);
  const out: IrissCommunicationEvent[] = [];
  const add = (id: string, at: string, title: string, status: IrissCommunicationEvent["status"], body?: string) => {
    if (!at || !Number.isFinite(Date.parse(at))) return;
    out.push({ id: `pd-${rec.id}-${id}`.slice(0, 64), at, kind: "offer", title, status, ...(body ? { body } : {}) });
  };
  const created = rec.createdAt || rec.history[0]?.at || "";
  add("created", created, `${label} izveidots`, "logged", rec.vehicle.title.trim() || undefined);
  rec.history.forEach((h, i) => {
    const id = `h${i}`;
    const who = h.by === CLIENT_ACTOR ? "klients saitē" : h.by ? `atzīmēja ${h.by}` : "";
    if (h.text.startsWith("Nosūtīts")) add(id, h.at, `${label} nosūtīts klientam`, "sent");
    else if (h.text.startsWith("Atjaunots - klientam atkal pieejams")) add(id, h.at, `${label} atkal pieejams klientam`, "sent");
    else if (h.text === "Apstiprināts") add(id, h.at, `${label} apstiprināts`, "received", who || undefined);
    else if (h.text === "Atzīmēts kā noraidīts") add(id, h.at, `${label} noraidīts`, "logged", who || undefined);
    else if (h.text.startsWith("Klients noraidīja")) add(id, h.at, `${label} klients noraidīja`, "received", afterColon(h.text) || undefined);
    else if (h.text.startsWith("Darījums atcelts")) add(id, h.at, `${label} darījums atcelts`, "logged", afterColon(h.text) || undefined);
  });
  for (const m of rec.messages) {
    if (m.from !== "client" || m.kind !== "question") continue;
    add(`q-${m.id}`, m.at, `${label} klienta jautājums`, m.answeredAt ? "answered" : "received", m.text);
  }
  if (opts.firstViewedAt) add("open", opts.firstViewedAt, `${label} klients atvēra saiti`, "opened");
  return out;
}
