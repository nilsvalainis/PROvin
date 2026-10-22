"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { IrissProjectIndicator } from "@/components/admin/IrissProjectIndicator";
import { IrissAutoparksRoom } from "@/components/admin/iriss-autoparks/IrissAutoparksRoom";
import { irissLvDealerPlateFont } from "@/components/admin/iriss-lv-dealer-plate-font";
import { AdminMobileRoundBtn, AdminMobileSearchField, AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import {
  AUTOPARKS_STAGE_LV,
  AUTOPARKS_STAGES,
  AUTOPARKS_STATUS_LV,
  AUTOPARKS_STATUS_SHORT_LV,
  AUTOPARKS_STATUSES,
  autoparksCarTitle,
  autoparksDaysInPark,
  autoparksStatusCounts,
  AUTOPARKS_SORT_LV,
  AUTOPARKS_SORTS,
  isAutoparksSort,
  sortAutoparksRows,
  type AutoparksCar,
  type AutoparksListRow,
  type AutoparksSort,
  type AutoparksStatus,
} from "@/lib/iriss-autoparks";

type Props = {
  initialCars: AutoparksListRow[];
  storeEnabled: boolean;
  hideSums: boolean;
  canWrite: boolean;
};

type Filter = AutoparksStatus | "active" | "all" | "archive";

const SORT_PREF_KEY = "iriss-autoparks-sort-v1";


function readUrlCar(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("auto");
}

function writeUrlCar(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("auto", id);
  else url.searchParams.delete("auto");
  window.history.replaceState(null, "", url.toString());
}

export function IrissAutoparksClient({ initialCars, storeEnabled, hideSums, canWrite }: Props) {
  const [cars, setCars] = useState(initialCars);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AutoparksSort>("status");
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const id = readUrlCar();
    if (id) setOpenId(id);
    try {
      const saved = window.localStorage.getItem(SORT_PREF_KEY);
      if (isAutoparksSort(saved)) setSort(saved);
    } catch {
      // nav krātuves
    }
  }, []);

  function changeSort(next: AutoparksSort) {
    setSort(next);
    try {
      window.localStorage.setItem(SORT_PREF_KEY, next);
    } catch {
      // nav krātuves
    }
  }

  const open = useCallback((id: string | null) => {
    setOpenId(id);
    writeUrlCar(id);
    if (id && window.matchMedia("(max-width: 1023px)").matches) window.scrollTo({ top: 0 });
  }, []);

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/admin/iriss-logistics/autoparks", { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const body = (await res.json()) as { cars?: AutoparksListRow[] };
    if (body.cars) setCars(body.cars);
  }, []);

  const counts = useMemo(() => autoparksStatusCounts(cars), [cars]);
  const archivedCount = useMemo(() => cars.filter((c) => c.archivedAt).length, [cars]);
  const activeCount = cars.length - archivedCount - counts.sold;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = cars
      .filter((c) =>
        filter === "archive"
          ? Boolean(c.archivedAt)
          : !c.archivedAt && (filter === "all" ? true : filter === "active" ? c.status !== "sold" : c.status === filter),
      )
      .filter((c) => !q || `${c.make} ${c.model} ${c.year} ${c.vin} ${c.plate} ${c.location}`.toLowerCase().includes(q));
    return sortAutoparksRows(rows, sort);
  }, [cars, filter, query, sort]);

  /** Statuss tieši no kartītes - viens izvēles klikšķis, bez istabas atvēršanas. */
  async function setStatus(id: string, status: AutoparksStatus) {
    const before = cars;
    setCars((prev) => prev.map((c) => (c.id === id ? { ...c, status, statusChangedAt: new Date().toISOString() } : c)));
    const res = await fetch(`/api/admin/iriss-logistics/autoparks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ car: { status } }),
    }).catch(() => null);
    if (!res?.ok) {
      setCars(before);
      setNotice("Statusu neizdevās saglabāt.");
    }
  }

  function onCarChanged(car: AutoparksCar) {
    setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, ...car } : c)));
  }

  if (!storeEnabled) {
    return <div className="px-4 py-8 text-sm">Autoparka krātuve nav pieejama (tā pati, kas Loģistikai).</div>;
  }

  const roomOpen = Boolean(openId && cars.some((c) => c.id === openId));

  return (
    <div className={`iriss-ap ${roomOpen ? "room-open" : ""}`}>
      <div className="md:hidden">
        {roomOpen ? null : (
          <AdminMobileTopBar
            title="Autoparks"
            trailing={canWrite ? <AdminMobileRoundBtn name="pievienot" primary label="Pievienot auto" onClick={() => setAddOpen(true)} /> : null}
          >
            <AdminMobileSearchField value={query} onChange={setQuery} placeholder="Marka, VIN, numurs" />
          </AdminMobileTopBar>
        )}
      </div>

      <header className="iriss-ap-head">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight">Autoparks</h1>
            <IrissProjectIndicator />
          </div>
          <p className="mt-0.5 text-[12.5px] text-[#6e6e73]">
            {activeCount} auto parkā{counts.sold ? ` · ${counts.sold} pārdoti` : ""}
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Marka, VIN, numurs, vieta"
          className="iriss-ap-search"
        />
        {canWrite ? (
          <button type="button" className="iriss-ap-btn-dark" onClick={() => setAddOpen(true)}>
            + Pievienot auto
          </button>
        ) : null}
      </header>

      {notice ? (
        <div className="iriss-ap-notice" role="status">
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" aria-label="Aizvērt" onClick={() => setNotice("")}>
            ✕
          </button>
        </div>
      ) : null}

      <div className="iriss-ap-pipeline" role="tablist" aria-label="Statusi">
        <button type="button" role="tab" aria-selected={filter === "active"} className={`iriss-ap-pipe all ${filter === "active" ? "on" : ""}`} onClick={() => setFilter("active")}>
          <span className="n">{activeCount}</span>
          <span className="l">Parkā</span>
        </button>
        {AUTOPARKS_STATUSES.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={filter === s}
            className={`iriss-ap-pipe st-${s} ${filter === s ? "on" : ""}`}
            onClick={() => setFilter((cur) => (cur === s ? "active" : s))}
          >
            {i > 0 ? <span className="arrow" aria-hidden /> : null}
            <span className="n">{counts[s]}</span>
            <span className="l">{AUTOPARKS_STATUS_LV[s]}</span>
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={filter === "archive"}
          className={`iriss-ap-pipe archive ${filter === "archive" ? "on" : ""}`}
          onClick={() => setFilter((cur) => (cur === "archive" ? "active" : "archive"))}
        >
          <span className="n">{archivedCount}</span>
          <span className="l">Arhīvs</span>
        </button>
      </div>

      <div className="iriss-ap-sortbar">
        <label className="iriss-ap-sort">
          <span>Kārtot</span>
          <select value={sort} onChange={(e) => changeSort(e.target.value as AutoparksSort)} aria-label="Kārtot sarakstu">
            {AUTOPARKS_SORTS.map((m) => (
              <option key={m} value={m}>
                {AUTOPARKS_SORT_LV[m]}
              </option>
            ))}
          </select>
        </label>
        <span className="iriss-ap-sort-count">{visible.length} auto</span>
      </div>

      <div className="iriss-ap-body">
        <section className="iriss-ap-list" aria-label="Auto saraksts">
          {visible.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              active={car.id === openId}
              compact={roomOpen}
              canWrite={canWrite}
              onOpen={() => open(car.id)}
              onStatus={(s) => void setStatus(car.id, s)}
            />
          ))}
          {visible.length === 0 ? (
            <div className="iriss-ap-empty">
              {cars.length === 0 ? (
                <>
                  <p className="text-[15px] font-semibold">Autoparks vēl ir tukšs</p>
                  <p className="mt-1 text-[13px] text-[#6e6e73]">
                    Auto šeit nonāk no Loģistikas ar &quot;Uz Autoparku&quot; vai ar &quot;+ Pievienot auto&quot;.
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-[#6e6e73]">Šajā skatā nav auto.</p>
              )}
            </div>
          ) : null}
        </section>

        {roomOpen && openId ? (
          <IrissAutoparksRoom
            key={openId}
            carId={openId}
            hideSums={hideSums}
            canWrite={canWrite}
            onClose={() => open(null)}
            onCarChanged={onCarChanged}
            onDeleted={(id) => {
              setCars((prev) => prev.filter((c) => c.id !== id));
              open(null);
              setNotice("Auto dzēsts.");
            }}
            onFilesChanged={() => void refreshList()}
          />
        ) : null}
      </div>

      {addOpen ? (
        <AddCarDialog
          onClose={() => setAddOpen(false)}
          onCreated={(car) => {
            setAddOpen(false);
            void refreshList().then(() => open(car.id));
          }}
        />
      ) : null}
    </div>
  );
}

function Plate({ car }: { car: Pick<AutoparksCar, "plate" | "vin"> }) {
  if (car.plate) {
    return (
      <span className={`iriss-ap-plate ${irissLvDealerPlateFont.className}`}>
        <i>LV</i>
        {car.plate}
      </span>
    );
  }
  return <span className="iriss-ap-vin-tail">{car.vin ? `…${car.vin.slice(-6)}` : "bez VIN"}</span>;
}

function CarCard({
  car,
  active,
  compact,
  canWrite,
  onOpen,
  onStatus,
}: {
  car: AutoparksListRow;
  active: boolean;
  compact: boolean;
  canWrite: boolean;
  onOpen: () => void;
  onStatus: (s: AutoparksStatus) => void;
}) {
  const days = autoparksDaysInPark(car);
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      className={`iriss-ap-card st-${car.status} ${active ? "active" : ""} ${compact ? "compact" : ""}`}
      onClick={onOpen}
      onKeyDown={onKey}
    >
      <div className="flex items-center gap-2">
        <Plate car={car} />
        <label className="iriss-ap-status-select ml-auto" onClick={(e) => e.stopPropagation()}>
          <span className="sr-only">Statuss</span>
          <i aria-hidden />
          <select value={car.status} disabled={!canWrite} onChange={(e) => onStatus(e.target.value as AutoparksStatus)}>
            {AUTOPARKS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {AUTOPARKS_STATUS_SHORT_LV[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 truncate text-[15px] font-semibold leading-tight">{autoparksCarTitle(car)}</p>
      <p className="mt-0.5 truncate text-[12px] text-[#6e6e73]">
        {[car.mileageKm != null ? `${car.mileageKm.toLocaleString("lv-LV")} km` : "", car.color, car.location].filter(Boolean).join(" · ") || car.vin || "-"}
      </p>
      {compact ? null : (
        <div className="iriss-ap-meter" aria-label="Dokumenti pa posmiem">
          {AUTOPARKS_STAGES.map((stage) => (
            <span key={stage} className={car.stageFileCounts[stage] > 0 ? "has" : ""} title={`${AUTOPARKS_STAGE_LV[stage]}: ${car.stageFileCounts[stage]}`}>
              <i />
              {AUTOPARKS_STAGE_LV[stage]}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-3 text-[12px] text-[#6e6e73]">
        <span>{days === 0 ? "šodien" : `${days} d. parkā`}</span>
        <span className="ml-auto tabular-nums">{car.fileCount} faili</span>
        {car.workOpen > 0 ? <span className="iriss-ap-badge">{car.workOpen} darbi</span> : null}
      </div>
    </div>
  );
}

function AddCarDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (car: AutoparksCar) => void }) {
  const [form, setForm] = useState({ make: "", model: "", year: "", vin: "", plate: "", mileageKm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!form.make.trim() && !form.vin.trim()) {
      setError("Ieraksti marku vai VIN.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/iriss-logistics/autoparks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Neizdevās pievienot.");
      return;
    }
    const body = (await res.json()) as { car?: AutoparksCar };
    if (body.car) onCreated(body.car);
  }

  const field = (key: keyof typeof form, label: string, extra: Record<string, string> = {}) => (
    <label className="iriss-ap-field">
      <span>{label}</span>
      <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...extra} />
    </label>
  );

  return (
    <div className="iriss-ap-dialog-bg" onClick={onClose} role="presentation">
      <div className="iriss-ap-dialog" role="dialog" aria-modal="true" aria-label="Pievienot auto" onClick={(e) => e.stopPropagation()}>
        <p className="text-[17px] font-semibold">Pievienot auto</p>
        <p className="mt-0.5 text-[12.5px] text-[#6e6e73]">Auto no Loģistikas nonāk šeit pats ar &quot;Uz Autoparku&quot;.</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {field("make", "Marka", { autoFocus: "true", placeholder: "Volvo" })}
          {field("model", "Modelis", { placeholder: "XC60" })}
          {field("year", "Gads", { inputMode: "numeric", placeholder: "2019" })}
          {field("mileageKm", "Nobraukums, km", { inputMode: "numeric" })}
          {field("plate", "Numurzīme")}
          {field("vin", "VIN")}
        </div>
        {error ? <p className="mt-2 text-[12.5px] text-[#c2362b]">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="iriss-ap-btn-sec" onClick={onClose}>
            Atcelt
          </button>
          <button type="button" className="iriss-ap-btn-dark" disabled={busy} onClick={() => void submit()}>
            {busy ? "Saglabā…" : "Pievienot"}
          </button>
        </div>
      </div>
    </div>
  );
}
