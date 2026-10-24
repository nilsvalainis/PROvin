"use client";

import { useState } from "react";
import { AUTOPARKS_OWNER_LV, AUTOPARKS_OWNERS, type AutoparksOwner } from "@/lib/iriss-autoparks";
import { V2_REGISTRY_STATUS_LV, type AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { fmtCm3, fmtDateLv, fmtKm, fmtKw } from "@/lib/iriss-autoparks-v2-format";

type EditKey =
  | "plate"
  | "location"
  | "arrivedAt"
  | "tyreSize"
  | "make"
  | "model"
  | "vin"
  | "year"
  | "color"
  | "owner"
  | "firstRegDate"
  | "displacementCm3"
  | "powerKw"
  | "mileageKm"
  | "gearbox"
  | "engine";

const CSDD_VALUE: Partial<Record<EditKey, (b: AutoparksV2Basics) => { value: string; csdd: boolean }>> = {
  tyreSize: (b) => b.tyreSize,
  gearbox: (b) => b.gearbox,
  engine: (b) => b.engine,
  firstRegDate: (b) => b.firstRegDate,
  displacementCm3: (b) => ({ value: b.displacementCm3.value == null ? "" : String(b.displacementCm3.value), csdd: b.displacementCm3.csdd }),
  powerKw: (b) => ({ value: b.powerKw.value == null ? "" : String(b.powerKw.value), csdd: b.powerKw.csdd }),
  mileageKm: (b) => ({ value: b.mileageKm.value == null ? "" : String(b.mileageKm.value), csdd: b.mileageKm.csdd }),
};

const NUM_KEYS: ReadonlySet<EditKey> = new Set(["displacementCm3", "powerKw", "mileageKm"]);

/** Pamatdati (T2, T8): Auto, Tehniskie dati, CSDD reģistrs. Zaļš punkts = no CSDD. Tukšs = "+ Pievienot" (autosave). */
export function AutoparksV2Pamatdati({ basics, onBasics }: { basics: AutoparksV2Basics; onBasics: (b: AutoparksV2Basics) => void }) {
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [error, setError] = useState("");

  async function save(key: EditKey, value: string) {
    setEditing(null);
    const current = CSDD_VALUE[key] ? CSDD_VALUE[key]!(basics).value : (basics[key as "plate" | "location" | "arrivedAt" | "make" | "model" | "vin" | "year" | "color" | "owner"] as string);
    const next = value.trim();
    if (next === current) return;
    setError("");
    const res = await fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(basics.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: NUM_KEYS.has(key) ? (next === "" ? null : Number(next)) : next }),
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

  const editableOwner = (owner: AutoparksOwner) => (
    <div className="ap2-f">
      <i className="ap2-cd" />
      <span className="k">Īpašnieks</span>
      {editing === "owner" ? (
        <select className="v" autoFocus defaultValue={owner} onChange={(e) => void save("owner", e.target.value)} onBlur={() => setEditing(null)}>
          {AUTOPARKS_OWNERS.map((o) => (
            <option key={o} value={o}>
              {AUTOPARKS_OWNER_LV[o]}
            </option>
          ))}
        </select>
      ) : (
        <button type="button" className="v" onClick={() => setEditing("owner")}>
          {AUTOPARKS_OWNER_LV[owner]}
        </button>
      )}
    </div>
  );

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
        {editableOwner(basics.owner)}
        {editable("make", "Marka", basics.make, basics.make)}
        {editable("model", "Modelis", basics.model, basics.model)}
        {editable("year", "Gads", basics.year, basics.year)}
        {editable("color", "Krāsa", basics.color, basics.color)}
        {editable("vin", "VIN", basics.vin, basics.vin)}
        {editable("plate", "Numurzīme", basics.plate, basics.plate)}
        {editable("mileageKm", "Nobraukums", basics.mileageKm.value == null ? "" : String(basics.mileageKm.value), fmtKm(basics.mileageKm.value), "number")}
        {editable("location", "Atrašanās vieta", basics.location, basics.location)}
        {editable("arrivedAt", "Atvests", basics.arrivedAt, fmtDateLv(basics.arrivedAt), "date")}
        <h3>Tehniskie dati</h3>
        {editable("firstRegDate", "1. reģistrācija", basics.firstRegDate.value, fmtDateLv(basics.firstRegDate.value), "date")}
        {editable("displacementCm3", "Tilpums", basics.displacementCm3.value == null ? "" : String(basics.displacementCm3.value), fmtCm3(basics.displacementCm3.value), "number")}
        {editable("powerKw", "Jauda", basics.powerKw.value == null ? "" : String(basics.powerKw.value), fmtKw(basics.powerKw.value), "number")}
        {editable("gearbox", "Pārnesumkārba", basics.gearbox.value, basics.gearbox.value)}
        {editable("engine", "Dzinējs", basics.engine.value, basics.engine.value)}
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
