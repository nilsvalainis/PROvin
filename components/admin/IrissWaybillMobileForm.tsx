"use client";

import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "@/components/admin/IrissWaybillMobileForm.module.css";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import {
  NOTE_UNTRUSTED_MAX,
  WAYBILL_REPRESENTATIVE_MAX,
  WAYBILL_ROUTE_MAX,
  WAYBILL_VALID_MAX_HOURS,
  waybillRepresentativesForPlate,
} from "@/lib/iriss-waybill-create";
import {
  WAYBILL_MOBILE_HOUR_PRESETS,
  WAYBILL_TUKUMS_STREET,
  buildWaybillMobilePayload,
  firstFreeWaybillPlate,
  initialWaybillMobileForm,
  waybillMobileHours,
  waybillMobilePlate,
  waybillMobileRepresentative,
  waybillMobileRequestRows,
  waybillMobileTradeAct,
  type WaybillMobileCar,
  type WaybillMobileFormState,
  type WaybillMobilePayload,
  type WaybillMobileRequestRow,
} from "@/lib/iriss-waybill-mobile-form";
import { IRISS_DEALER_PLATES, formatRigaDateTimeComma, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import { isStaleWaybillRequest, type WaybillAivarsReply, type WaybillRequest } from "@/lib/iriss-waybill-requests";
import { filterWaybillTradeCars, type WaybillTradeCar } from "@/lib/iriss-waybill-trade-cars";

export type WaybillMobileDraft = { nonce: number; brandModel: string; vin: string; plate: string };

const TONE_CLASS = { wait: styles.wait, wip: styles.wip, ok: styles.ok, bad: styles.bad } as const;
const STEP_LABELS = ["Gaida", "Izveido", "Izdota"] as const;

/**
 * Pavadzīme telefonā v2 (makets ~/pz-mob-v2, Nils 23.10): numurs, auto, laiks.
 * Pieņemtam auto - tikai laiks un komersanta pārstāvis (bez maršruta); citam - tikai sākuma adrese.
 * Zemāk dzīvais statuss ar soļiem un "Kā tas strādā". Dators izmanto veco formu (IrissKomandaAivaramChat).
 */
export function IrissWaybillMobileForm({
  plates,
  tradeCars,
  tradeCarsFromAutoparks = false,
  requests,
  replies,
  busy,
  error,
  draft,
  onSubmit,
  onRetry,
  onPickerOpen,
}: {
  plates: WaybillPlateState[];
  /** null = vēl ielādē. */
  tradeCars: WaybillTradeCar[] | null;
  /** CSDD reģistrs vēl nav nolasīts - saraksts ir Autoparka aktīvie auto. */
  tradeCarsFromAutoparks?: boolean;
  requests: WaybillRequest[];
  replies: WaybillAivarsReply[];
  busy: boolean;
  error: string | null;
  draft: WaybillMobileDraft | null;
  onSubmit: (payload: WaybillMobilePayload) => Promise<boolean>;
  onRetry: (id: string) => void;
  onPickerOpen?: () => void;
}) {
  const [form, setForm] = useState<WaybillMobileFormState>(() => initialWaybillMobileForm(IRISS_DEALER_PLATES[0]));
  const [localError, setLocalError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [otherRep, setOtherRep] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const patch = (next: Partial<WaybillMobileFormState>) => setForm((prev) => ({ ...prev, ...next }));

  // Pirmais brīvais numurs, kamēr lietotājs nav izvēlējies pats.
  const firstFree = firstFreeWaybillPlate(plates, IRISS_DEALER_PLATES[0]);
  useEffect(() => {
    setForm((prev) => (prev.plateTouched || prev.plate === firstFree ? prev : { ...prev, plate: firstFree }));
  }, [firstFree]);

  // "Atkārtot" no arhīva: tas pats numurs un auto (pagarināšana ar to pašu formu).
  useEffect(() => {
    if (!draft) return;
    const known = tradeCars?.find((c) => Boolean(draft.vin) && c.vin === draft.vin);
    setForm((prev) => ({
      ...prev,
      plate: draft.plate || prev.plate,
      plateTouched: Boolean(draft.plate) || prev.plateTouched,
      car: draft.brandModel ? { id: known?.id ?? "", brandModel: draft.brandModel, vin: draft.vin, accepted: known?.accepted === true } : prev.car,
      manual: false,
    }));
    // tradeCars apzināti nav atkarībās: melnrakstu piemēro vienreiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const inFlight = requests.filter((r) => (r.status === "queued" || r.status === "in_progress") && !isStaleWaybillRequest(r)).length;
  // Dzīvais progress: kamēr kaut kas ir darbā, pulkstenis tikšķ biežāk (josla un teksti bez atjaunošanas).
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), inFlight ? 2_000 : 30_000);
    return () => window.clearInterval(t);
  }, [inFlight]);

  const shownPlate = waybillMobilePlate(form);
  const hours = waybillMobileHours(form);
  const untilText = hours ? formatRigaDateTimeComma(new Date(nowMs + hours * 3_600_000).toISOString()) : "";
  const tradeAct = waybillMobileTradeAct(form);
  const reps = waybillRepresentativesForPlate(shownPlate);
  const rep = waybillMobileRepresentative({ representative: form.representative, plate: shownPlate });
  const rows = useMemo(() => waybillMobileRequestRows(requests, replies, 5, { nowMs }), [requests, replies, nowMs]);
  const working = rows.filter((r) => r.progress.step < 3 && r.tone !== "bad").length;
  const shownError = localError ?? error;

  async function send() {
    if (tradeAct && otherRep && !form.representative.trim()) {
      setLocalError("Ieraksti komersanta pārstāvi.");
      return;
    }
    const built = buildWaybillMobilePayload(form);
    if (!built.ok) {
      setLocalError(built.error);
      return;
    }
    setLocalError(null);
    const ok = await onSubmit(built.payload);
    if (ok) setForm((prev) => ({ ...prev, comment: "" }));
  }

  function chooseCar(car: WaybillMobileCar | "manual") {
    if (car === "manual") patch({ manual: true, car: null });
    else patch({ manual: false, car, manualBrandModel: "" });
    setPickerOpen(false);
    setLocalError(null);
  }

  return (
    <div className={styles.mf}>
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className={styles.group}>
          <span className={styles.label}>Numurs</span>
          <div className={styles.seg3}>
            {plates.map((row) => {
              const on = shownPlate === row.plate;
              return (
                <button
                  key={row.plate}
                  type="button"
                  aria-pressed={on}
                  className={`${styles.pick} ${styles.plateBtn} ${on ? styles.on : ""}`}
                  onClick={() => {
                    patch({ plate: row.plate, plateTouched: true, representative: "" });
                    setOtherRep(false);
                  }}
                >
                  {row.plate}
                  <small className={row.busy ? styles.busy : styles.free}>{row.busy ? "aizņemts" : "brīvs"}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.group}>
          <span className={styles.label}>Auto</span>
          {form.manual ? (
            <div className="flex items-center gap-2">
              <input
                className={styles.input}
                value={form.manualBrandModel}
                onChange={(e) => patch({ manualBrandModel: e.target.value })}
                maxLength={120}
                placeholder="Marka, modelis"
                aria-label="Marka, modelis"
                autoComplete="off"
              />
              <button
                type="button"
                className={`${styles.pick} shrink-0 px-3`}
                aria-label="Izvēlēties no saraksta"
                onClick={() => {
                  setPickerOpen(true);
                  onPickerOpen?.();
                }}
              >
                <ChevronDown className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={styles.select}
                onClick={() => {
                  setPickerOpen(true);
                  onPickerOpen?.();
                }}
              >
                <span className={styles.selectMain}>
                  {form.car ? (
                    <>
                      <span className={styles.selectTitle}>{form.car.brandModel || form.car.vin}</span>
                      {form.car.vin ? <span className={`${styles.selectSub} ${styles.mono}`}>{form.car.vin}</span> : null}
                      {form.car.accepted ? <span className={`${styles.tag} ${styles.tagOk}`}>Pieņemts tirdzniecībā</span> : null}
                    </>
                  ) : (
                    <>
                      <span className={`${styles.selectTitle} ${styles.placeholder}`}>Izvēlies auto</span>
                      <span className={styles.selectSub}>vai raksti komentārā</span>
                    </>
                  )}
                </span>
                <ChevronDown className={`h-[18px] w-[18px] ${styles.chev}`} aria-hidden />
              </button>
              {form.car ? (
                <button
                  type="button"
                  aria-label="Notīrīt auto"
                  className={`${styles.pick} shrink-0 px-3`}
                  onClick={() => patch({ car: null })}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          )}
          {(form.manual && form.manualBrandModel.trim()) || (form.car && !form.car.accepted) ? (
            <span className={styles.tag}>Nav tirdzniecībā pieņemto auto sarakstā</span>
          ) : null}
        </div>

        {tradeAct ? (
          <div className={styles.group}>
            <span className={styles.label}>Komersanta pārstāvis</span>
            <div className={styles.seg2}>
              {reps.map((name) => {
                const on = !otherRep && rep === name;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    className={`${styles.pick} ${on ? styles.on : ""}`}
                    onClick={() => {
                      setOtherRep(false);
                      patch({ representative: name });
                    }}
                  >
                    {name}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={otherRep}
                className={`${styles.pick} ${otherRep ? styles.on : ""}`}
                onClick={() => {
                  setOtherRep(true);
                  patch({ representative: "" });
                }}
              >
                Cits
              </button>
            </div>
            {otherRep ? (
              <input
                className={`${styles.input} ${styles.sub}`}
                value={form.representative}
                onChange={(e) => patch({ representative: e.target.value.slice(0, WAYBILL_REPRESENTATIVE_MAX) })}
                maxLength={WAYBILL_REPRESENTATIVE_MAX}
                placeholder="Vārds, uzvārds"
                aria-label="Komersanta pārstāvis"
                autoComplete="off"
              />
            ) : null}
          </div>
        ) : (
          <div className={styles.group}>
            <span className={styles.label}>Sākuma adrese</span>
            <div className={styles.seg2}>
              {(["tukums", "other"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={form.from === p}
                  className={`${styles.pick} ${form.from === p ? styles.on : ""}`}
                  onClick={() => patch({ from: p })}
                >
                  {p === "tukums" ? "Tukums" : "Cita adrese"}
                </button>
              ))}
            </div>
            {form.from === "other" ? (
              <input
                className={`${styles.input} ${styles.sub}`}
                value={form.fromAddress}
                onChange={(e) => patch({ fromAddress: e.target.value.slice(0, WAYBILL_ROUTE_MAX) })}
                maxLength={WAYBILL_ROUTE_MAX}
                placeholder="Iela, mājas nr., pilsēta"
                aria-label="Sākuma adrese"
                autoComplete="off"
              />
            ) : (
              <p className={styles.addr}>
                <span className={styles.pin} aria-hidden>
                  <i />
                </span>
                <span>
                  <b>{WAYBILL_TUKUMS_STREET}</b>, Tukums
                </span>
              </p>
            )}
          </div>
        )}

        <div className={styles.group}>
          <span className={styles.label}>Laiks</span>
          <div className={styles.hours}>
            {WAYBILL_MOBILE_HOUR_PRESETS.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={form.hoursPreset === h}
                className={`${styles.pick} ${form.hoursPreset === h ? styles.on : ""}`}
                onClick={() => patch({ hoursPreset: h })}
              >
                {h} h
              </button>
            ))}
            <input
              className={styles.inputSm}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="cits, h"
              aria-label="Cits derīguma ilgums stundās"
              value={form.hoursOther}
              onFocus={() => patch({ hoursPreset: null })}
              onChange={(e) => patch({ hoursPreset: null, hoursOther: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              max={WAYBILL_VALID_MAX_HOURS}
            />
          </div>
          {hours && untilText ? (
            <p className={styles.until}>
              derīga līdz <b>{untilText}</b>
            </p>
          ) : null}
        </div>

        <div className={styles.group}>
          <label className={styles.label} htmlFor="wb-mobile-comment">
            Komentārs <span className={styles.opt}>(nav obligāts)</span>
          </label>
          <input
            id="wb-mobile-comment"
            className={styles.input}
            value={form.comment}
            onChange={(e) => patch({ comment: e.target.value.slice(0, NOTE_UNTRUSTED_MAX) })}
            maxLength={NOTE_UNTRUSTED_MAX}
            placeholder="193 uz BMW 330"
            autoComplete="off"
          />
        </div>

        {shownError ? (
          <p className={styles.error} role="alert">
            {shownError}
          </p>
        ) : null}
        <button type="submit" className={styles.primary} disabled={busy}>
          Izveidot pavadzīmi
        </button>
      </form>

      <div className={styles.secTitle}>
        <span>CSDD pavadzīme</span>
        <span className={styles.count}>{working} darbā</span>
      </div>
      <div className={styles.list} aria-live="polite">
        {rows.length === 0 ? (
          <p className={styles.empty}>Vēl nav pieprasījumu.</p>
        ) : (
          rows.map((row) => <WaybillLiveRow key={row.id} row={row} onRetry={onRetry} />)
        )}
      </div>

      <IrissWaybillHowItWorks plates={plates.map((p) => p.plate)} />

      <AdminMobileSheet
        open={pickerOpen}
        title="Tirdzniecībā pieņemtie auto"
        subtitle={
          tradeCars === null
            ? "Ielādē..."
            : tradeCarsFromAutoparks
              ? `${tradeCars.length} auto no Autoparka - CSDD reģistrs vēl nav nolasīts`
              : `${tradeCars.length} auto`
        }
        onClose={() => setPickerOpen(false)}
      >
        <IrissWaybillCarPicker
          cars={tradeCars}
          selected={form.manual ? "manual" : (form.car?.vin || form.car?.brandModel || "")}
          onChoose={chooseCar}
        />
      </AdminMobileSheet>
    </div>
  );
}

/** Viens pieprasījums ar dzīvo progresu: josla, 3 soļi, skaidrs "Izdota". */
export function WaybillLiveRow({ row, onRetry }: { row: WaybillMobileRequestRow; onRetry?: (id: string) => void }) {
  const { step, pct, text } = row.progress;
  const bad = row.tone === "bad";
  const done = step === 3 && !bad;
  return (
    <div className={`${styles.req} ${done ? styles.reqDone : ""}`} data-request={row.id}>
      <div className={styles.reqTop}>
        <div className={styles.reqMain}>
          <p className={styles.reqTitle}>{row.title}</p>
          <p className={styles.reqSub}>{row.sub}</p>
        </div>
        <span className={`${styles.chip} ${TONE_CLASS[row.tone]}`}>
          {done ? <Check className="mr-0.5 inline h-3 w-3 align-[-2px]" strokeWidth={3} aria-hidden /> : null}
          {row.label}
        </span>
        {row.pdfUrl ? (
          <a className={styles.link} href={row.pdfUrl} target="_blank" rel="noopener noreferrer">
            PDF
          </a>
        ) : null}
        {row.canRetry && onRetry ? (
          <button type="button" className={styles.link} onClick={() => onRetry(row.id)}>
            Atkārtot
          </button>
        ) : null}
      </div>
      {row.stale ? (
        <p className={styles.progText}>Novecojis: vairāk nekā 24 h bez virzības. Ja vajag, izveido no jauna.</p>
      ) : (
        <>
          <div
            className={`${styles.prog} ${bad ? styles.progBad : done ? styles.progOk : ""}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`Pavadzīmes statuss: ${row.label}, solis ${step} no 3`}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <ol className={styles.steps}>
            {STEP_LABELS.map((label, i) => (
              <li key={label} className={i + 1 < step || done ? styles.stepDone : i + 1 === step ? (bad ? styles.stepBad : styles.stepNow) : ""}>
                {label}
              </li>
            ))}
            <li className={styles.pct}>{bad ? "" : `${pct} %`}</li>
          </ol>
          <p className={`${styles.progText} ${bad ? styles.progTextBad : ""}`}>{text}</p>
        </>
      )}
    </div>
  );
}

/** "Kā tas strādā" (v2): liela kartīte ar numurētiem soļiem, teksti no ~/pz-teksti-latvietis.md 3a. */
export function IrissWaybillHowItWorks({ plates }: { plates: readonly string[] }) {
  return (
    <section className={styles.how} aria-labelledby="wb-how-title">
      <h3 id="wb-how-title">Kā tas strādā</h3>
      <p className={styles.howLead}>Pavadzīme 5 soļos. Parasti gatava dažu minūšu laikā.</p>
      <ol className={styles.howSteps}>
        <li>
          <span className={`${styles.num} ${styles.numAi}`}>1</span>
          <div>
            <h4>Aivars ir Dzintarzeme Auto jaunais pavadzīmju asistents</h4>
            <p>Tu aizpildi formu, Aivars pats izveido CSDD pavadzīmi un atsūta PDF. Citus darbus viņš neveic.</p>
          </div>
        </li>
        <li>
          <span className={styles.num}>2</span>
          <div>
            <h4>Izvēlies numuru un auto</h4>
            <p>
              Numurs ar atzīmi &quot;brīvs&quot; ir gatavs lietošanai. Izvēlies auto no tirdzniecībā pieņemto auto saraksta - tad jānorāda
              tikai laiks. Ja auto sarakstā nav, ieraksti marku, modeli un sākuma adresi.
            </p>
            {plates.length ? (
              <div className={styles.mini}>
                {plates.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </div>
            ) : null}
          </div>
        </li>
        <li>
          <span className={styles.num}>3</span>
          <div>
            <h4>Izvēlies laiku</h4>
            <p>Izvēlies 12, 24 vai 48 h, vai ieraksti citu. Derīga no šī brīža. Lai pagarinātu, izvēlies to pašu numuru un auto vēlreiz.</p>
          </div>
        </li>
        <li>
          <span className={styles.num}>4</span>
          <div>
            <h4>Spied &quot;Izveidot pavadzīmi&quot;</h4>
            <p>Statuss redzams saraksta augšā: Gaida, Izveido, Izdota. Kad pavadzīme izdota, parādās PDF un telefonā pienāk paziņojums.</p>
            <div className={styles.mini}>
              <span className={`${styles.chip} ${styles.wait}`}>Gaida</span>
              <span className={`${styles.chip} ${styles.wip}`}>Izveido</span>
              <span className={`${styles.chip} ${styles.ok}`}>Izdota</span>
            </div>
          </div>
        </li>
        <li>
          <span className={styles.num}>5</span>
          <div>
            <h4>Ja numurs aizņemts</h4>
            <p>Jauna pavadzīme pārtrauc šī numura esošo pavadzīmi. Lietotne vispirms pajautās, vai tiešām to vēlies.</p>
          </div>
        </li>
        <li>
          <span className={`${styles.num} ${styles.numInfo}`}>i</span>
          <div>
            <h4>Jāzina</h4>
            <p>Numuru salīdzināšana - CSDD Tukuma filiālē. Ja vajag citu vietu, raksti komentārā.</p>
            <p>
              Komentārs ir tikai teksts šai pavadzīmei (līdz {NOTE_UNTRUSTED_MAX} zīmēm). Aivars to neizpilda kā komandu, citi to neredz.
            </p>
            <p>Visas izdotās un beigušās pavadzīmes ir Arhīvā.</p>
          </div>
        </li>
      </ol>
    </section>
  );
}

/** Arhīvā: vecie pieprasījumi (novecojuši, vecas kļūdas, beigušās). Dati netiek mainīti. */
export function IrissWaybillRequestArchive() {
  const [data, setData] = useState<{ requests: WaybillRequest[]; replies: WaybillAivarsReply[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/iriss/waybill-requests", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { requests?: WaybillRequest[]; replies?: WaybillAivarsReply[] } | null;
        if (!cancelled && res.ok && Array.isArray(json?.requests)) {
          setData({ requests: json.requests, replies: Array.isArray(json.replies) ? json.replies : [] });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const rows = useMemo(
    () => (data ? waybillMobileRequestRows(data.requests, data.replies, 30, { which: "archive" }) : []),
    [data],
  );
  if (!rows.length) return null;
  return (
    <div className={`${styles.mf} mt-4`}>
      <div className={styles.secTitle}>
        <span>Vecie pieprasījumi</span>
        <span className={styles.count}>{rows.length}</span>
      </div>
      <div className={styles.list}>
        {rows.map((row) => (
          <div key={row.id} className={styles.req}>
            <div className={styles.reqTop}>
              <div className={styles.reqMain}>
                <p className={styles.reqTitle}>{row.title}</p>
                <p className={styles.reqSub}>{row.stale ? `${row.sub} · 24 h bez virzības` : row.sub}</p>
              </div>
              <span className={`${styles.chip} ${TONE_CLASS[row.tone]}`}>{row.label}</span>
              {row.pdfUrl ? (
                <a className={styles.link} href={row.pdfUrl} target="_blank" rel="noopener noreferrer">
                  PDF
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IrissWaybillCarPicker({
  cars,
  selected,
  onChoose,
}: {
  cars: WaybillTradeCar[] | null;
  /** VIN vai marka izvēlētajam auto; "manual" = ar roku. */
  selected: string;
  onChoose: (car: WaybillMobileCar | "manual") => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterWaybillTradeCars(cars ?? [], query), [cars, query]);
  return (
    <div className={styles.picker}>
      <input
        type="search"
        className={styles.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Marka, modelis vai VIN"
        aria-label="Meklēt auto"
        autoComplete="off"
        spellCheck={false}
      />
      <div className={styles.list}>
        {cars === null ? <p className={styles.empty}>Ielādē...</p> : null}
        {cars !== null && shown.length === 0 ? (
          <p className={styles.empty}>{cars.length ? "Nekas nav atrasts." : "Nav tirdzniecībā pieņemto auto."}</p>
        ) : null}
        {shown.map((car) => {
          const on = Boolean(selected) && (selected === car.vin || selected === car.brandModel);
          return (
            <button
              key={car.id}
              type="button"
              className={`${styles.row} ${on ? styles.on : ""}`}
              aria-pressed={on}
              onClick={() => onChoose({ id: car.id, brandModel: car.brandModel, vin: car.vin, accepted: car.accepted === true })}
            >
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{car.brandModel || "Auto"}</span>
                <span className={styles.rowSub}>
                  {car.vin ? <span className={styles.mono}>{car.vin}</span> : null}
                  {car.vin && car.year ? " · " : ""}
                  {car.year}
                </span>
              </span>
              {car.accepted ? (
                <span className={`${styles.tag} ${styles.tagOk}`}>Pieņemts</span>
              ) : car.statusLabel ? (
                <span className={styles.tag}>{car.statusLabel}</span>
              ) : null}
              <span className={styles.check} aria-hidden>
                {on ? "✓" : ""}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className={`${styles.row} ${styles.manual} ${selected === "manual" ? styles.on : ""}`}
          onClick={() => onChoose("manual")}
        >
          <span className={styles.rowMain}>
            <span className={styles.rowTitle}>Cits auto - ierakstīt ar roku</span>
            <span className={styles.rowSub}>Marka un modelis</span>
          </span>
          <span className={styles.check} aria-hidden>
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
