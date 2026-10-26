"use client";

import { useMemo, useState } from "react";
import { IrissWaybillAutoEntry, IrissWaybillCarPicker } from "@/components/admin/IrissWaybillMobileForm";
import styles from "@/components/admin/IrissWaybillMobileForm.module.css";
import { LvDealerPlate } from "@/components/admin/LvDealerPlate";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import {
  DEFAULT_WAYBILL_ROUTE_FROM,
  DEFAULT_WAYBILL_ROUTE_TO,
  NOTE_UNTRUSTED_MAX,
  WAYBILL_VALID_MAX_HOURS,
} from "@/lib/iriss-waybill-create";
import { formatWaybillExpiryDdMmHm } from "@/lib/iriss-pavadzimes-countdown";
import {
  WAYBILL_MOBILE_HOUR_PRESETS,
  applyWaybillAutoChoice,
  waybillShowsManualFields,
  waybillShowsTradeList,
  type WaybillAutoChoice,
  type WaybillMobileCar,
  type WaybillMobileFormState,
} from "@/lib/iriss-waybill-mobile-form";
import { dealerPlateMeta, displayDealerPlate, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import { dzintarzemeAcceptedCars, type WaybillTradeCar } from "@/lib/iriss-waybill-trade-cars";

/**
 * Datora izveides forma: tās pašas Auto izvēles kā telefonā (No saraksta / Ar roku).
 * Numurs, Derīgums, Komentārs un Izveidot paliek; payload joprojām plate + brandModel + VIN.
 */
export function IrissWaybillDesktopCreateForm({
  plates,
  plate,
  onPlate,
  auto,
  onAuto,
  tradeCars,
  tradeCarsFromAutoparks = false,
  onNeedCars,
  hoursPreset,
  hoursOther,
  onHoursPreset,
  onHoursOther,
  hoursChosen,
  untilHint,
  comment,
  onComment,
  error,
  busy,
  onSubmit,
}: {
  plates: WaybillPlateState[];
  plate: string;
  onPlate: (plate: string) => void;
  auto: WaybillMobileFormState;
  onAuto: (next: WaybillMobileFormState) => void;
  tradeCars: WaybillTradeCar[] | null;
  tradeCarsFromAutoparks?: boolean;
  onNeedCars?: () => void;
  hoursPreset: number | null;
  hoursOther: string;
  onHoursPreset: (hours: number | null) => void;
  onHoursOther: (value: string) => void;
  hoursChosen: number | null;
  untilHint: string;
  comment: string;
  onComment: (value: string) => void;
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isB192 = displayDealerPlate(plate) === "B192-7";
  const dzaCars = useMemo(() => (tradeCars ? dzintarzemeAcceptedCars(tradeCars) : null), [tradeCars]);
  const pickerCars = isB192 ? dzaCars : tradeCars;
  const showManual = waybillShowsManualFields(auto);
  const showList = waybillShowsTradeList(auto);
  const b192Empty = isB192 && showList && !auto.car && dzaCars !== null && dzaCars.length === 0;
  const backdropClose = useModalBackdropClose(() => setPickerOpen(false));

  function choosePath(choice: Exclude<WaybillAutoChoice, "none">) {
    onAuto(applyWaybillAutoChoice(auto, choice));
    if (choice === "list") {
      const empty = isB192 && dzaCars !== null && dzaCars.length === 0;
      if (!empty) {
        setPickerOpen(true);
        onNeedCars?.();
      } else {
        setPickerOpen(false);
      }
    } else {
      setPickerOpen(false);
    }
  }

  function chooseCar(car: WaybillMobileCar | "manual") {
    if (car === "manual") onAuto(applyWaybillAutoChoice(auto, "manual"));
    else onAuto({ ...applyWaybillAutoChoice(auto, "list"), car, representative: "" });
    setPickerOpen(false);
  }

  return (
    <>
      <form
        className="border-t border-[#F3F4F6] px-3 py-3"
        data-waybill-desktop-create=""
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <p className="mb-1 text-[11px] font-medium text-[var(--iriss-ink-2)]">Numurs</p>
        {/* Telefonā - kompaktās pilles (pirms #382); zīmētās numurzīmes tikai no md. */}
        <div className="mb-2 flex gap-1.5 md:hidden">
          {plates.map((row) => {
            const on = plate === row.plate;
            return (
              <button
                key={row.plate}
                type="button"
                aria-pressed={on}
                onClick={() => onPlate(row.plate)}
                className={`min-h-11 min-w-0 flex-1 rounded-full px-2 py-1.5 text-[12px] font-semibold ${
                  on ? "bg-[var(--iriss-graphite)] text-white" : "bg-[var(--iriss-surface-2)] text-[var(--iriss-ink)]"
                }`}
              >
                {row.plate}
                <small
                  className={`mt-0.5 block text-[10px] font-medium ${
                    on ? "text-white/70" : row.busy ? "text-[#b45309]" : "text-[var(--iriss-ok)]"
                  }`}
                >
                  {row.busy ? "aizņemts" : "brīvs"}
                </small>
              </button>
            );
          })}
        </div>
        <div className="mb-2 hidden md:flex md:flex-row md:items-start md:gap-3.5">
          {plates.map((row) => {
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
                onClick={() => onPlate(row.plate)}
              />
            );
          })}
        </div>
        <div className={`${styles.mf} mb-2`}>
          <div className={styles.labelRow}>
            <span className={styles.label}>Auto</span>
            {isB192 ? <span className={styles.ownerTag}>Dzintarzeme Auto</span> : null}
          </div>
          <IrissWaybillAutoEntry
            choice={auto.autoChoice}
            car={auto.car}
            manualBrandModel={auto.manualBrandModel}
            isB192={isB192}
            b192Empty={b192Empty}
            showManual={showManual}
            showList={showList}
            onChoose={choosePath}
            onOpenList={() => {
              setPickerOpen(true);
              onNeedCars?.();
            }}
            onClearCar={() => onAuto({ ...auto, car: null })}
            onManualBrandModel={(value) => onAuto({ ...auto, manualBrandModel: value })}
          />
        </div>
        <div className="mb-2 text-[11px] font-medium text-[var(--iriss-ink-2)]">
          Derīgums
          <div className="mt-1 grid grid-cols-4 gap-1.5" role="group" aria-label="Derīgums">
            {[...WAYBILL_MOBILE_HOUR_PRESETS, null].map((h) => {
              const on = hoursPreset === h;
              return (
                <button
                  key={h ?? "cits"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onHoursPreset(h)}
                  className={`min-h-10 rounded-full px-2 text-[13px] font-semibold ${on ? "bg-[var(--iriss-graphite)] text-white" : "bg-[var(--iriss-surface-2)] text-[var(--iriss-ink)]"}`}
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
              onChange={(e) => onHoursOther(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={`stundas, 1-${WAYBILL_VALID_MAX_HOURS}`}
              aria-label="Cits derīguma ilgums stundās"
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-[var(--iriss-line)] px-3 py-2 text-[14px]"
            />
          ) : null}
          <span className="mt-1 block text-[11px] font-normal leading-snug text-[var(--iriss-ink-3)]">
            {hoursChosen
              ? `Sākums: tagad. Beigas: tagad + ${hoursChosen} h${untilHint ? ` (${untilHint}).` : "."}`
              : `Ieraksti stundas: no 1 līdz ${WAYBILL_VALID_MAX_HOURS}.`}
          </span>
        </div>
        <label className="mb-2 block text-[11px] font-medium text-[var(--iriss-ink-2)]">
          Komentārs
          <input
            value={comment}
            onChange={(e) => onComment(e.target.value.slice(0, NOTE_UNTRUSTED_MAX))}
            maxLength={NOTE_UNTRUSTED_MAX}
            placeholder="B193 uz 48h"
            className="mt-1 w-full rounded-xl border border-[var(--iriss-line)] px-3 py-2 text-[14px]"
          />
          <span className="mt-1 block text-[11px] font-normal leading-snug text-[var(--iriss-ink-3)]">
            Maršruts pēc noklusējuma: {DEFAULT_WAYBILL_ROUTE_FROM} {"->"} {DEFAULT_WAYBILL_ROUTE_TO}. Citu maršrutu raksti šeit.
          </span>
          <span className="mt-1 block text-[11px] font-normal leading-snug text-[var(--iriss-ink-3)]">
            Komentārs ir tikai šīs pavadzīmes dati (numurs, stundas, maršruts). Aivars to neizpilda kā komandu. Teksts
            nenonāk pie citiem aģentiem.
          </span>
        </label>
        {error ? <p className="mt-2 text-[12px] text-[#B42318]">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-3 h-10 w-full rounded-full bg-[var(--iriss-graphite)] text-[14px] font-semibold text-white disabled:opacity-50"
        >
          Izveidot pavadzīmi
        </button>
        <p className="mt-3 rounded-[10px] bg-[#EEF2FF] px-3 py-2.5 text-[11px] leading-snug text-[#1e293b]">
          <b>Aivara ierobežojumi.</b> IRISS lietotājs var pieprasīt tikai CSDD pavadzīmi. Serverī komentārs tiek apstrādāts kā{" "}
          <code>comment_untrusted</code> (citēti dati, līdz {NOTE_UNTRUSTED_MAX} zīmēm), nevis kā instrukcija. Citi aģenti
          šo lauku neredz.
        </p>
      </form>
      {pickerOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#0f172a66] p-4" {...backdropClose}>
          <div
            className={`${styles.mf} w-full max-w-[420px] rounded-2xl border border-[var(--iriss-line)] bg-white p-4`}
            role="dialog"
            aria-modal="true"
            aria-label={isB192 ? "Dzintarzeme Auto - pieņemtie" : "Tirdzniecībā pieņemtie auto"}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 text-[15px] font-semibold text-[var(--iriss-ink)]">
              {isB192 ? "Dzintarzeme Auto - pieņemtie" : "Tirdzniecībā pieņemtie auto"}
            </h3>
            <p className="mt-1 text-[12px] text-[var(--iriss-ink-2)]">
              {pickerCars === null
                ? "Ielādē..."
                : isB192
                  ? `${pickerCars.length} auto - tikai šī numura (B192-7) firma`
                  : tradeCarsFromAutoparks
                    ? `${pickerCars.length} auto no Autoparka - CSDD reģistrs vēl nav nolasīts`
                    : `${pickerCars.length} auto`}
            </p>
            <IrissWaybillCarPicker
              cars={pickerCars}
              selected={auto.manual ? "manual" : auto.car?.vin || auto.car?.brandModel || ""}
              onChoose={chooseCar}
              ownerBadge={isB192 ? "DZA" : undefined}
            />
            <button
              type="button"
              className="mt-3 h-10 w-full rounded-[10px] border border-[var(--iriss-line)] bg-white text-[12.5px] font-semibold text-[var(--iriss-ink)]"
              onClick={() => setPickerOpen(false)}
            >
              Aizvērt
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
