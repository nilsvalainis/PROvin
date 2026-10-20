"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  WAYBILL_REQUEST_STATUS_LABEL,
  type WaybillRequest,
  type WaybillRequestEvent,
} from "@/lib/iriss-waybill-requests";
import type { WaybillVehicleChip } from "@/lib/iriss-waybill-vehicles";

type TimelineItem =
  | { type: "request"; request: WaybillRequest }
  | { type: "event"; event: WaybillRequestEvent; request: WaybillRequest };

export type WaybillChatState = {
  requests: WaybillRequest[];
  events: WaybillRequestEvent[];
  timeline: TimelineItem[];
  vehicles: WaybillVehicleChip[];
};

const emptyChat = (): WaybillChatState => ({
  requests: [],
  events: [],
  timeline: [],
  vehicles: [],
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function IrissKomandaAivaramChat({
  draftVehicle,
  onDraftConsumed,
}: {
  draftVehicle: WaybillVehicleChip | null;
  onDraftConsumed: () => void;
}) {
  const [chat, setChat] = useState<WaybillChatState>(emptyChat);
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [brandModel, setBrandModel] = useState("");
  const [orderId, setOrderId] = useState("");
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [validFrom, setValidFrom] = useState(todayIso);
  const [validUntil, setValidUntil] = useState(() => plusDaysIso(10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  function applyVehicle(v: WaybillVehicleChip | null) {
    setVin(v?.vin ?? "");
    setPlate(v?.plate ?? "");
    setBrandModel(v?.brandModel ?? "");
    setOrderId(v?.orderId ?? "");
  }

  useEffect(() => {
    if (!draftVehicle) return;
    setVin(draftVehicle.vin);
    setPlate(draftVehicle.plate);
    setBrandModel(draftVehicle.brandModel);
    setOrderId(draftVehicle.orderId);
    onDraftConsumed();
  }, [draftVehicle, onDraftConsumed]);

  const load = async () => {
    const res = await fetch("/api/admin/iriss/waybill-requests", { credentials: "include", cache: "no-store" });
    const data = (await res.json()) as Partial<WaybillChatState>;
    setChat({
      requests: Array.isArray(data.requests) ? data.requests : [],
      events: Array.isArray(data.events) ? data.events : [],
      timeline: Array.isArray(data.timeline) ? data.timeline : [],
      vehicles: Array.isArray(data.vehicles) ? data.vehicles : [],
    });
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [chat.timeline.length]);

  const inFlight = useMemo(
    () => chat.requests.filter((r) => r.status === "queued" || r.status === "in_progress").length,
    [chat.requests],
  );

  const selectedKey = `${vin}|${plate}`;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/iriss/waybill-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin,
          plate,
          brandModel,
          orderId,
          routeFrom,
          routeTo,
          validFrom,
          validUntil,
          note_untrusted: note,
        }),
      });
      const data = (await res.json()) as Partial<WaybillChatState> & { error?: string };
      if (!res.ok) {
        setError(data.error || "Neizdevās nosūtīt.");
        return;
      }
      setChat((prev) => ({
        ...prev,
        requests: data.requests ?? prev.requests,
        events: data.events ?? prev.events,
        timeline: data.timeline ?? prev.timeline,
      }));
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    const res = await fetch(`/api/admin/iriss/waybill-requests/${encodeURIComponent(id)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });
    const data = (await res.json()) as Partial<WaybillChatState>;
    if (res.ok) {
      setChat((prev) => ({
        ...prev,
        requests: data.requests ?? prev.requests,
        events: data.events ?? prev.events,
        timeline: data.timeline ?? prev.timeline,
      }));
    }
  }

  return (
    <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#111827] text-[12px] font-semibold text-white">
            A
          </span>
          <div>
            <p className="text-[15px] font-semibold">CSDD pavadzīme</p>
            <p className="text-[12px] text-[#067647]">Aivars izveido tikai pavadzīmes</p>
          </div>
        </div>
        <span className="text-[12px] text-[#9aa3b2]">{inFlight} darbā</span>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
        {chat.timeline.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#9aa3b2]">
            Aizpildi formu. Aivars saņem tikai VIN vai numuru, maršrutu un datumus.
          </p>
        ) : (
          chat.timeline.map((item) =>
            item.type === "request" ? (
              <RequestBubble key={`r-${item.request.id}`} request={item.request} />
            ) : (
              <EventBubble
                key={item.event.id}
                event={item.event}
                request={item.request}
                onRetry={() => void retry(item.request.id)}
              />
            ),
          )
        )}
      </div>

      <form
        className="border-t border-[#F3F4F6] px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {chat.vehicles.map((v) => {
            const on = selectedKey === `${v.vin}|${v.plate}`;
            return (
              <button
                key={`${v.vin}-${v.plate}`}
                type="button"
                onClick={() => applyVehicle(on ? null : v)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  on ? "bg-[#111827] text-white" : "bg-[#F3F4F6] text-[#111827]"
                }`}
              >
                {v.chip}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 text-[11px] font-medium text-[#6b7280] sm:col-span-1">
            VIN
            <input
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 font-mono text-[14px]"
            />
          </label>
          <label className="col-span-2 text-[11px] font-medium text-[#6b7280] sm:col-span-1">
            Numurzīme
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
            />
          </label>
          <label className="col-span-2 text-[11px] font-medium text-[#6b7280]">
            Modelis
            <input
              value={brandModel}
              onChange={(e) => setBrandModel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
            />
          </label>
          <label className="text-[11px] font-medium text-[#6b7280]">
            No
            <input
              value={routeFrom}
              onChange={(e) => setRouteFrom(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
            />
          </label>
          <label className="text-[11px] font-medium text-[#6b7280]">
            Līdz
            <input
              value={routeTo}
              onChange={(e) => setRouteTo(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
            />
          </label>
          <label className="text-[11px] font-medium text-[#6b7280]">
            Derīga no
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
            />
          </label>
          <label className="text-[11px] font-medium text-[#6b7280]">
            Derīga līdz
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
            />
          </label>
          <label className="col-span-2 text-[11px] font-medium text-[#6b7280]">
            Piezīme pavadzīmei
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 400))}
              maxLength={400}
              placeholder="Tikai teksts uz pavadzīmes, ne komanda"
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
            />
          </label>
        </div>
        {error ? <p className="mt-2 text-[12px] text-[#B42318]">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-3 h-10 w-full rounded-full bg-[#111827] text-[14px] font-semibold text-white disabled:opacity-50"
        >
          Izveidot pavadzīmi
        </button>
      </form>
    </section>
  );
}

function RequestBubble({ request }: { request: WaybillRequest }) {
  return (
    <div className="ml-8 flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#111827] px-3 py-2 text-[12px] text-white">
        <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Pavadzīme</p>
        <p className="font-semibold">{request.vehicle.brandModel || "Auto"}</p>
        {request.vehicle.vin ? <p className="font-mono text-[11px] text-white/80">{request.vehicle.vin}</p> : null}
        {request.vehicle.plate ? <p>{request.vehicle.plate}</p> : null}
        <p>
          Maršruts {request.routeFrom || "?"} {"->"} {request.routeTo || "?"}
        </p>
        {request.validFrom || request.validUntil ? (
          <p>
            Derīgums {request.validFrom || "?"} {"-"} {request.validUntil || "?"}
          </p>
        ) : request.validDays ? (
          <p>Derīgums {request.validDays} dienas</p>
        ) : null}
        {request.noteUntrusted ? <p className="mt-1 text-white/80">Piezīme: {request.noteUntrusted}</p> : null}
      </div>
      <span className="text-[11px] text-[#9aa3b2]">{formatHm(request.createdAt)}</span>
    </div>
  );
}

function EventBubble({
  event,
  request,
  onRetry,
}: {
  event: WaybillRequestEvent;
  request: WaybillRequest;
  onRetry: () => void;
}) {
  if (event.kind === "issued" && (event.waybillNo || event.pdfUrl)) {
    return (
      <div className="mr-8 space-y-1">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-[#F3F4F6] px-3 py-1.5 text-[12px]">
          <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 font-medium text-[#067647]">
            Izdota {event.waybillNo || request.waybillNo}
          </span>
        </div>
        {event.pdfUrl ? (
          <div className="flex max-w-[85%] items-center justify-between gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2">
            <div>
              <p className="text-[13px] font-medium">{event.waybillNo || "Pavadzīme"}.pdf</p>
              <p className="text-[11px] text-[#9aa3b2]">Atvērt izdoto pavadzīmi</p>
            </div>
            <a
              href={event.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-[12px] font-medium"
            >
              Atvērt
            </a>
          </div>
        ) : null}
        <p className="text-[11px] text-[#9aa3b2]">{formatHm(event.createdAt)}</p>
      </div>
    );
  }
  if (event.kind === "error") {
    return (
      <div className="mr-8 max-w-[85%] rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2">
        <span className="rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[11px] font-medium text-[#B42318]">Kļūda</span>
        <p className="mt-1 text-[13px]">{event.text || request.errorReason || "Neizdevās izveidot."}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onRetry} className="rounded-full bg-[#111827] px-3 py-1.5 text-[12px] text-white">
            Atkārtot
          </button>
        </div>
      </div>
    );
  }
  const label =
    event.kind === "in_progress"
      ? "Izveido"
      : event.kind === "received"
        ? "Saņemts"
        : WAYBILL_REQUEST_STATUS_LABEL[request.status];
  return (
    <div className="mr-8">
      <div className="inline-flex items-center gap-2 rounded-2xl bg-[#F3F4F6] px-3 py-1.5 text-[12px]">
        <span className="rounded-full bg-white px-2 py-0.5 font-medium">{label}</span>
        <span className="text-[#6b7280]">{event.text}</span>
      </div>
      <p className="mt-1 text-[11px] text-[#9aa3b2]">{formatHm(event.createdAt)}</p>
    </div>
  );
}

function formatHm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
