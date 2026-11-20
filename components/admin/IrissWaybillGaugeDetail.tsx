import styles from "@/components/admin/IrissWaybillGauges.module.css";
import { formatWaybillExpiryDdMmHm } from "@/lib/iriss-pavadzimes-countdown";
import { formatWaybillLeft, type WaybillGauge } from "@/lib/iriss-waybill-gauges";

export function IrissWaybillGaugeDetail({
  active,
  now,
  onOpenPdf,
  onExtend,
  onStop,
}: {
  active: WaybillGauge;
  now: Date;
  onOpenPdf?: (gauge: WaybillGauge) => void;
  onExtend?: (gauge: WaybillGauge) => void;
  onStop?: (gauge: WaybillGauge) => void;
}) {
  const pdfHref = active.id ? `/api/admin/iriss-pavadzimes/${encodeURIComponent(active.id)}/pdf` : "";
  return (
    <div className={styles.detail}>
      <p className="truncate text-[13px] font-semibold">{active.brandModel || active.plate}</p>
      <p className="text-[12px]">
        Līdz {formatWaybillExpiryDdMmHm(active.validUntil)} · atlikušas {formatWaybillLeft(active.validUntil, now)}
      </p>
      <div className={styles.actions}>
        {active.id ? (
          onOpenPdf ? (
            <button type="button" className={styles.btn} onClick={() => onOpenPdf(active)}>
              Atvērt PDF{active.number ? ` · Nr. ${active.number}` : ""}
            </button>
          ) : (
            <a className={styles.btn} href={pdfHref} target="_blank" rel="noopener noreferrer">
              Atvērt PDF{active.number ? ` · Nr. ${active.number}` : ""}
            </a>
          )
        ) : null}
        {active.id ? null : (
          <button type="button" className={styles.btn} disabled>
            PDF
          </button>
        )}
        {/* 20.11: Pagarināt arī pavadzīmei, kuras PDF vēl nav indeksā (forma aizpildās no numura un auto). */}
        <button type="button" className={styles.btn} onClick={() => onExtend?.(active)}>
          Pagarināt
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnStop}`}
          disabled={!active.id || !active.number}
          onClick={() => onStop?.(active)}
        >
          Pārtraukt
        </button>
      </div>
    </div>
  );
}
