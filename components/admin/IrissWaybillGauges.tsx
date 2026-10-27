"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IrissWaybillGaugeDetail } from "@/components/admin/IrissWaybillGaugeDetail";
import { IrissWaybillStopConfirm } from "@/components/admin/IrissWaybillStopConfirm";
import { useWaybillStop } from "@/components/admin/useWaybillStop";
import styles from "@/components/admin/IrissWaybillGauges.module.css";
import { IrissButton, IrissStatusPill, type IrissStatusTone } from "@/components/admin/iriss-ui/IrissUi";
import { formatWaybillExpiryDdMmHm } from "@/lib/iriss-pavadzimes-countdown";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";
import { irissWaybillGauges, waybillGaugeTimeLeft, waybillGaugesFromPlates, waybillHomeCarText, waybillHomeCarTitle, type WaybillGauge } from "@/lib/iriss-waybill-gauges";
import { waybillHomeRingColor } from "@/lib/iriss-waybill-home-ring";
import {
  lastWaybillFormPlate,
  selectWaybillPlate,
  WAYBILL_FORM_PLATE_EVENT,
  WAYBILL_PLATES_EVENT,
} from "@/lib/iriss-waybill-live-plates";
import type { WaybillPlateState } from "@/lib/iriss-waybill-plates";

const RING: Record<WaybillGauge["status"], string> = {
  ok: "#16a34a",
  soon: "#ea580c",
  expired: "#dc2626",
  free: "#c7c7cc",
  issuing: "#8e8e93",
};

/** Bez formas lapā (piem. sānjosla) apļi paši atjaunojas; formas lapā tos uzreiz atjauno forma (WAYBILL_PLATES_EVENT). */
/** j47: 20 s - pieprasījuma stāvoklis (arī "Aivars" ar roku) apļos parādās uzreiz, ne pēc minūtes. */
const REFRESH_MS = 20_000;

/**
 * Pavadzīmes vienā skatā: 3 numurzīmes kā apļi (48 h skala) ar atlikušajām stundām un marku/modeli.
 * Pieskāriens aplim atver detaļas (beigu laiks, precīzs atlikums, PDF). Der telefonam un datora sānjoslai.
 */
function MonoPlate({ plate }: { plate: string }) {
  const i = plate.lastIndexOf("-");
  if (i < 0) return <span className={styles.plate}>{plate}</span>;
  return (
    <span className={styles.plate}>
      {plate.slice(0, i)}
      <span className={styles.dash}>-</span>
      {plate.slice(i + 1)}
    </span>
  );
}

/** Modeļa rinda: pilns teksts + title, ja CSS saīsina. */
export function WaybillHomeCar(g: Pick<WaybillGauge, "busy" | "status" | "brandModel">) {
  return (
    <span className={styles.car} title={waybillHomeCarTitle(g)}>
      {waybillHomeCarText(g)}
    </span>
  );
}

export function IrissWaybillGauges({
  size = "mobile",
  allHref = "/admin/iriss/pavadzimes",
  chrome = "card",
  href,
  onExtend,
  onStop,
  onOpenPdf,
  selectable = false,
}: {
  size?: "mobile" | "sidebar";
  /** Saite "Visas ›"; null = nerādīt (pašā pavadzīmju lapā tā vestu uz to pašu lapu). */
  allHref?: string | null;
  /** float = sākuma hero: bez virsraksta, bez kartītes, luksofors pēc stundām. strip = datora numuru kartītes vienā rindā. */
  chrome?: "card" | "float" | "strip";
  /** Ja ir, viss vidžets ir viena saite (bez atsevišķiem apļu klikšķiem). */
  href?: string | null;
  onExtend?: (gauge: WaybillGauge) => void;
  onStop?: (gauge: WaybillGauge) => void;
  onOpenPdf?: (gauge: WaybillGauge) => void;
  /**
   * Pavadzīmju lapa (Nils 27.10): apļi ir arī formas numura izvēle. Pieskāriens izvēlas numuru formai;
   * aizņemtam vēl parāda darbības (Pagarināt, Pārtraukt, PDF). Izvēle - apmale ap apli, bez iekrāsota fona.
   */
  selectable?: boolean;
}) {
  const [rows, setRows] = useState<IrissPavadzimeListRow[] | null>(null);
  const [plates, setPlates] = useState<WaybillPlateState[] | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<string>(() => (selectable ? lastWaybillFormPlate() : ""));
  const stop = useWaybillStop();

  useEffect(() => {
    if (!selectable) return;
    const onForm = (e: Event) => {
      const plate = (e as CustomEvent<string>).detail;
      if (typeof plate === "string") setPicked(plate);
    };
    window.addEventListener(WAYBILL_FORM_PLATE_EVENT, onForm);
    return () => window.removeEventListener(WAYBILL_FORM_PLATE_EVENT, onForm);
  }, [selectable]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void fetch("/api/admin/iriss-pavadzimes?active=1", { credentials: "include", cache: "no-store" })
        .then(async (res) => {
          const json = (await res.json().catch(() => null)) as { rows?: IrissPavadzimeListRow[]; plates?: WaybillPlateState[] } | null;
          if (cancelled) return;
          // Kļūdas gadījumā paliek iepriekšējais stāvoklis (nekad klusi nepārslēdz uz "brīvs").
          if (!res.ok) return setRows((prev) => prev ?? []);
          setRows(Array.isArray(json?.rows) ? json.rows : []);
          if (Array.isArray(json?.plates) && json.plates.length) setPlates(json.plates);
          setNowMs(Date.now());
        })
        .catch(() => !cancelled && setRows((prev) => prev ?? []));
    load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const onPlates = (e: Event) => {
      const next = (e as CustomEvent<WaybillPlateState[]>).detail;
      if (Array.isArray(next) && next.length) {
        setPlates(next);
        setNowMs(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(WAYBILL_PLATES_EVENT, onPlates);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(WAYBILL_PLATES_EVENT, onPlates);
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const now = new Date(nowMs);
  const gaugeRows = (rows ?? []).map((r) => ({
    id: r.id,
    plate: r.plate ?? "",
    validUntil: r.validUntil,
    issuedAt: r.issuedAt,
    number: r.number ?? "",
    brandModel: r.brandModel,
    archived: r.archived,
  }));
  // Viens avots ar numura pogām: serveris/forma dod numuru stāvokli; vecs serveris bez plates - kā agrāk no rindām.
  const gauges = plates ? waybillGaugesFromPlates(plates, gaugeRows, now) : irissWaybillGauges(gaugeRows, now);
  const loading = rows === null && plates === null;
  const active = href
    ? null
    : selectable
      ? gauges.find((g) => g.plate === picked && g.busy) ?? null
      : gauges.find((g) => g.plate === open && g.busy) ?? null;
  if (chrome === "strip") {
    return <WaybillPlateCards gauges={gauges} loading={loading} onExtend={onExtend} onStop={onStop} onOpenPdf={onOpenPdf} />;
  }

  const small = size === "sidebar";
  const floating = chrome === "float";
  const linked = Boolean(href);

  const row = (
    <div className={styles.row}>
      {gauges.map((g) => {
        const r = 15.5;
        const c = 2 * Math.PI * r;
        const isOpen = !linked && (selectable ? picked === g.plate : open === g.plate && g.busy);
        const ring = floating && g.busy ? waybillHomeRingColor(g.hoursLeft, true) : g.busy ? RING[g.status] : "#8e8e93";
        const left = waybillGaugeTimeLeft(g);
        const label = g.busy
          ? `${g.plate}, ${g.brandModel || "auto"}, atlikušas ${left.value} ${left.unit}`
          : g.status === "issuing"
            ? `${g.plate}, ${g.manual ? "izraksta Aivars ar roku" : "izdod pavadzīmi"}${g.brandModel ? `, ${g.brandModel}` : ""}`
            : `${g.plate}, brīvs`;
        const inner = (
          <>
            <span className={styles.ring}>
              <svg viewBox="0 0 36 36" aria-hidden>
                <circle cx="18" cy="18" r={r} fill="none" stroke="#ececf0" strokeWidth="3.5" />
                {g.busy ? (
                  <circle
                    cx="18"
                    cy="18"
                    r={r}
                    fill="none"
                    stroke={ring}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${(g.share * c).toFixed(2)} ${c.toFixed(2)}`}
                    transform="rotate(-90 18 18)"
                  />
                ) : null}
              </svg>
              <span className={styles.val} style={floating ? undefined : { color: g.busy ? ring : "#8e8e93" }}>
                {loading ? "…" : g.busy ? (
                  <>
                    {left.value}
                    <small>{left.unit}</small>
                  </>
                ) : g.status === "issuing" ? (
                  g.manual ? "Aivars" : "izdod..."
                ) : (
                  "brīvs"
                )}
              </span>
            </span>
            {floating ? <MonoPlate plate={g.plate} /> : <span className={styles.plate}>{g.plate.replace(/^([A-Z])/, "$1 ")}</span>}
            <WaybillHomeCar busy={g.busy} status={g.status} brandModel={g.brandModel} />
          </>
        );
        if (linked) {
          return (
            <span key={g.plate} className={`${styles.item} ${g.busy ? "" : styles.free}`}>
              {inner}
            </span>
          );
        }
        if (selectable) {
          return (
            <button
              key={g.plate}
              type="button"
              className={`${styles.item} ${styles.pickable} ${isOpen ? styles.on : ""} ${g.busy ? "" : styles.free}`}
              aria-pressed={isOpen}
              aria-label={`${label}${isOpen ? ", izvēlēts" : ""}`}
              onClick={() => {
                setPicked(g.plate);
                selectWaybillPlate(g.plate);
              }}
              disabled={loading}
            >
              {inner}
            </button>
          );
        }
        return (
          <button
            key={g.plate}
            type="button"
            className={`${styles.item} ${isOpen ? styles.on : ""} ${g.busy ? "" : styles.free}`}
            aria-expanded={g.busy ? isOpen : undefined}
            aria-label={label}
            onClick={() => (g.busy ? setOpen((cur) => (cur === g.plate ? null : g.plate)) : undefined)}
            disabled={loading}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );

  const cls = `${styles.wg} ${small ? styles.sm : ""} ${floating ? styles.float : ""} ${floating && selectable ? styles.page : ""}`;
  if (href) {
    return (
      <Link href={href} className={`admin-nav-link ${cls}`} aria-label="Pavadzīmes">
        {row}
      </Link>
    );
  }

  return (
    <section className={cls} aria-label="Pavadzīmes">
      {floating ? null : (
        <div className={styles.head}>
          <span>{selectable ? "Numurs" : "Pavadzīmes"}</span>
          {allHref ? (
            <Link href={allHref} className="admin-nav-link">
              Visas ›
            </Link>
          ) : null}
        </div>
      )}
      {row}
      {active ? (
        <IrissWaybillGaugeDetail
          active={active}
          now={now}
          onOpenPdf={onOpenPdf}
          onExtend={
            onExtend ??
            ((g) => {
              window.location.assign(`/admin/iriss/pavadzimes?extend=${encodeURIComponent(g.id)}`);
            })
          }
          onStop={
            onStop ??
            ((g) => {
              if (!g.id || !g.number) return;
              stop.ask({ id: g.id, number: g.number, plate: g.plate });
            })
          }
        />
      ) : null}
      {stop.target ? (
        <IrissWaybillStopConfirm
          target={stop.target}
          busy={stop.busy}
          error={stop.error}
          onYes={() => void stop.confirm()}
          onNo={stop.cancel}
        />
      ) : null}
    </section>
  );
}

function cardStatus(g: WaybillGauge): { tone: IrissStatusTone; text: string } {
  if (g.busy) return { tone: g.status === "expired" ? "bad" : g.status === "soon" ? "warn" : "info", text: "aizņemts" };
  if (g.status === "issuing") return { tone: "info", text: g.manual ? "izraksta Aivars" : "izdod..." };
  return { tone: "ok", text: "brīvs" };
}

/**
 * Datora Pavadzīmju lapa (Nils 27.10, makets A): 3 numuri = 3 lielas kartītes. Katrā tā numura aktīvā
 * pavadzīme ar atlikušo laiku un darbībām (PDF, Pagarināt, Pārtraukt) - atsevišķas tabulas vairs nav.
 */
function WaybillPlateCards({
  gauges,
  loading,
  onExtend,
  onStop,
  onOpenPdf,
}: {
  gauges: WaybillGauge[];
  loading: boolean;
  onExtend?: (gauge: WaybillGauge) => void;
  onStop?: (gauge: WaybillGauge) => void;
  onOpenPdf?: (gauge: WaybillGauge) => void;
}) {
  return (
    <section className={styles.cards} aria-label="Numuri un aktīvās pavadzīmes">
      {gauges.map((g) => {
        const st = cardStatus(g);
        const left = waybillGaugeTimeLeft(g);
        const soon = g.busy && (g.status === "soon" || g.status === "expired");
        return (
          <article key={g.plate} className={styles.pcard}>
            <div className={styles.pcardTop}>
              <span className={styles.pcardPlate}>{g.plate}</span>
              <IrissStatusPill tone={st.tone}>{loading ? "..." : st.text}</IrissStatusPill>
            </div>
            {g.busy ? (
              <>
                <div>
                  <p className={styles.pcardCar} title={g.brandModel || undefined}>
                    {g.brandModel || "Auto"}
                  </p>
                  <p className={styles.pcardMeta}>
                    {g.number ? `Nr. ${g.number} · ` : ""}līdz {formatWaybillExpiryDdMmHm(g.validUntil)}
                  </p>
                </div>
                <div>
                  <div className={styles.pcardLeftRow}>
                    <span className={soon ? styles.pcardLeftSoon : styles.pcardLeft}>
                      {left.value} {left.unit}
                    </span>
                    <span className={styles.pcardMeta}>no 48 h</span>
                  </div>
                  <span className={styles.pcardBar} aria-hidden>
                    <span className={soon ? styles.stripFillSoon : styles.stripFill} style={{ width: `${Math.round(g.share * 100)}%` }} />
                  </span>
                </div>
                {g.id ? (
                  <div className={styles.pcardActions}>
                    <IrissButton size="sm" onClick={() => onOpenPdf?.(g)}>
                      PDF
                    </IrissButton>
                    <IrissButton size="sm" onClick={() => onExtend?.(g)}>
                      Pagarināt
                    </IrissButton>
                    {g.number ? (
                      <IrissButton size="sm" variant="danger-outline" onClick={() => onStop?.(g)}>
                        Pārtraukt
                      </IrissButton>
                    ) : null}
                  </div>
                ) : (
                  <p className={styles.pcardMeta}>Pavadzīme no CSDD - PDF vēl nav indeksā.</p>
                )}
              </>
            ) : (
              <>
                <div>
                  <p className={styles.pcardCar}>{g.status === "issuing" ? g.brandModel || "Pieprasījums" : "Nav pavadzīmes"}</p>
                  <p className={styles.pcardMeta}>
                    {g.status === "issuing" ? "Pieprasījums pie Aivara" : "Gatavs jaunai pavadzīmei"}
                  </p>
                </div>
                {g.status === "issuing" ? null : (
                  <div className={styles.pcardActions}>
                    <IrissButton size="sm" onClick={() => selectWaybillPlate(g.plate)}>
                      Izvēlēties formā
                    </IrissButton>
                  </div>
                )}
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}
