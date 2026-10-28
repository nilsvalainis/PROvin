"use client";

import { useState } from "react";
import type { AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { fmtCm3, fmtDateLv, fmtKm, fmtKw, parseNumberFieldInput } from "@/lib/iriss-autoparks-v2-format";

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

/** Pamatdati (T2): Auto, Tehniskie dati. CSDD reģistrs ir sava cilne (j63 / m03). Zaļš punkts = no CSDD. Tukšs = "+ Pievienot" (autosave). */
export function AutoparksV2Pamatdati({ basics, onBasics }: { basics: AutoparksV2Basics; onBasics: (b: AutoparksV2Basics) => void }) {
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [error, setError] = useState("");

  async function save(key: EditKey, value: string) {
    setEditing(null);
    const current = CSDD_VALUE[key] ? CSDD_VALUE[key]!(basics).value : (basics[key as "plate" | "location" | "arrivedAt" | "make" | "model" | "vin" | "year" | "color" | "owner"] as string);
    const next = value.trim();
    if (next === current) return;
    setError("");
    const num = NUM_KEYS.has(key) ? parseNumberFieldInput(next) : null;
    if (num === "invalid") {
      setError("Ievadi skaitli, piem., 171048 - lauks netika mainīts");
      return;
    }
    if (NUM_KEYS.has(key) && num !== null && String(num) === current) return;
    const res = await fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(basics.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: NUM_KEYS.has(key) ? num : next }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { basics?: AutoparksV2Basics; error?: string } | null;
    if (res?.ok && data?.basics) onBasics(data.basics);
    else if (data?.error === "invalid_power") setError("Jauda nav ticama (1-2000 kW) - lauks netika mainīts");
    else if (data?.error === "invalid_displacement") setError("Tilpums nav ticams (50-20000 cm3) - lauks netika mainīts");
    else if (data?.error === "invalid_mileage") setError("Nobraukums nav ticams - lauks netika mainīts");
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
            // Skaitļiem teksta lauks ar ciparu tastatūru: `type="number"` atdeva "" pie "171 048" / "1,9" un lauks tika iztīrīts.
            type={type === "number" ? "text" : type}
            inputMode={type === "number" ? "decimal" : undefined}
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

  /** «Pasūtījums» (Nils 27.10): atzīme pie jebkura statusa; īpašnieks ir galvenes joslā. */
  const clientOrderToggle = () => (
    <div className="ap2-f">
      <i className="ap2-cd" />
      <span className="k">Pasūtījums</span>
      <button
        type="button"
        role="switch"
        aria-checked={basics.clientOrder}
        className={`v ap2-switch ${basics.clientOrder ? "on" : ""}`}
        onClick={() => void saveClientOrder(!basics.clientOrder)}
      >
        {basics.clientOrder ? "Jā" : "Nē"}
      </button>
    </div>
  );

  async function saveClientOrder(next: boolean) {
    setError("");
    const res = await fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(basics.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientOrder: next ? "1" : "0" }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { basics?: AutoparksV2Basics } | null;
    if (res?.ok && data?.basics) onBasics(data.basics);
    else setError("Neizdevās saglabāt");
  }

  return (
    <div className="ap2-pane">
      {/* Makets (kabinets, apstiprināts 27.10): datorā lauku režģis 3 kolonnās, Auto un Tehniskie dati - atsevišķas kartītes. */}
      <div className="ap2-card ap2-pd-grid">
        <h3>Auto</h3>
        {clientOrderToggle()}
        {editable("make", "Marka", basics.make, basics.make)}
        {editable("model", "Modelis", basics.model, basics.model)}
        {editable("year", "Gads", basics.year, basics.year)}
        {editable("color", "Krāsa", basics.color, basics.color)}
        {editable("vin", "VIN", basics.vin, basics.vin)}
        {editable("plate", "Numurzīme", basics.plate, basics.plate)}
        {editable("mileageKm", "Nobraukums", basics.mileageKm.value == null ? "" : String(basics.mileageKm.value), fmtKm(basics.mileageKm.value), "number")}
        {/* "Atrašanās vieta" nerāda šeit kopš j62: lauks dzīvo tikai IRISS Loģistikas kabinetā (kartes punkts); dati paliek, tikai nav rediģējami no Autoparka. */}
        {editable("arrivedAt", "Atvests", basics.arrivedAt, fmtDateLv(basics.arrivedAt), "date")}
      </div>
      <div className="ap2-card ap2-pd-grid">
        <h3>
          Tehniskie dati <small className="ap2-h3-sub">· no CSDD, labojami</small>
        </h3>
        {editable("firstRegDate", "1. reģistrācija", basics.firstRegDate.value, fmtDateLv(basics.firstRegDate.value), "date")}
        {editable("displacementCm3", "Tilpums", basics.displacementCm3.value == null ? "" : String(basics.displacementCm3.value), fmtCm3(basics.displacementCm3.value), "number")}
        {editable("powerKw", "Jauda", basics.powerKw.value == null ? "" : String(basics.powerKw.value), fmtKw(basics.powerKw.value), "number")}
        {editable("gearbox", "Pārnesumkārba", basics.gearbox.value, basics.gearbox.value)}
        {editable("engine", "Dzinējs", basics.engine.value, basics.engine.value)}
        {editable("tyreSize", "Riepas", basics.tyreSize.value, basics.tyreSize.value)}
      </div>
      {error ? <p className="ap2-err">{error}</p> : null}
    </div>
  );
}
