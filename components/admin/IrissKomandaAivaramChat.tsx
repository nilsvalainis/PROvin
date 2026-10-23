"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  WAYBILL_REQUEST_STATUS_LABEL,
  isStaleWaybillRequest,
  waybillAivarsReply,
  waybillChatTimelineNewestFirst,
  waybillRequestCancellable,
  type WaybillAivarsReply,
  type WaybillRequest,
  type WaybillRequestEvent,
  type WaybillRequestStatus,
} from "@/lib/iriss-waybill-requests";
import {
  DEFAULT_WAYBILL_ROUTE_FROM,
  DEFAULT_WAYBILL_ROUTE_TO,
  NOTE_UNTRUSTED_MAX,
  WAYBILL_VALID_MAX_HOURS,
  waybillHoursBetween,
} from "@/lib/iriss-waybill-create";
import {
  IRISS_DEALER_PLATES,
  dealerPlateMeta,
  displayDealerPlate,
  emptyWaybillPlateStates,
  formatRigaDateTimeComma,
  type WaybillPlateCurrent,
  type WaybillPlateState,
} from "@/lib/iriss-waybill-plates";
import { formatWaybillExpiryDdMmHm } from "@/lib/iriss-pavadzimes-countdown";
import { LvDealerPlate } from "@/components/admin/LvDealerPlate";
import { IrissWaybillMobileForm, confirmWaybillCancel, type WaybillMobileDraft } from "@/components/admin/IrissWaybillMobileForm";
import { IrissWaybillSavePdfButton } from "@/components/admin/IrissWaybillSavePdfButton";
import { waybillDropboxFileName, waybillPdfDownloadHref } from "@/lib/iriss-waybill-pdf";
import {
  WAYBILL_FORM_DEFAULT_HOURS,
  WAYBILL_MOBILE_HOUR_PRESETS,
  parseWaybillCustomHours,
  type WaybillMobilePayload,
} from "@/lib/iriss-waybill-mobile-form";
import type { WaybillTradeCar } from "@/lib/iriss-waybill-trade-cars";
import type { WaybillVehicleChip } from "@/lib/iriss-waybill-vehicles";

type TimelineItem =
  | { type: "request"; request: WaybillRequest }
  | { type: "event"; event: WaybillRequestEvent; request: WaybillRequest };

export type WaybillChatState = {
  requests: WaybillRequest[];
  events: WaybillRequestEvent[];
  timeline: TimelineItem[];
  replies: WaybillAivarsReply[];
  vehicles: WaybillVehicleChip[];
  plates: WaybillPlateState[];
};

const emptyChat = (): WaybillChatState => ({
  requests: [],
  events: [],
  timeline: [],
  replies: [],
  vehicles: [],
  plates: emptyWaybillPlateStates(),
});

function withReplies(partial: Partial<WaybillChatState>): WaybillChatState {
  const requests = Array.isArray(partial.requests) ? partial.requests : [];
  const events = Array.isArray(partial.events) ? partial.events : [];
  return {
    requests,
    events,
    timeline: Array.isArray(partial.timeline) ? partial.timeline : [],
    replies: Array.isArray(partial.replies) && partial.replies.length
      ? partial.replies
      : requests.map((request) => waybillAivarsReply(request, events)),
    vehicles: Array.isArray(partial.vehicles) ? partial.vehicles : [],
    plates: Array.isArray(partial.plates) && partial.plates.length ? partial.plates : emptyWaybillPlateStates(),
  };
}

type ChatOk = WaybillChatState;
type ChatBusy = { busy: true; plate: string; current?: WaybillPlateCurrent; error?: string };
type ChatErr = { error: string };
type ChatResponse = ChatOk | ChatBusy | ChatErr;

function isChatBusy(data: ChatResponse): data is ChatBusy {
  return typeof data === "object" && data !== null && "busy" in data && data.busy === true;
}

function isChatOk(data: ChatResponse): data is ChatOk {
  if (typeof data !== "object" || data === null || isChatBusy(data)) return false;
  const row = data as Partial<WaybillChatState>;
  return (
    Array.isArray(row.requests) &&
    Array.isArray(row.events) &&
    Array.isArray(row.timeline) &&
    Array.isArray(row.replies) &&
    Array.isArray(row.vehicles) &&
    Array.isArray(row.plates)
  );
}

function isChatError(data: ChatResponse): data is ChatErr {
  return typeof data === "object" && data !== null && "error" in data && !isChatBusy(data) && !isChatOk(data);
}

function chatErrorMessage(data: ChatResponse, fallback: string): string {
  if (isChatError(data) && data.error) return data.error;
  return fallback;
}

async function readChatResponse(res: Response): Promise<ChatResponse> {
  let data: Partial<WaybillChatState> & {
    error?: string;
    busy?: boolean;
    plate?: string;
    current?: WaybillPlateCurrent;
  } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { error: "Neizdevās nolasīt atbildi." };
  }
  if (res.status === 409 && data.busy) {
    return { busy: true, plate: data.plate || "", current: data.current, error: data.error };
  }
  if (!res.ok) return { error: data.error || "Neizdevās nosūtīt." };
  return withReplies(data);
}

function tradeCarsFrom(data: unknown): { cars: WaybillTradeCar[]; fromAutoparks: boolean } | null {
  if (!data || typeof data !== "object") return null;
  const { tradeCars: list, tradeCarsSource } = data as { tradeCars?: unknown; tradeCarsSource?: unknown };
  return Array.isArray(list) ? { cars: list as WaybillTradeCar[], fromAutoparks: tradeCarsSource === "autoparks" } : null;
}

function firstFreePlate(plates: WaybillPlateState[]): string {
  return plates.find((row) => !row.busy)?.plate || IRISS_DEALER_PLATES[0];
}

function requestHours(request: WaybillRequest): number {
  if (request.validHours && request.validHours >= 1) return request.validHours;
  return waybillHoursBetween(request.validFrom, request.validUntil) ?? request.validDays ?? 0;
}

export function IrissKomandaAivaramChat({
  draftVehicle,
  onDraftConsumed,
  onOpenArchive,
}: {
  draftVehicle: WaybillVehicleChip | null;
  onDraftConsumed: () => void;
  /** Telefonā: "Visas pavadzīmes Arhīvā ›". */
  onOpenArchive?: () => void;
}) {
  const [chat, setChat] = useState<WaybillChatState>(emptyChat);
  const [plate, setPlate] = useState<string>(IRISS_DEALER_PLATES[0]);
  const [brandModel, setBrandModel] = useState("");
  const [vin, setVin] = useState("");
  /** null = "Cits" (brīvs stundu skaits). Izvēles tās pašas kā telefonā: 1, 12, 48 h, Cits. */
  const [hoursPreset, setHoursPreset] = useState<number | null>(WAYBILL_FORM_DEFAULT_HOURS);
  const [hoursOther, setHoursOther] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ plate: string; current?: WaybillPlateCurrent } | null>(null);
  const [tradeCars, setTradeCars] = useState<WaybillTradeCar[] | null>(null);
  const [tradeCarsFromAutoparks, setTradeCarsFromAutoparks] = useState(false);
  const [mobileDraft, setMobileDraft] = useState<WaybillMobileDraft | null>(null);
  const selectedInit = useRef(false);
  const carsLoaded = useRef(false);
  /** Telefona formas dati pēdējam sūtījumam (vajag "Tomēr izveidot" logam). */
  const mobilePayload = useRef<WaybillMobilePayload | null>(null);

  useEffect(() => {
    if (!draftVehicle) return;
    const nextPlate = displayDealerPlate(draftVehicle.plate);
    if (nextPlate) setPlate(nextPlate);
    setBrandModel(draftVehicle.brandModel);
    setVin(draftVehicle.vin);
    setMobileDraft({ nonce: Date.now(), brandModel: draftVehicle.brandModel, vin: draftVehicle.vin, plate: nextPlate || "" });
    onDraftConsumed();
  }, [draftVehicle, onDraftConsumed]);

  const load = async (withCars = false) => {
    try {
      const url = withCars ? "/api/admin/iriss/waybill-requests?cars=1" : "/api/admin/iriss/waybill-requests";
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
      const raw = res.clone();
      const data = await readChatResponse(res);
      if (withCars) {
        const cars = tradeCarsFrom(await raw.json().catch(() => null));
        if (cars) {
          carsLoaded.current = true;
          setTradeCars(cars.cars);
          setTradeCarsFromAutoparks(cars.fromAutoparks);
        }
      }
      if (isChatBusy(data)) return;
      if (isChatError(data) || !isChatOk(data)) {
        const message = chatErrorMessage(data, "Neizdevās ielādēt rindu.");
        setChat((prev) => {
          if (!prev.requests.length && !prev.timeline.length) {
            setError((current) => current ?? message);
          }
          return prev;
        });
        return;
      }
      setChat(data);
      if (!selectedInit.current) {
        selectedInit.current = true;
        setPlate((current) => displayDealerPlate(current) || firstFreePlate(data.plates));
      }
    } catch {
      setError((prev) => prev ?? "Neizdevās ielādēt rindu.");
    }
  };

  // Dzīvais statuss bez atjaunošanas: kamēr kaut kas ir darbā - ik 3 s, citādi ik 10 s (paslēptā cilnē nelādē).
  const working = chat.requests.some((r) => (r.status === "queued" || r.status === "in_progress") && !isStaleWaybillRequest(r));
  useEffect(() => {
    void load(true);
  }, []);
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, working ? 3000 : 10_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [working]);

  // Jaunākais augšā: saraksts vienmēr sākas augšā (agrāk ritināja uz apakšu, kur bija vecākais).
  const timeline = useMemo(() => waybillChatTimelineNewestFirst(chat.timeline), [chat.timeline]);

  // Novecojušie (24 h bez virzības) nav "darbā" - tie ir Arhīvā.
  const inFlight = useMemo(
    () => chat.requests.filter((r) => (r.status === "queued" || r.status === "in_progress") && !isStaleWaybillRequest(r)).length,
    [chat.requests],
  );

  const hoursChosen = hoursPreset ?? parseWaybillCustomHours(hoursOther);
  const untilHint = hoursChosen ? formatRigaDateTimeComma(new Date(Date.now() + hoursChosen * 3_600_000).toISOString()) : "";
  const selectedOcc = chat.plates.find((row) => row.plate === plate) ?? { plate, busy: false };

  async function submit(confirmBusy = false): Promise<boolean> {
    setError(null);
    setBusy(true);
    const mobile = mobilePayload.current;
    // Anulēt drīkst tikai to pavadzīmi, ko lietotājs redzēja logā (ja tā tikmēr mainījusies - serveris jautās vēlreiz).
    const confirmWaybillNo = confirmBusy ? (confirm?.current?.number ?? "") : "";
    try {
      const res = await fetch("/api/admin/iriss/waybill-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mobile
            ? { ...mobile, confirmBusy, confirmWaybillNo }
            : {
                plate,
                brandModel,
                vin,
                validHours: hoursChosen,
                comment_untrusted: comment,
                confirmBusy,
                confirmWaybillNo,
              },
        ),
      });
      const data = await readChatResponse(res);
      if (isChatBusy(data)) {
        setConfirm({ plate: data.plate || mobile?.plate || plate, current: data.current });
        return false;
      }
      if (isChatError(data) || !isChatOk(data)) {
        setError(chatErrorMessage(data, "Neizdevās nosūtīt."));
        return false;
      }
      setChat((prev) => ({
        ...withReplies(data),
        vehicles: data.vehicles.length ? data.vehicles : prev.vehicles,
        plates: data.plates.length ? data.plates : prev.plates,
      }));
      if (!mobile) setComment("");
      setConfirm(null);
      mobilePayload.current = null;
      return true;
    } catch {
      setError("Neizdevās nosūtīt.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Telefona forma: aizņemtam numuram vispirms tas pats apstiprinājuma logs. */
  async function submitMobile(payload: WaybillMobilePayload): Promise<boolean> {
    mobilePayload.current = payload;
    const occ = chat.plates.find((row) => row.plate === displayDealerPlate(payload.plate));
    if (occ?.busy) {
      setConfirm({ plate: occ.plate, current: occ.current });
      return false;
    }
    return submit(false);
  }

  function onSubmitForm() {
    mobilePayload.current = null;
    if (!hoursChosen) {
      setError(`Ieraksti derīgumu: no 1 līdz ${WAYBILL_VALID_MAX_HOURS} h.`);
      return;
    }
    if (selectedOcc.busy && !confirm) {
      setConfirm({ plate: selectedOcc.plate, current: selectedOcc.current });
      return;
    }
    void submit(Boolean(confirm));
  }

  async function cancel(id: string) {
    try {
      const res = await fetch(`/api/admin/iriss/waybill-requests/${encodeURIComponent(id)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await readChatResponse(res);
      if (isChatBusy(data) || isChatError(data) || !isChatOk(data)) {
        setError(chatErrorMessage(data, "Neizdevās atcelt."));
        void load();
        return;
      }
      setChat((prev) => ({
        ...withReplies(data),
        vehicles: data.vehicles.length ? data.vehicles : prev.vehicles,
        plates: data.plates.length ? data.plates : prev.plates,
      }));
    } catch {
      setError("Neizdevās atcelt.");
    }
  }

  async function retry(id: string) {
    try {
      const res = await fetch(`/api/admin/iriss/waybill-requests/${encodeURIComponent(id)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      const data = await readChatResponse(res);
      if (isChatBusy(data) || isChatError(data) || !isChatOk(data)) {
        setError(chatErrorMessage(data, "Neizdevās atkārtot."));
        return;
      }
      setChat((prev) => ({
        ...withReplies(data),
        vehicles: data.vehicles.length ? data.vehicles : prev.vehicles,
        plates: data.plates.length ? data.plates : prev.plates,
      }));
    } catch {
      setError("Neizdevās atkārtot.");
    }
  }

  /** Admins: "Saglabāt Dropbox vēlreiz" pēc kļūdas (serveris kolēģim to aizliedz). */
  async function retryDropbox(id: string) {
    try {
      const res = await fetch(`/api/admin/iriss/waybill-requests/${encodeURIComponent(id)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dropbox" }),
      });
      const json = (await res.json().catch(() => null)) as (Partial<WaybillChatState> & { error?: string }) | null;
      if (json && Array.isArray(json.requests)) {
        setChat((prev) => ({ ...withReplies(json), vehicles: prev.vehicles, plates: prev.plates }));
      }
      if (!res.ok) setError(json?.error ? `Dropbox: ${json.error}` : "Neizdevās saglabāt Dropbox.");
    } catch {
      setError("Neizdevās saglabāt Dropbox.");
    }
  }

  return (
    <>
    <div className="md:hidden">
      <IrissWaybillMobileForm
        plates={chat.plates}
        tradeCars={tradeCars}
        tradeCarsFromAutoparks={tradeCarsFromAutoparks}
        requests={chat.requests}
        replies={chat.replies}
        busy={busy}
        error={confirm ? null : error}
        draft={mobileDraft}
        onSubmit={submitMobile}
        onRetry={(id) => void retry(id)}
        onCancel={(id) => void cancel(id)}
        onPickerOpen={() => {
          if (!carsLoaded.current) void load(true);
        }}
        onOpenArchive={onOpenArchive}
      />
    </div>
    <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-white shadow-sm max-md:hidden">
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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
        {timeline.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#9aa3b2]">
            Izvēlies numuru, marku un stundas. Aivars saņem tikai šīs pavadzīmes datus.
          </p>
        ) : (
          timeline.map((item) =>
            item.type === "request" ? (
              <RequestBubble
                key={`r-${item.request.id}`}
                request={item.request}
                reply={chat.replies.find((row) => row.requestId === item.request.id) ?? waybillAivarsReply(item.request, chat.events)}
                onCancel={() => void cancel(item.request.id)}
                onRetryDropbox={() => void retryDropbox(item.request.id)}
              />
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
          onSubmitForm();
        }}
      >
        <p className="mb-1 text-[11px] font-medium text-[#6b7280]">Numurs</p>
        {/* Telefonā - kompaktās pilles (pirms #382); zīmētās numurzīmes tikai no md. */}
        <div className="mb-2 flex gap-1.5 md:hidden">
          {chat.plates.map((row) => {
            const on = plate === row.plate;
            return (
              <button
                key={row.plate}
                type="button"
                aria-pressed={on}
                onClick={() => setPlate(row.plate)}
                className={`min-h-11 min-w-0 flex-1 rounded-full px-2 py-1.5 text-[12px] font-semibold ${
                  on ? "bg-[#111827] text-white" : "bg-[#F3F4F6] text-[#111827]"
                }`}
              >
                {row.plate}
                <small
                  className={`mt-0.5 block text-[10px] font-medium ${
                    on ? "text-white/70" : row.busy ? "text-[#b45309]" : "text-[#067647]"
                  }`}
                >
                  {row.busy ? "aizņemts" : "brīvs"}
                </small>
              </button>
            );
          })}
        </div>
        <div className="mb-2 hidden md:flex md:flex-row md:items-start md:gap-3.5">
          {chat.plates.map((row) => {
            const meta = dealerPlateMeta(row.plate);
            return (
              <LvDealerPlate
                key={row.plate}
                number={row.plate}
                selected={plate === row.plate}
                busy={row.busy}
                owner={meta.owner}
                bottomText={meta.bottomText}
                busyUntil={row.current?.validUntil ? formatWaybillExpiryDdMmHm(row.current.validUntil) : ""}
                onClick={() => setPlate(row.plate)}
              />
            );
          })}
        </div>
        <label className="mb-2 block text-[11px] font-medium text-[#6b7280]">
          Marka, modelis
          <input
            value={brandModel}
            onChange={(e) => setBrandModel(e.target.value)}
            required
            maxLength={120}
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
          />
        </label>
        <label className="mb-2 block text-[11px] font-medium text-[#6b7280]">
          VIN <span className="font-normal">(nav obligāts)</span>
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={17}
            placeholder="17 zīmes"
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 font-mono text-[14px]"
          />
          <span className="mt-1 block text-[11px] font-normal leading-snug text-[#9aa3b2]">
            Ja ievadīts VIN, Aivars meklē auto starp tirdzniecībā pieņemtajiem. Ja neatrod, izraksta pavadzīmi ar
            sākumpunktu; beigu punkts pēc noklusējuma ir Tukuma CSDD.
          </span>
        </label>
        <div className="mb-2 text-[11px] font-medium text-[#6b7280]">
          Derīgums
          <div className="mt-1 grid grid-cols-4 gap-1.5" role="group" aria-label="Derīgums">
            {[...WAYBILL_MOBILE_HOUR_PRESETS, null].map((h) => {
              const on = hoursPreset === h;
              return (
                <button
                  key={h ?? "cits"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setHoursPreset(h)}
                  className={`min-h-10 rounded-full px-2 text-[13px] font-semibold ${on ? "bg-[#111827] text-white" : "bg-[#F3F4F6] text-[#111827]"}`}
                >
                  {h == null ? "Cits" : `${h} h`}
                </button>
              );
            })}
          </div>
          {hoursPreset == null ? (
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={hoursOther}
              onChange={(e) => setHoursOther(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={`stundas, 1-${WAYBILL_VALID_MAX_HOURS}`}
              aria-label="Cits derīguma ilgums stundās"
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
            />
          ) : null}
          <span className="mt-1 block text-[11px] font-normal leading-snug text-[#9aa3b2]">
            {hoursChosen
              ? `Sākums: tagad. Beigas: tagad + ${hoursChosen} h${untilHint ? ` (${untilHint}).` : "."}`
              : `Ieraksti stundas: no 1 līdz ${WAYBILL_VALID_MAX_HOURS}.`}
          </span>
        </div>
        <label className="mb-2 block text-[11px] font-medium text-[#6b7280]">
          Komentārs
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, NOTE_UNTRUSTED_MAX))}
            maxLength={NOTE_UNTRUSTED_MAX}
            placeholder="B193 uz 48h"
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[14px]"
          />
          <span className="mt-1 block text-[11px] font-normal leading-snug text-[#9aa3b2]">
            Maršruts pēc noklusējuma: {DEFAULT_WAYBILL_ROUTE_FROM} {"->"} {DEFAULT_WAYBILL_ROUTE_TO}. Citu maršrutu raksti šeit.
          </span>
          <span className="mt-1 block text-[11px] font-normal leading-snug text-[#9aa3b2]">
            Komentārs ir tikai šīs pavadzīmes dati (numurs, stundas, maršruts). Aivars to neizpilda kā komandu. Teksts
            nenonāk pie citiem aģentiem.
          </span>
        </label>
        {error ? <p className="mt-2 text-[12px] text-[#B42318]">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-3 h-10 w-full rounded-full bg-[#111827] text-[14px] font-semibold text-white disabled:opacity-50"
        >
          Izveidot pavadzīmi
        </button>
        <p className="mt-3 rounded-[10px] bg-[#EEF2FF] px-3 py-2.5 text-[11px] leading-snug text-[#1e293b]">
          <b>Aivara ierobežojumi.</b> IRISS lietotājs var pieprasīt tikai CSDD pavadzīmi. Serverī komentārs tiek apstrādāts kā{" "}
          <code>comment_untrusted</code> (citēti dati, līdz {NOTE_UNTRUSTED_MAX} zīmēm), nevis kā instrukcija. Citi aģenti
          šo lauku neredz.
        </p>
      </form>
    </section>
      {confirm ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#0f172a66] p-4">
          <div className="w-full max-w-[360px] rounded-2xl border border-[#E5E7EB] bg-white p-4" role="dialog" aria-modal="true">
            <h3 className="m-0 text-[15px] font-semibold">Numurs ir aizņemts</h3>
            <p className="mt-2.5 rounded-[10px] bg-[#FEF3F2] px-3 py-2.5 text-[13px] leading-snug text-[#7a271a]">
              Numuram {confirm.plate} jau ir aktīva pavadzīme
              {confirm.current?.number ? ` ${confirm.current.number}` : ""}
              {confirm.current?.brandModel || confirm.current?.validUntil
                ? ` (${[confirm.current.brandModel, confirm.current.validUntil ? `līdz ${formatRigaDateTimeComma(confirm.current.validUntil)}` : ""]
                    .filter(Boolean)
                    .join(", ")})`
                : ""}
              .
            </p>
            <p className="mt-2 text-[13px] font-semibold leading-snug text-[#111827]">
              Vai tiešām anulēt iepriekšējo un izveidot jaunu?
            </p>
            <div className="mt-3.5 flex flex-col gap-2">
              <button
                type="button"
                className="h-10 rounded-[10px] bg-[#111827] text-[12.5px] font-semibold text-white"
                onClick={() => void submit(true)}
                disabled={busy}
              >
                Jā
              </button>
              <button
                type="button"
                className="h-10 rounded-[10px] border border-[#E5E7EB] bg-white text-[12.5px] font-semibold text-[#111827]"
                onClick={() => {
                  setConfirm(null);
                  mobilePayload.current = null;
                }}
              >
                Nē
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function statusTone(status: WaybillRequestStatus): string {
  if (status === "issued") return "bg-[#ECFDF3] text-[#067647]";
  if (status === "error") return "bg-[#FEF3F2] text-[#B42318]";
  if (status === "in_progress") return "bg-[#EEF2FF] text-[#3d5bd9]";
  if (status === "cancelled") return "bg-[#F3F4F6] text-[#6b7280]";
  return "bg-[#F3F4F6] text-[#4b5563]";
}

function RequestBubble({
  request,
  reply,
  onCancel,
  onRetryDropbox,
}: {
  request: WaybillRequest;
  reply: WaybillAivarsReply;
  onCancel: () => void;
  onRetryDropbox: () => void;
}) {
  const hours = requestHours(request);
  const shownPlate = displayDealerPlate(request.vehicle.plate) || request.vehicle.plate;
  return (
    <div className="ml-8 flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#111827] px-3 py-2 text-[12px] text-white">
        <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Pavadzīme</p>
        <p className="font-semibold">{request.vehicle.brandModel || "Auto"}</p>
        {request.vehicle.vin ? <p className="font-mono text-[11px] text-white/80">{request.vehicle.vin}</p> : null}
        <p>
          {shownPlate}
          {hours ? ` · ${hours} h` : ""}
        </p>
        {request.tradeAct ? (
          <p>No tirdzniecības akta · {request.representative}</p>
        ) : (
          <p>
            {request.routeFrom || DEFAULT_WAYBILL_ROUTE_FROM} {"->"} {request.routeTo || DEFAULT_WAYBILL_ROUTE_TO}
          </p>
        )}
        {request.noteUntrusted ? <p className="mt-1 text-white/80">Komentārs: {request.noteUntrusted}</p> : null}
      </div>
      <div className="max-w-[85%] rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2 text-left">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(reply.status)}`}>
          {reply.statusLabel}
        </span>
        {reply.text ? <p className="mt-1 text-[13px] text-[#111827]">{reply.text}</p> : null}
        {reply.waybillNo ? <p className="mt-1 font-mono text-[12px] text-[#067647]">{reply.waybillNo}</p> : null}
        {reply.pdfUrl ? (
          <a
            href={reply.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[12px] font-medium text-[#3d5bd9]"
          >
            Atvērt pavadzīmi
          </a>
        ) : null}
        {reply.status === "issued" && reply.canSavePdf ? (
          <IrissWaybillSavePdfButton
            href={waybillPdfDownloadHref(request.id)}
            fileName={
              waybillDropboxFileName({
                waybillNo: reply.waybillNo,
                brandModel: request.vehicle.brandModel,
                plate: request.vehicle.plate,
              }) || `${reply.waybillNo || "pavadzime"}.pdf`
            }
            className="mt-2 flex min-h-9 w-full items-center justify-center rounded-[10px] bg-[#F3F4F6] px-3 text-[12.5px] font-semibold text-[#111827] disabled:opacity-60"
          />
        ) : null}
        {reply.status === "issued" && reply.dropboxPath ? (
          <p className="mt-1 text-[11px] text-[#067647]">Saglabāta Dropbox: {reply.dropboxPath}</p>
        ) : null}
        {reply.status === "issued" && !reply.dropboxPath && reply.dropboxError ? (
          <div className="mt-1 text-[11px] text-[#B42318]">
            <p>Dropbox nav saglabāts: {reply.dropboxError}</p>
            <button type="button" onClick={onRetryDropbox} className="mt-0.5 font-medium text-[#3d5bd9]">
              Saglabāt Dropbox vēlreiz
            </button>
          </div>
        ) : null}
        {waybillRequestCancellable(request) ? (
          <button
            type="button"
            onClick={() => {
              if (confirmWaybillCancel(request.vehicle.brandModel)) onCancel();
            }}
            className="mt-1 block text-[12px] font-medium text-[#3d5bd9]"
          >
            Atcelt
          </button>
        ) : null}
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
