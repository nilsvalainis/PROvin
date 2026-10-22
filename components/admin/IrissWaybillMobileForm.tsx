"use client";

import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "@/components/admin/IrissWaybillMobileForm.module.css";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { NOTE_UNTRUSTED_MAX, WAYBILL_ROUTE_MAX, WAYBILL_VALID_MAX_HOURS } from "@/lib/iriss-waybill-create";
import {
  WAYBILL_MOBILE_HOUR_PRESETS,
  buildWaybillMobilePayload,
  firstFreeWaybillPlate,
  initialWaybillMobileForm,
  waybillMobileHours,
  waybillMobilePlate,
  waybillMobileRequestRows,
  type WaybillMobileCar,
  type WaybillMobileFormState,
  type WaybillMobilePayload,
  type WaybillRoutePlace,
} from "@/lib/iriss-waybill-mobile-form";
import { IRISS_DEALER_PLATES, formatRigaDateTimeComma, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import type { WaybillAivarsReply, WaybillRequest } from "@/lib/iriss-waybill-requests";
import { filterWaybillTradeCars, type WaybillTradeCar } from "@/lib/iriss-waybill-trade-cars";

export type WaybillMobileDraft = { nonce: number; brandModel: string; vin: string; plate: string };

const TONE_CLASS = { wait: styles.wait, wip: styles.wip, ok: styles.ok, bad: styles.bad } as const;

/**
 * Pavadzīme telefonā (makets mockups/pavadzimes-mob, Nils 22.10): numurs, auto no saraksta,
 * derīgums, maršruts, komentārs, viena poga. Dators izmanto veco formu (IrissKomandaAivaramChat).
 */
export function IrissWaybillMobileForm({
  plates,
  tradeCars,
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
    setForm((prev) => ({
      ...prev,
      plate: draft.plate || prev.plate,
      plateTouched: Boolean(draft.plate) || prev.plateTouched,
      car: draft.brandModel ? { id: "", brandModel: draft.brandModel, vin: draft.vin } : prev.car,
      manual: false,
    }));
  }, [draft]);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const shownPlate = waybillMobilePlate(form);
  const hours = waybillMobileHours(form);
  const untilText = hours ? formatRigaDateTimeComma(new Date(nowMs + hours * 3_600_000).toISOString()) : "";
  const rows = useMemo(() => waybillMobileRequestRows(requests, replies), [requests, replies]);
  const inFlight = requests.filter((r) => r.status === "queued" || r.status === "in_progress").length;
  const shownError = localError ?? error;

  async function send() {
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
                  onClick={() => patch({ plate: row.plate, plateTouched: true })}
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
        </div>

        <div className={styles.group}>
          <span className={styles.label}>Derīgums</span>
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
              aria-label="Cits ilgums stundās"
              value={form.hoursOther}
              onFocus={() => patch({ hoursPreset: null })}
              onChange={(e) => patch({ hoursPreset: null, hoursOther: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              max={WAYBILL_VALID_MAX_HOURS}
            />
          </div>
        </div>

        <RoutePick
          label="Sākums"
          place={form.from}
          address={form.fromAddress}
          onPlace={(from) => patch({ from })}
          onAddress={(fromAddress) => patch({ fromAddress })}
        />
        <RoutePick
          label="Galamērķis"
          place={form.to}
          address={form.toAddress}
          onPlace={(to) => patch({ to })}
          onAddress={(toAddress) => patch({ toAddress })}
        />

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
        <span className={styles.count}>{inFlight} darbā</span>
      </div>
      <p className={styles.secNote}>Aivars izveido tikai pavadzīmes</p>
      <div className={styles.list}>
        {rows.length === 0 ? (
          <p className={styles.empty}>Vēl nav pieprasījumu.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className={styles.req}>
              <div className={styles.reqMain}>
                <p className={styles.reqTitle}>{row.title}</p>
                <p className={styles.reqSub}>{row.errorText || row.sub}</p>
              </div>
              <span className={`${styles.chip} ${TONE_CLASS[row.tone]}`}>{row.label}</span>
              {row.pdfUrl ? (
                <a className={styles.link} href={row.pdfUrl} target="_blank" rel="noopener noreferrer">
                  PDF
                </a>
              ) : null}
              {row.canRetry ? (
                <button type="button" className={styles.link} onClick={() => onRetry(row.id)}>
                  Atkārtot
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className={styles.secTitle}>
        <span>Kā tas strādā</span>
      </div>
      <p className={styles.quiet}>
        Izvēlies auto no saraksta vai uzraksti pavadzīmi transportlīdzekļa pārvietošanai uz tirdzniecības vietu.
      </p>
      <p className={styles.quiet}>Pietiek ar komentāru, piem., &quot;193 uz BMW 330&quot;. Pavadzīmi izdod uz 48 h.</p>
      <p className={styles.quiet}>
        Derīga no šī brīža{hours && untilText ? ` līdz ${untilText} (${hours} h)` : ""}. Pagarināt: izvēlies to pašu numuru un auto vēlreiz.
      </p>
      <p className={styles.quiet}>
        Numuru salīdzināšana: CSDD Tukuma filiāle. Ja vajag citu vietu, raksti komentārā.
      </p>
      <p className={styles.quiet}>
        Komentārs ir tikai dati šai pavadzīmei (līdz {NOTE_UNTRUSTED_MAX} zīmēm). Aivars to neizpilda kā komandu, citi aģenti to neredz.
      </p>

      <AdminMobileSheet
        open={pickerOpen}
        title="Tirdzniecībā pieņemtie auto"
        subtitle={tradeCars === null ? "Ielādē..." : `${tradeCars.length} auto`}
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

function RoutePick({
  label,
  place,
  address,
  onPlace,
  onAddress,
}: {
  label: string;
  place: WaybillRoutePlace;
  address: string;
  onPlace: (place: WaybillRoutePlace) => void;
  onAddress: (address: string) => void;
}) {
  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      <div className={styles.seg2}>
        {(["tukums", "other"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={place === p}
            className={`${styles.pick} ${place === p ? styles.on : ""}`}
            onClick={() => onPlace(p)}
          >
            {p === "tukums" ? "Tukums" : "Cits"}
          </button>
        ))}
      </div>
      {place === "other" ? (
        <input
          className={`${styles.input} ${styles.sub}`}
          value={address}
          onChange={(e) => onAddress(e.target.value.slice(0, WAYBILL_ROUTE_MAX))}
          maxLength={WAYBILL_ROUTE_MAX}
          placeholder="Rīga, Brīvības 275"
          aria-label={`${label}: adrese`}
          autoComplete="off"
        />
      ) : null}
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
          <p className={styles.empty}>{cars.length ? "Nekas neatrasts." : "Nav auto ar tirdzniecības aktu."}</p>
        ) : null}
        {shown.map((car) => {
          const on = Boolean(selected) && (selected === car.vin || selected === car.brandModel);
          return (
            <button
              key={car.id}
              type="button"
              className={`${styles.row} ${on ? styles.on : ""}`}
              aria-pressed={on}
              onClick={() => onChoose({ id: car.id, brandModel: car.brandModel, vin: car.vin })}
            >
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{car.brandModel || "Auto"}</span>
                <span className={styles.rowSub}>
                  {car.vin ? <span className={styles.mono}>{car.vin}</span> : null}
                  {car.vin && car.year ? " · " : ""}
                  {car.year}
                </span>
              </span>
              {car.statusLabel ? <span className={styles.tag}>{car.statusLabel}</span> : null}
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
