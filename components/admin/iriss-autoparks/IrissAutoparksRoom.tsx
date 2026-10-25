"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  AUTOPARKS_FILE_KIND_LV,
  AUTOPARKS_FILE_KINDS,
  AUTOPARKS_STAGE_HINT_LV,
  AUTOPARKS_STAGE_LV,
  AUTOPARKS_STAGES,
  AUTOPARKS_STATUS_SHORT_LV,
  AUTOPARKS_STATUSES,
  autoparksCarTitle,
  autoparksDaysInPark,
  autoparksDefaultStage,
  autoparksWorkTotal,
  formatAutoparksBytes,
  formatAutoparksEur,
  type AutoparksCar,
  type AutoparksFile,
  type AutoparksFileKind,
  type AutoparksRoom as Room,
  type AutoparksStage,
  type AutoparksStatus,
  type AutoparksWorkItem,
} from "@/lib/iriss-autoparks";
import {
  REGISTRY_FIELD_LV,
  REGISTRY_NUMBER_KEYS,
  REGISTRY_SAFETY_KEYS,
  REGISTRY_SAFETY_LV,
  REGISTRY_SAFETY_STATES,
  REGISTRY_TEXT_KEYS,
  registryFieldSource,
  type RegistryKey,
} from "@/lib/iriss-autoparks-registry";

type LogisticsDoc = { id: string; title: string; section: string; typeLabel: string; hasFile: boolean; sourceUrl: string; createdAt: string };

type Props = {
  carId: string;
  hideSums: boolean;
  canWrite: boolean;
  onClose: () => void;
  onCarChanged: (car: AutoparksCar) => void;
  onFilesChanged: () => void;
  /** Pēc dzēšanas: izņem no saraksta un aizver istabu. */
  onDeleted: (carId: string) => void;
};

const API = "/api/admin/iriss-logistics/autoparks";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Telefona foto saspiež līdz ~2000 px JPEG, lai augšupielāde iekļaujas 4 MB. Ja pārlūks bildi nevar nolasīt, sūta oriģinālu. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function IrissAutoparksRoom({ carId, hideSums, canWrite, onClose, onCarChanged, onFilesChanged, onDeleted }: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [logDocs, setLogDocs] = useState<LogisticsDoc[]>([]);
  const [stage, setStage] = useState<AutoparksStage | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const applyBody = useCallback(
    (body: { room?: Room; logisticsDocs?: LogisticsDoc[] }) => {
      if (body.room) {
        setRoom(body.room);
        onCarChanged(body.room.car);
      }
      if (body.logisticsDocs) setLogDocs(body.logisticsDocs);
    },
    [onCarChanged],
  );

  useEffect(() => {
    let off = false;
    void fetch(`${API}/${encodeURIComponent(carId)}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { room?: Room; logisticsDocs?: LogisticsDoc[] }) => {
        if (off) return;
        if (body.room) setRoom(body.room);
        setLogDocs(body.logisticsDocs ?? []);
        if (body.room) setStage((cur) => cur ?? autoparksDefaultStage(body.room!.car.status));
      })
      .catch(() => !off && setError("Istabu neizdevās ielādēt."));
    return () => {
      off = true;
    };
  }, [carId]);

  const patch = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch(`${API}/${encodeURIComponent(carId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);
      if (!res?.ok) {
        setError(res?.status === 403 ? "Tev ir tikai skatīšanās tiesības." : "Neizdevās saglabāt.");
        return false;
      }
      applyBody((await res.json()) as { room?: Room });
      setError("");
      setSaved(`Saglabāts ${new Date().toLocaleTimeString("lv-LV", { timeZone: "Europe/Riga", hour: "2-digit", minute: "2-digit" })}`);
      return true;
    },
    [applyBody, carId],
  );

  if (!room) {
    return (
      <section className="iriss-ap-room">
        <RoomTop onClose={onClose} title={error || "Ielādē…"} />
      </section>
    );
  }

  const { car } = room;
  const active = stage ?? autoparksDefaultStage(car.status);
  const stageFiles = room.files.filter((f) => f.stage === active);
  const stageNotes = room.notes.filter((n) => n.stage === active);
  const pdfCount = room.files.filter((f) => f.contentType.includes("pdf")).length;

  return (
    <section className="iriss-ap-room" aria-label={autoparksCarTitle(car)}>
      <RoomTop onClose={onClose} title={autoparksCarTitle(car)}>
        {saved ? <span className="iriss-ap-saved">{saved}</span> : null}
        {pdfCount > 0 ? (
          <a className="iriss-ap-btn-sec" href={`${API}/${encodeURIComponent(car.id)}/bundle`}>
            Visi PDF
          </a>
        ) : null}
      </RoomTop>

      <div className="iriss-ap-room-scroll">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#6e6e73]">
          {car.vin ? (
            <button type="button" className="font-mono text-[12.5px] text-[#1d1d1f]" title="Kopēt VIN" onClick={() => void navigator.clipboard.writeText(car.vin)}>
              {car.vin}
            </button>
          ) : null}
          <span>{autoparksDaysInPark(car)} d. parkā</span>
          <span>Statuss kopš {fmtDate(car.statusChangedAt)}</span>
        </div>

        <StatusSegment status={car.status} disabled={!canWrite} onChange={(s) => void patch({ car: { status: s } })} />

        {canWrite ? (
          <div className="iriss-ap-lifecycle">
            {car.archivedAt ? (
              <>
                <span className="iriss-ap-archived-tag">Arhīvā kopš {fmtDate(car.archivedAt)}</span>
                <button type="button" className="iriss-ap-btn-sec" onClick={() => void patch({ archived: false })}>
                  Atjaunot no arhīva
                </button>
              </>
            ) : car.status === "sold" ? (
              <button type="button" className="iriss-ap-btn-dark" onClick={() => void patch({ archived: true })}>
                Pārvietot uz arhīvu
              </button>
            ) : null}
            <button
              type="button"
              className="iriss-ap-btn-danger"
              onClick={async () => {
                if (!window.confirm(`Dzēst "${autoparksCarTitle(car)}" ar visiem failiem, piezīmēm un tāmi? To nevar atsaukt.`)) return;
                const res = await fetch(`${API}/${encodeURIComponent(car.id)}`, { method: "DELETE", credentials: "include" }).catch(() => null);
                if (!res?.ok) {
                  setError(res?.status === 403 ? "Tev ir tikai skatīšanās tiesības." : "Neizdevās dzēst.");
                  return;
                }
                onDeleted(car.id);
              }}
            >
              Dzēst auto
            </button>
          </div>
        ) : null}

        <CarFields car={car} hideSums={hideSums} canWrite={canWrite} onSave={(fields) => void patch({ car: fields })} />
        <PriceSheetFields car={car} hideSums={hideSums} canWrite={canWrite} onSave={(fields) => void patch({ car: fields })} />
        <RegistryFields car={car} canWrite={canWrite} onSave={(registry) => void patch({ car: { registry } })} />

        <nav className="iriss-ap-stages" aria-label="Posmi">
          {AUTOPARKS_STAGES.map((s, i) => {
            const n = room.files.filter((f) => f.stage === s).length + (s === "purchase" || s === "transport" ? logDocsFor(logDocs, s).length : 0);
            return (
              <button key={s} type="button" aria-current={active === s ? "step" : undefined} className={`iriss-ap-stage ${active === s ? "on" : ""} ${n > 0 ? "has" : ""}`} onClick={() => setStage(s)}>
                <span className="idx">{i + 1}</span>
                <span className="min-w-0">
                  <span className="t">{AUTOPARKS_STAGE_LV[s]}</span>
                  <span className="c">{n > 0 ? `${n} faili` : "tukšs"}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <StagePanel
          key={active}
          car={car}
          stage={active}
          files={stageFiles}
          canWrite={canWrite}
          onUploaded={(files) => {
            setRoom((r) => (r ? { ...r, files: [...files, ...r.files.filter((f) => !files.some((x) => x.id === f.id))] } : r));
            onFilesChanged();
          }}
          onFileChanged={(file) => {
            setRoom((r) => (r ? { ...r, files: file.deletedAt ? r.files.filter((f) => f.id !== file.id) : r.files.map((f) => (f.id === file.id ? file : f)) } : r));
            onFilesChanged();
          }}
          onError={setError}
        >
          {active === "purchase" || active === "transport" ? <LogisticsDocs docs={logDocsFor(logDocs, active)} /> : null}
          {active === "service" ? (
            <WorkEstimate work={room.work} hideSums={hideSums} canWrite={canWrite} onSave={(work) => void patch({ work })} />
          ) : null}
          <Notes
            stage={active}
            notes={stageNotes}
            canWrite={canWrite}
            onAdd={async (text) => patch({ note: { stage: active, text } })}
          />
        </StagePanel>

        {error ? <p className="mt-3 text-[13px] text-[#c2362b]">{error}</p> : null}

        {room.events.length > 0 ? (
          <details className="iriss-ap-history">
            <summary>Vēsture · {room.events.length}</summary>
            <ul>
              {room.events.map((e) => (
                <li key={e.id}>
                  <span className="tabular-nums text-[#6e6e73]">{fmtDateTime(e.at)}</span>
                  <span className="min-w-0 flex-1">{e.text}</span>
                  <span className="text-[#6e6e73]">{e.actorName}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}

/** Loģistikas kabineta A sadaļa = iegāde, B = transports. */
function logDocsFor(docs: LogisticsDoc[], stage: AutoparksStage): LogisticsDoc[] {
  if (stage === "purchase") return docs.filter((d) => d.section === "A");
  if (stage === "transport") return docs.filter((d) => d.section === "B");
  return [];
}

function RoomTop({ title, onClose, children }: { title: string; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="iriss-ap-room-top">
      <button type="button" className="iriss-ap-back" onClick={onClose} aria-label="Atpakaļ uz sarakstu">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h2 className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

function StatusSegment({ status, disabled, onChange }: { status: AutoparksStatus; disabled: boolean; onChange: (s: AutoparksStatus) => void }) {
  return (
    <div className="iriss-ap-status-seg" role="radiogroup" aria-label="Statuss">
      {AUTOPARKS_STATUSES.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={status === s} disabled={disabled} className={`st-${s} ${status === s ? "on" : ""}`} onClick={() => status !== s && onChange(s)}>
          <i aria-hidden />
          {AUTOPARKS_STATUS_SHORT_LV[s]}
        </button>
      ))}
    </div>
  );
}

type FieldKey = "plate" | "mileageKm" | "color" | "location" | "arrivedAt" | "purchasePriceEur" | "salePriceEur" | "make" | "model" | "year" | "vin";

export function CarFields({
  car,
  hideSums,
  canWrite,
  onSave,
}: {
  car: AutoparksCar;
  hideSums: boolean;
  canWrite: boolean;
  onSave: (fields: Partial<Record<FieldKey, string>>) => void;
}) {
  const fields: Array<{ key: FieldKey; label: string; value: string; numeric?: boolean; date?: boolean }> = [
    { key: "make", label: "Marka", value: car.make },
    { key: "model", label: "Modelis", value: car.model },
    { key: "year", label: "Gads", value: car.year, numeric: true },
    { key: "plate", label: "Numurzīme", value: car.plate },
    { key: "vin", label: "VIN", value: car.vin },
    { key: "mileageKm", label: "Nobraukums, km", value: car.mileageKm != null ? String(car.mileageKm) : "", numeric: true },
    { key: "color", label: "Krāsa", value: car.color },
    // "Atrašanās vieta" nerāda šeit kopš j62: lauks dzīvo tikai IRISS Loģistikas kabinetā (kartes punkts); dati paliek, tikai nav rediģējami no Autoparka.
    { key: "arrivedAt", label: "Atvests", value: car.arrivedAt.slice(0, 10), date: true },
  ];
  if (!hideSums) {
    fields.push(
      { key: "purchasePriceEur", label: "Iepirkuma cena, €", value: car.purchasePriceEur != null ? String(car.purchasePriceEur) : "", numeric: true },
      { key: "salePriceEur", label: "Pārdošanas cena, €", value: car.salePriceEur != null ? String(car.salePriceEur) : "", numeric: true },
    );
  }
  return (
    <div className="iriss-ap-fields">
      {fields.map((f) => (
        <label key={`${f.key}:${f.value}`} className="iriss-ap-field">
          <span>{f.label}</span>
          <input
            defaultValue={f.value}
            disabled={!canWrite}
            type={f.date ? "date" : "text"}
            inputMode={f.numeric ? "decimal" : undefined}
            placeholder="-"
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== f.value) onSave({ [f.key]: next });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
      ))}
    </div>
  );
}

type EditableField = { key: string; label: string; value: string; numeric?: boolean; date?: boolean; wide?: boolean };

/** Viens labojams lauks esošajā kartītes stilā: saglabā pie blur/Enter, ja vērtība mainījusies. */
function EditField({ f, canWrite, onSave }: { f: EditableField; canWrite: boolean; onSave: (key: string, value: string) => void }) {
  return (
    <label className="iriss-ap-field" style={f.wide ? { gridColumn: "1 / -1" } : undefined}>
      <span>{f.label}</span>
      <input
        defaultValue={f.value}
        disabled={!canWrite}
        type={f.date ? "date" : "text"}
        inputMode={f.numeric ? "decimal" : undefined}
        placeholder="-"
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next !== f.value) onSave(f.key, next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

/** Cenu lapai: nosaukums, aprīkojuma rinda, cena (Nils ievada). */
function PriceSheetFields({
  car,
  hideSums,
  canWrite,
  onSave,
}: {
  car: AutoparksCar;
  hideSums: boolean;
  canWrite: boolean;
  onSave: (fields: Record<string, string>) => void;
}) {
  const fields: EditableField[] = [
    { key: "displayName", label: "Nosaukums", value: car.displayName ?? "" },
    { key: "equipmentLine", label: "Aprīkojuma rinda", value: car.equipmentLine ?? "", wide: true },
  ];
  if (!hideSums) fields.splice(1, 0, { key: "listPriceEur", label: "Cena, €", value: car.listPriceEur != null ? String(car.listPriceEur) : "", numeric: true });
  return (
    <div className="mt-4">
      <p className="iriss-ap-sub">Cenu lapai</p>
      <div className="iriss-ap-fields">
        {fields.map((f) => (
          <EditField key={`${f.key}:${f.value}`} f={f} canWrite={canWrite} onSave={(key, value) => onSave({ [key]: value })} />
        ))}
      </div>
    </div>
  );
}

function sourceLabel(src: "manual" | "csdd" | ""): string {
  if (src === "manual") return " · labots";
  if (src === "csdd") return " · CSDD";
  return "";
}

/** CSDD tirdzniecības reģistra lauki. Visi labojami; labotos imports vairs nepārraksta (tukšs = atkal no CSDD). */
function RegistryFields({ car, canWrite, onSave }: { car: AutoparksCar; canWrite: boolean; onSave: (registry: Record<string, string>) => void }) {
  const reg = car.registry;
  const textKeys = REGISTRY_TEXT_KEYS.filter((k) => k !== "status");
  const fields: EditableField[] = [
    ...textKeys.map((k) => ({ key: k, label: REGISTRY_FIELD_LV[k], value: reg?.[k] ?? "", date: k === "firstRegDate" || k === "tradeActDate" })),
    ...REGISTRY_NUMBER_KEYS.map((k) => ({ key: k, label: REGISTRY_FIELD_LV[k], value: reg?.[k] != null ? String(reg[k]) : "", numeric: true })),
    { key: "status", label: REGISTRY_FIELD_LV.status, value: reg?.status ?? "" },
  ];
  const imported = reg?.importedAt ? `importēts ${fmtDate(reg.importedAt)}` : "nav importēts";
  return (
    <details className="iriss-ap-history">
      <summary>CSDD reģistrs · {imported}</summary>
      <div className="iriss-ap-fields">
        {fields.map((f) => (
          <EditField
            key={`${f.key}:${f.value}`}
            f={{ ...f, label: f.label + sourceLabel(registryFieldSource(reg, f.key as RegistryKey)) }}
            canWrite={canWrite}
            onSave={(key, value) => onSave({ [key]: value })}
          />
        ))}
        {REGISTRY_SAFETY_KEYS.map((k) => (
          <label key={`${k}:${reg?.[k] ?? ""}`} className="iriss-ap-field">
            <span>
              {REGISTRY_FIELD_LV[k]}
              {sourceLabel(registryFieldSource(reg, k))}
            </span>
            <select
              defaultValue={reg?.[k] ?? ""}
              disabled={!canWrite}
              onChange={(e) => onSave({ [k]: e.target.value })}
            >
              {REGISTRY_SAFETY_STATES.map((st) => (
                <option key={st} value={st}>
                  {REGISTRY_SAFETY_LV[st]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {reg?.importFile ? (
        <p className="mt-2 text-[12px] text-[#6e6e73]">
          Avots: {reg.importFile}
          {reg.registryDate ? ` · nolasīts ${fmtDate(reg.registryDate)}` : ""}
        </p>
      ) : null}
    </details>
  );
}

function StagePanel({
  car,
  stage,
  files,
  canWrite,
  onUploaded,
  onFileChanged,
  onError,
  children,
}: {
  car: AutoparksCar;
  stage: AutoparksStage;
  files: AutoparksFile[];
  canWrite: boolean;
  onUploaded: (files: AutoparksFile[]) => void;
  onFileChanged: (file: AutoparksFile) => void;
  onError: (msg: string) => void;
  children: ReactNode;
}) {
  const scanRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<AutoparksFileKind>(stage === "sale" ? "contract" : "invoice");
  const [busy, setBusy] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pendingScan, setPendingScan] = useState<File[]>([]);

  async function upload(list: File[], scan: boolean) {
    if (list.length === 0) return;
    setBusy(scan ? "Veido PDF…" : "Augšupielādē…");
    const form = new FormData();
    form.set("stage", stage);
    form.set("kind", kind);
    if (scan) form.set("scan", "1");
    for (const f of list) form.append("file", scan ? await compressImage(f) : f);
    const res = await fetch(`${API}/${encodeURIComponent(car.id)}/files`, { method: "POST", credentials: "include", body: form }).catch(() => null);
    setBusy("");
    if (!res?.ok) {
      onError(res?.status === 413 ? "Fails ir par lielu (līdz 4 MB). Telefonā bildi uzņem vēlreiz." : "Neizdevās augšupielādēt.");
      return;
    }
    const body = (await res.json()) as { files?: AutoparksFile[]; duplicates?: number };
    onError(body.duplicates ? "Šis fails jau ir istabā." : "");
    onUploaded(body.files ?? []);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (!canWrite) return;
    void upload(Array.from(e.dataTransfer.files), false);
  }

  return (
    <div
      className={`iriss-ap-panel ${dragOver ? "drag" : ""}`}
      onDragOver={(e) => {
        if (!canWrite || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[16px] font-semibold">{AUTOPARKS_STAGE_LV[stage]}</p>
          <p className="text-[12.5px] text-[#6e6e73]">{AUTOPARKS_STAGE_HINT_LV[stage]}</p>
        </div>
        {files.some((f) => f.contentType.includes("pdf")) ? (
          <a className="iriss-ap-link" href={`${API}/${encodeURIComponent(car.id)}/bundle?stage=${stage}`}>
            Lejupielādēt posmu vienā PDF
          </a>
        ) : null}
      </div>

      {canWrite ? (
        <div className="iriss-ap-upload">
          <div className="iriss-ap-kind" role="radiogroup" aria-label="Faila veids">
            {AUTOPARKS_FILE_KINDS.filter((k) => k !== "photo").map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
                {AUTOPARKS_FILE_KIND_LV[k]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="iriss-ap-btn-dark iriss-ap-scan" disabled={Boolean(busy)} onClick={() => scanRef.current?.click()}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                <path d="M7 12h10" />
              </svg>
              {pendingScan.length > 0 ? "Vēl lapa" : "Skenēt ar kameru"}
            </button>
            <button type="button" className="iriss-ap-btn-sec" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
              Pievienot failu
            </button>
          </div>
          <input
            ref={scanRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (picked.length) setPendingScan((prev) => [...prev, ...picked]);
            }}
          />
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              void upload(picked, false);
            }}
          />
          {pendingScan.length > 0 ? (
            <div className="iriss-ap-scan-tray">
              <span className="min-w-0 flex-1 text-[13px]">
                {pendingScan.length} {pendingScan.length === 1 ? "lapa" : "lapas"} gatavas. Pievieno vēl vai saglabā kā vienu PDF.
              </span>
              <button type="button" className="iriss-ap-btn-sec" onClick={() => setPendingScan([])}>
                Atcelt
              </button>
              <button
                type="button"
                className="iriss-ap-btn-dark"
                disabled={Boolean(busy)}
                onClick={() => {
                  const list = pendingScan;
                  setPendingScan([]);
                  void upload(list, true);
                }}
              >
                Saglabāt PDF
              </button>
            </div>
          ) : null}
          <p className="iriss-ap-drop-hint">{busy || "Datorā vari arī ievilkt failus šeit"}</p>
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="iriss-ap-files">
          {files.map((f) => (
            <FileCard key={f.id} file={f} canWrite={canWrite} onChanged={onFileChanged} onError={onError} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-[#8e8e93]">Šajā posmā vēl nav failu.</p>
      )}

      {children}
    </div>
  );
}

function FileCard({
  file,
  canWrite,
  onChanged,
  onError,
}: {
  file: AutoparksFile;
  canWrite: boolean;
  onChanged: (file: AutoparksFile) => void;
  onError: (msg: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const href = `${API}/files/${encodeURIComponent(file.id)}`;
  const pdf = file.contentType.includes("pdf");
  const image = file.contentType.startsWith("image/");

  async function patchFile(body: Record<string, unknown>) {
    const res = await fetch(href, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res?.ok) return onError("Neizdevās saglabāt failu.");
    const out = (await res.json()) as { file?: AutoparksFile };
    if (out.file) onChanged(out.file);
  }

  async function remove() {
    if (!window.confirm(`Izņemt "${file.title}" no istabas?`)) return;
    const res = await fetch(href, { method: "DELETE", credentials: "include" }).catch(() => null);
    if (!res?.ok) return onError("Neizdevās izņemt failu.");
    const out = (await res.json()) as { file?: AutoparksFile };
    if (out.file) onChanged(out.file);
  }

  return (
    <li className="iriss-ap-file">
      <a href={href} target="_blank" rel="noreferrer" className={`iriss-ap-file-icon ${pdf ? "pdf" : image ? "img" : ""}`} aria-label={`Atvērt ${file.title}`}>
        {pdf ? "PDF" : image ? "FOTO" : "DOC"}
      </a>
      <div className="min-w-0 flex-1">
        <a href={href} target="_blank" rel="noreferrer" className="block truncate text-[13.5px] font-semibold leading-tight hover:underline">
          {file.title}
        </a>
        <p className="mt-0.5 truncate text-[11.5px] text-[#6e6e73]">
          {AUTOPARKS_FILE_KIND_LV[file.kind]}
          {file.scanned ? " · skenēts" : ""} · {fmtDateTime(file.createdAt)} · {formatAutoparksBytes(file.size)}
          {file.uploadedByName ? ` · ${file.uploadedByName}` : ""}
        </p>
      </div>
      <a href={`${href}?dl=1`} className="iriss-ap-icon-btn" aria-label="Lejupielādēt" title="Lejupielādēt">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
      </a>
      {canWrite ? (
        <span className="relative">
          <button type="button" className="iriss-ap-icon-btn" aria-label="Vairāk" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            ⋯
          </button>
          {menu ? (
            <div className="iriss-ap-menu" onMouseLeave={() => setMenu(false)}>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  const title = window.prompt("Faila nosaukums", file.title);
                  if (title && title.trim() !== file.title) void patchFile({ title });
                }}
              >
                Pārdēvēt
              </button>
              <p className="px-2.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Pārvietot uz</p>
              {AUTOPARKS_STAGES.filter((s) => s !== file.stage).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    void patchFile({ stage: s });
                  }}
                >
                  {AUTOPARKS_STAGE_LV[s]}
                </button>
              ))}
              <button type="button" className="text-[#c2362b]" onClick={() => { setMenu(false); void remove(); }}>
                Izņemt
              </button>
            </div>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

function LogisticsDocs({ docs }: { docs: LogisticsDoc[] }) {
  if (docs.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="iriss-ap-sub">No Loģistikas kabineta</p>
      <ul className="iriss-ap-files">
        {docs.map((d) => {
          const href = d.hasFile ? `/api/admin/iriss-logistics/documents/${encodeURIComponent(d.id)}` : d.sourceUrl;
          return (
            <li key={d.id} className="iriss-ap-file muted">
              <span className="iriss-ap-file-icon">LOG</span>
              <div className="min-w-0 flex-1">
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="block truncate text-[13.5px] font-semibold hover:underline">
                    {d.title}
                  </a>
                ) : (
                  <span className="block truncate text-[13.5px] font-semibold">{d.title}</span>
                )}
                <p className="mt-0.5 truncate text-[11.5px] text-[#6e6e73]">
                  {d.typeLabel} · {fmtDateTime(d.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type WorkDraft = Pick<AutoparksWorkItem, "id" | "title" | "qty" | "priceEur" | "done">;

function WorkEstimate({
  work,
  hideSums,
  canWrite,
  onSave,
}: {
  work: AutoparksWorkItem[];
  hideSums: boolean;
  canWrite: boolean;
  onSave: (rows: WorkDraft[]) => void;
}) {
  const [rows, setRows] = useState<WorkDraft[]>(work);
  const [draft, setDraft] = useState("");
  useEffect(() => setRows(work), [work]);
  const total = autoparksWorkTotal(rows);
  const done = rows.filter((r) => r.done).length;

  function commit(next: WorkDraft[]) {
    setRows(next);
    onSave(next);
  }

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="iriss-ap-sub">Tāme un veiktie darbi</p>
        <p className="text-[12.5px] text-[#6e6e73]">
          {done}/{rows.length} izdarīti{!hideSums && total > 0 ? ` · ${formatAutoparksEur(total)}` : ""}
        </p>
      </div>
      <ul className="iriss-ap-work">
        {rows.map((r, i) => (
          <li key={r.id || i} className={r.done ? "done" : ""}>
            <input
              type="checkbox"
              className="iriss-ap-check"
              checked={r.done}
              disabled={!canWrite}
              aria-label="Izdarīts"
              onChange={() => commit(rows.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            />
            <input
              className="iriss-ap-work-title"
              defaultValue={r.title}
              disabled={!canWrite}
              onBlur={(e) => {
                const title = e.target.value.trim();
                if (!title) commit(rows.filter((_, j) => j !== i));
                else if (title !== r.title) commit(rows.map((x, j) => (j === i ? { ...x, title } : x)));
              }}
            />
            {hideSums ? null : (
              <input
                className="iriss-ap-work-price"
                defaultValue={r.priceEur != null ? String(r.priceEur).replace(".", ",") : ""}
                placeholder="€"
                inputMode="decimal"
                disabled={!canWrite}
                aria-label="Cena"
                onBlur={(e) => {
                  const raw = e.target.value.trim().replace(/\s/g, "").replace(",", ".");
                  const price = raw ? Number(raw) : null;
                  if (price !== null && !Number.isFinite(price)) return;
                  if (price !== r.priceEur) commit(rows.map((x, j) => (j === i ? { ...x, priceEur: price } : x)));
                }}
              />
            )}
          </li>
        ))}
      </ul>
      {canWrite ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = draft.trim();
            if (!title) return;
            setDraft("");
            commit([...rows, { id: "", title, qty: 1, priceEur: null, done: false }]);
          }}
        >
          <input className="iriss-ap-input flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Jauns darbs, piem. eļļas maiņa" />
          <button type="submit" className="iriss-ap-btn-sec" disabled={!draft.trim()}>
            Pievienot
          </button>
        </form>
      ) : null}
      <p className="mt-1.5 text-[11.5px] text-[#8e8e93]">Nākotnē: nobildē servisa tāmi un darbi ielasīsies paši.</p>
    </div>
  );
}

function Notes({
  stage,
  notes,
  canWrite,
  onAdd,
}: {
  stage: AutoparksStage;
  notes: Room["notes"];
  canWrite: boolean;
  onAdd: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4">
      <p className="iriss-ap-sub">Piezīmes · {AUTOPARKS_STAGE_LV[stage]}</p>
      {canWrite ? (
        <form
          className="mt-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            setBusy(true);
            const ok = await onAdd(text);
            setBusy(false);
            if (ok) setText("");
          }}
        >
          <textarea className="iriss-ap-input min-h-[72px] w-full" value={text} onChange={(e) => setText(e.target.value)} placeholder="Piezīme servisam vai sev" />
          <div className="mt-1.5 flex justify-end">
            <button type="submit" className="iriss-ap-btn-sec" disabled={busy || !text.trim()}>
              Pievienot piezīmi
            </button>
          </div>
        </form>
      ) : null}
      {notes.length > 0 ? (
        <ul className="iriss-ap-notes">
          {notes.map((n) => (
            <li key={n.id}>
              <p className="whitespace-pre-wrap text-[13.5px] leading-snug">{n.text}</p>
              <p className="mt-1 text-[11.5px] text-[#6e6e73]">
                {n.authorName || "-"} · {fmtDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
