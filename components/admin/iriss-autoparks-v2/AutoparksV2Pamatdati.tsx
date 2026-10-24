"use client";

import { useState } from "react";
import { V2_REGISTRY_STATUS_LV, type AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { fmtCm3, fmtDateLv, fmtKm, fmtKw } from "@/lib/iriss-autoparks-v2-format";

type EditKey = "plate" | "location" | "arrivedAt" | "tyreSize" | "make" | "model" | "vin" | "firstRegDate" | "displacementCm3" | "powerKw";

const CSDD_VALUE: Partial<Record<EditKey, (b: AutoparksV2Basics) => { value: string; csdd: boolean }>> = {
  tyreSize: (b) => b.tyreSize,
  firstRegDate: (b) => b.firstRegDate,
  displacementCm3: (b) => ({ value: b.displacementCm3.value == null ? "" : String(b.displacementCm3.value), csdd: b.displacementCm3.csdd }),
  powerKw: (b) => ({ value: b.powerKw.value == null ? "" : String(b.powerKw.value), csdd: b.powerKw.csdd }),
};

/** Pamatdati (T2, T8): Auto, Tehniskie dati, CSDD reģistrs. Zaļš punkts = no CSDD. Tukšs = "+ Pievienot" (autosave). */
export function AutoparksV2Pamatdati({ basics, onBasics }: { basics: AutoparksV2Basics; onBasics: (b: AutoparksV2Basics) => void }) {
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [error, setError] = useState("");

  async function save(key: EditKey, value: string) {
    setEditing(null);
    const current = CSDD_VALUE[key] ? CSDD_VALUE[key]!(basics).value : (basics[key as "plate" | "location" | "arrivedAt" | "make" | "model" | "vin"] as string);
    const next = value.trim();
    if (next === current) return;
    setError("");
    const res = await fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(basics.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: key === "displacementCm3" || key === "powerKw" ? (next === "" ? null : Number(next)) : next }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { basics?: AutoparksV2Basics } | null;
    if (res?.ok && data?.basics) onBasics(data.basics);
    else setError(key === "vin" ? "Nederīgs VIN (17 zīmes, bez I/O/Q)" : "Neizdevās saglabāt");
  }

  const editable = (key: EditKey, label: string, value: string, shown: string, type: "text" | "date" | "number" = "text") => {
    const csdd = CSDD_VALUE[key]?.(basics).csdd ?? false;
    return (
      <div className="ap2-f">
        <i className={`ap2-cd ${csdd ? "on" : ""}`} />
        <span className="k">{label}</span>
        {editing === key ? (
          <input
            className="v"
            type={type}
            defaultValue={value}
            autoFocus
            onBlur={(e) => void save(key, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(null);
            }}
          />
        ) : (
          <button type="button" className={`v ${shown ? "" : "add"}`} onClick={() => setEditing(key)}>
            {shown || "+ Pievienot"}
          </button>
        )}
      </div>
    );
  };

  const ro = (label: string, shown: string, csdd: boolean) => (
    <div className="ap2-f">
      <i className={`ap2-cd ${csdd ? "on" : ""}`} />
      <span className="k">{label}</span>
      <span className={`v ${shown ? "" : "mut"}`}>{shown || "-"}</span>
    </div>
  );

  const reg = basics.registry;
  return (
    <div className="ap2-pane">
      <div className="ap2-card">
        <h3>Auto</h3>
        {ro("Īpašnieks", basics.ownerLabel, false)}
        {editable("make", "Marka", basics.make, basics.make)}
        {editable("model", "Modelis", basics.model, basics.model)}
        {editable("vin", "VIN", basics.vin, basics.vin)}
        {editable("plate", "Numurzīme", basics.plate, basics.plate)}
        {ro("Nobraukums", fmtKm(basics.mileageKm.value), basics.mileageKm.csdd)}
        {editable("location", "Atrašanās vieta", basics.location, basics.location)}
        {editable("arrivedAt", "Atvests", basics.arrivedAt, fmtDateLv(basics.arrivedAt), "date")}
        <h3>Tehniskie dati</h3>
        {editable("firstRegDate", "1. reģistrācija", basics.firstRegDate.value, fmtDateLv(basics.firstRegDate.value), "date")}
        {editable("displacementCm3", "Tilpums", basics.displacementCm3.value == null ? "" : String(basics.displacementCm3.value), fmtCm3(basics.displacementCm3.value), "number")}
        {editable("powerKw", "Jauda", basics.powerKw.value == null ? "" : String(basics.powerKw.value), fmtKw(basics.powerKw.value), "number")}
        {editable("tyreSize", "Riepas", basics.tyreSize.value, basics.tyreSize.value)}
      </div>
      <div className="ap2-card">
        <h3>CSDD reģistrs</h3>
        {ro("Statuss", V2_REGISTRY_STATUS_LV[reg.status], reg.known)}
        {ro("Akts", reg.actNo, Boolean(reg.actNo))}
        {ro("Akta datums", fmtDateLv(reg.actDate), Boolean(reg.actDate))}
      </div>
      {error ? <p className="ap2-err">{error}</p> : null}
    </div>
  );
}
