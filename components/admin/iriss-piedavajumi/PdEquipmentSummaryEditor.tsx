"use client";

import { useEffect, useRef, useState } from "react";
import {
  IRISS_PD_EQ_SUMMARY_TITLE,
  irissPdEqSummaryDecision,
  irissPdEqSummarySource,
  irissPdEqSummaryStale,
  type IrissPdEquipmentSummary,
} from "@/lib/iriss-pd-equipment-summary";
import type { IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

function stampLv(iso: string): string {
  const d = new Date(iso);
  if (!iso || !Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(d)
    .replace(",", "");
}

/** Vai «Pārģenerēt» jāprasa apstiprinājums lapā: teksts labots ar roku (saglabāts vai vēl nesaglabāts). */
export function irissPdEqSummaryNeedsConfirm(saved: IrissPdEquipmentSummary | null, draft: IrissPdEquipmentSummary | null): boolean {
  if (!saved) return false;
  return saved.editedByAdmin || (draft !== null && draft.text !== saved.text);
}

/**
 * Nils 20.11: PD redaktorā «Automašīnas komplektācijas kopsavilkums (pēc VIN)».
 * Automātiski sagatavo vienreiz (ja nav vai avots mainījies un teksts nav labots); teksts rediģējams;
 * «Pārģenerēt» labotam tekstam prasa apstiprinājumu lapā.
 */
export function PdEquipmentSummaryEditor({
  rec,
  draft,
  editable,
  onChange,
  onRecord,
  beforeGenerate,
}: {
  rec: IrissPiedavajums;
  draft: IrissPdEquipmentSummary | null;
  editable: boolean;
  onChange: (next: IrissPdEquipmentSummary) => void;
  onRecord: (next: IrissPiedavajums) => void;
  beforeGenerate: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);
  const autoTried = useRef(false);
  const saved = rec.equipmentSummaryLv;
  const src = irissPdEqSummarySource(rec);
  const decision = irissPdEqSummaryDecision(saved, src);
  const stale = irissPdEqSummaryStale(saved, src);

  async function generate(force: boolean, confirm: boolean) {
    setBusy(true);
    setErr("");
    setConfirming(false);
    try {
      if (force && !(await beforeGenerate())) throw new Error("Neizdevās saglabāt izmaiņas.");
      const res = await fetch(`/api/admin/iriss-piedavajumi/${rec.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "equipment-summary", force, confirm }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; record?: IrissPiedavajums; message?: string; error?: string };
      if (data.error === "confirm_required") {
        setConfirming(true);
        return;
      }
      if (!data.ok || !data.record) throw new Error(data.message || "Neizdevās sagatavot kopsavilkumu.");
      onRecord(data.record);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās.");
    } finally {
      setBusy(false);
    }
  }

  // Vienreiz atverot: ja nav vai avots mainījies (un teksts nav labots) - sagatavo. Kļūda PD netraucē.
  useEffect(() => {
    if (autoTried.current || !editable || decision !== "generate") return;
    autoTried.current = true;
    void generate(false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, decision]);

  if (!saved && decision === "no_source") return null;

  const meta = [
    saved?.generatedAt ? `Sagatavots ${stampLv(saved.generatedAt)}` : "",
    saved?.editedByAdmin ? `labots ar roku${saved.editedAt ? ` ${stampLv(saved.editedAt)}` : ""}` : "",
    draft ? (draft.on ? "rāda klientam" : "paslēpts klientam") : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="pde-card" aria-label={IRISS_PD_EQ_SUMMARY_TITLE} data-testid="pd-eq-summary-editor">
      <div className="pde-ch">
        <h3>
          {IRISS_PD_EQ_SUMMARY_TITLE}
          <small>{busy ? "Gatavo kopsavilkumu..." : meta || "Vēl nav sagatavots"}</small>
        </h3>
        {draft ? (
          <button
            type="button"
            role="switch"
            aria-checked={draft.on}
            aria-label="Komplektācijas kopsavilkums: rāda klientam"
            className="pde-sw"
            disabled={!editable}
            onClick={() => onChange({ ...draft, on: !draft.on })}
          />
        ) : null}
      </div>
      {draft ? (
        <div className="pd-fld">
          <textarea
            aria-label="Komplektācijas kopsavilkuma teksts"
            value={draft.text}
            disabled={!editable || busy}
            rows={16}
            style={{ minHeight: 260, fontSize: 13, lineHeight: 1.45 }}
            onChange={(e) => onChange({ ...draft, text: e.target.value })}
          />
        </div>
      ) : null}
      {draft ? <p className="pd-hint">Pirmā rinda - ievads. «## » - grupa, «- » - punkts.</p> : null}
      {stale && saved?.editedByAdmin ? <p className="pd-hint">Avota dati mainījušies - labotais teksts netiek pārrakstīts automātiski.</p> : null}
      {err ? (
        <p className="pd-err" role="alert">
          {err}
        </p>
      ) : null}
      {confirming ? (
        <div role="alertdialog" aria-label="Apstiprināt pārģenerēšanu" className="pd-hint" style={{ border: "1px solid #f59e0b", borderRadius: 8, padding: "8px 10px", marginTop: 8 }}>
          <p style={{ margin: "0 0 8px" }}>Teksts labots ar roku. Pārģenerējot labojumi tiks pārrakstīti.</p>
          <button type="button" className="pd-btn p s" disabled={busy} onClick={() => void generate(true, true)}>
            Jā, pārģenerēt
          </button>{" "}
          <button type="button" className="pd-btn s" disabled={busy} onClick={() => setConfirming(false)}>
            Atcelt
          </button>
        </div>
      ) : editable && decision !== "no_source" ? (
        <button
          type="button"
          className="pd-btn s"
          style={{ marginTop: 8 }}
          disabled={busy}
          onClick={() => (irissPdEqSummaryNeedsConfirm(saved, draft) ? setConfirming(true) : void generate(true, false))}
        >
          {busy ? "Gatavo..." : saved ? "Pārģenerēt" : "Sagatavot"}
        </button>
      ) : null}
    </section>
  );
}
