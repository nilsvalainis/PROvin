"use client";

import { useState } from "react";
import { ap2PatchJson } from "./ap2-save";
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
  | "engine"
  | "keysCount"
  | "ownersCount"
  | "secondWheels"
  | "inspectionUntil"
  | "vehicleType"
  | "fuel"
  | "seats"
  | "grossMassKg"
  | "co2GKm"
  | "tradeActNo";

/** IRISS 18.11: lauki no izsoles (ar roku, bez CSDD zaļā punkta). */
const EXTRA_VALUE: Partial<Record<EditKey, (b: AutoparksV2Basics) => string>> = {
  keysCount: (b) => (b.extras?.keysCount == null ? "" : String(b.extras.keysCount)),
  ownersCount: (b) => (b.extras?.ownersCount == null ? "" : String(b.extras.ownersCount)),
  secondWheels: (b) => b.extras?.secondWheels ?? "",
  inspectionUntil: (b) => b.extras?.inspectionUntil ?? "",
};

const COUNT_KEYS: ReadonlySet<EditKey> = new Set(["keysCount", "ownersCount"]);

const CSDD_VALUE: Partial<Record<EditKey, (b: AutoparksV2Basics) => { value: string; csdd: boolean }>> = {
  tyreSize: (b) => b.tyreSize,
  gearbox: (b) => b.gearbox,
  engine: (b) => b.engine,
  firstRegDate: (b) => b.firstRegDate,
  displacementCm3: (b) => ({ value: b.displacementCm3.value == null ? "" : String(b.displacementCm3.value), csdd: b.displacementCm3.csdd }),
  powerKw: (b) => ({ value: b.powerKw.value == null ? "" : String(b.powerKw.value), csdd: b.powerKw.csdd }),
  mileageKm: (b) => ({ value: b.mileageKm.value == null ? "" : String(b.mileageKm.value), csdd: b.mileageKm.csdd }),
  // Cenu lapas obligātie lauki (Nils 20.11): ar roku vai no CSDD (tehniskie dati / tirdzniecības reģistrs).
  vehicleType: (b) => b.sale?.vehicleType ?? { value: "", csdd: false },
  fuel: (b) => b.sale?.fuel ?? { value: "", csdd: false },
  tradeActNo: (b) => b.sale?.tradeActNo ?? { value: "", csdd: false },
  seats: (b) => saleNum(b.sale?.seats),
  grossMassKg: (b) => saleNum(b.sale?.grossMassKg),
  co2GKm: (b) => saleNum(b.sale?.co2GKm),
};

function saleNum(v: { value: number | null; csdd: boolean } | undefined): { value: string; csdd: boolean } {
  return v && v.value != null ? { value: String(v.value), csdd: v.csdd } : { value: "", csdd: false };
}

/** Skaitļi, ko pārbauda serveris (robežas `V2_SALE_NUM_RANGE`); "" = notīrīt. */
const SALE_NUM_KEYS: ReadonlySet<EditKey> = new Set(["seats", "grossMassKg", "co2GKm"]);

const NUM_KEYS: ReadonlySet<EditKey> = new Set(["displacementCm3", "powerKw", "mileageKm"]);

function fmtUnit(n: number | null | undefined, unit: string): string {
  return n == null ? "" : `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${unit}`;
}

/** Pamatdati (T2): Auto, Tehniskie dati. CSDD reģistrs ir sava cilne (j63 / m03). Zaļš punkts = no CSDD. Tukšs = "+ Pievienot" (autosave). */
export function AutoparksV2Pamatdati({ basics, onBasics }: { basics: AutoparksV2Basics; onBasics: (b: AutoparksV2Basics) => void }) {
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [error, setError] = useState("");
  // Ja saglabāšana neizdodas, ievadītā vērtība nepazūd - «Mēģināt vēlreiz».
  const [retry, setRetry] = useState<(() => void) | null>(null);

  async function save(key: EditKey, value: string) {
    setEditing(null);
    const current = EXTRA_VALUE[key]
      ? EXTRA_VALUE[key]!(basics)
      : CSDD_VALUE[key]
        ? CSDD_VALUE[key]!(basics).value
        : (basics[key as "plate" | "location" | "arrivedAt" | "make" | "model" | "vin" | "year" | "color" | "owner"] as string);
    const next = value.trim();
    if (next === current) return;
    setError("");
    const num = NUM_KEYS.has(key) ? parseNumberFieldInput(next) : null;
    if (num === "invalid") {
      setError("Ievadi skaitli, piem., 171048 - lauks netika mainīts");
      return;
    }
    if (NUM_KEYS.has(key) && num !== null && String(num) === current) return;
    if (COUNT_KEYS.has(key) && next !== "" && !/^\d{1,2}$/.test(next)) {
      setError("Ievadi skaitu, piem., 2 - lauks netika mainīts");
      return;
    }
    setRetry(null);
    const r = await ap2PatchJson<{ basics?: AutoparksV2Basics; error?: string }>(
      `/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(basics.id)}`,
      { [key]: NUM_KEYS.has(key) ? num : COUNT_KEYS.has(key) ? (next === "" ? null : Number(next)) : SALE_NUM_KEYS.has(key) ? next.replace(/\s/g, "") : next },
    );
    const data = r.data;
    if (r.ok && data?.basics) onBasics(data.basics);
    else if (data?.error === "invalid_power") setError("Jauda nav ticama (1-2000 kW) - lauks netika mainīts");
    else if (data?.error === "invalid_displacement") setError("Tilpums nav ticams (50-20000 cm3) - lauks netika mainīts");
    else if (data?.error === "invalid_mileage") setError("Nobraukums nav ticams - lauks netika mainīts");
    else if (data?.error === "invalid_sale_num") setError("Vērtība nav ticama - lauks netika mainīts");
    else if (data?.error === "invalid_count") setError("Skaits nav ticams - lauks netika mainīts");
    else if (data?.error === "invalid_inspection") setError("TA/HU: ievadi mēnesi un gadu, piem., 04.2028 - lauks netika mainīts");
    else if (key === "vin" && r.status !== null && r.status < 500) setError("Nederīgs VIN (17 zīmes, bez I/O/Q)");
    else {
      setError(`Neizdevās saglabāt «${next}»`);
      setRetry(() => () => void save(key, value));
    }
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
            inputMode={type === "number" ? (COUNT_KEYS.has(key) ? "numeric" : "decimal") : undefined}
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
    setRetry(null);
    const r = await ap2PatchJson<{ basics?: AutoparksV2Basics }>(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(basics.id)}`, {
      clientOrder: next ? "1" : "0",
    });
    if (r.ok && r.data?.basics) onBasics(r.data.basics);
    else {
      setError("Neizdevās saglabāt");
      setRetry(() => () => void saveClientOrder(next));
    }
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
        {editable("tradeActNo", "Akta numurs", CSDD_VALUE.tradeActNo!(basics).value, CSDD_VALUE.tradeActNo!(basics).value)}
        {editable("mileageKm", "Nobraukums", basics.mileageKm.value == null ? "" : String(basics.mileageKm.value), fmtKm(basics.mileageKm.value), "number")}
        {editable("ownersCount", "Īpašnieku skaits", EXTRA_VALUE.ownersCount!(basics), EXTRA_VALUE.ownersCount!(basics), "number")}
        {editable("keysCount", "Atslēgas", EXTRA_VALUE.keysCount!(basics), EXTRA_VALUE.keysCount!(basics), "number")}
        {/* TA/HU lauks noņemts (Nils 19.11: apskati veic klienti) - dati glabātuvē paliek, UI nerāda. */}
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
        {editable("fuel", "Degviela", CSDD_VALUE.fuel!(basics).value, CSDD_VALUE.fuel!(basics).value)}
        {editable("vehicleType", "TL veids", CSDD_VALUE.vehicleType!(basics).value, CSDD_VALUE.vehicleType!(basics).value)}
        {editable("seats", "Sēdvietas", CSDD_VALUE.seats!(basics).value, CSDD_VALUE.seats!(basics).value, "number")}
        {editable("grossMassKg", "Pilna masa", CSDD_VALUE.grossMassKg!(basics).value, fmtUnit(basics.sale?.grossMassKg.value, "kg"), "number")}
        {editable("co2GKm", "CO2", CSDD_VALUE.co2GKm!(basics).value, fmtUnit(basics.sale?.co2GKm.value, "g/km"), "number")}
        {editable("tyreSize", "Riepas", basics.tyreSize.value, basics.tyreSize.value)}
        {editable("secondWheels", "Otrs disku komplekts", EXTRA_VALUE.secondWheels!(basics), EXTRA_VALUE.secondWheels!(basics))}
      </div>
      {error ? (
        <p className="ap2-err" role="alert">
          {error}
          {retry ? (
            <>
              {" "}
              <button type="button" className="ap2-retry" onClick={() => { const r = retry; setRetry(null); r(); }}>
                Mēģināt vēlreiz
              </button>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
