"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLLAPSED = 12;

/** Tīra loģika (testiem): pārvietot `from` uz `to` vietu. */
export function movePhotoList<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  return arrayMove([...list], from, to);
}

/**
 * Nils 21.11: katrai bildei stabils id (atslēga; dublikātam «#2»). Visas darbības (noņemt, pārvietot, atzīmēt)
 * strādā pēc id, nevis pēc pozīcijas - pēc pārkārtošanas/noņemšanas netiek skarta «kaimiņa» bilde.
 */
export function photoIds<T>(list: readonly T[], keyOf: (p: T) => string): string[] {
  const seen = new Map<string, number>();
  return list.map((p) => {
    const k = keyOf(p);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? k : `${k}#${n}`;
  });
}

/** Noņem bildes ar dotajiem id. */
export function removePhotosById<T>(list: readonly T[], ids: ReadonlySet<string>, keyOf: (p: T) => string): T[] {
  const all = photoIds(list, keyOf);
  return list.filter((_, i) => !ids.has(all[i]!));
}

/** Pārvieto bildi `activeId` uz `overId` vietu (vilkšanas beigas). */
export function movePhotoById<T>(list: readonly T[], activeId: string, overId: string, keyOf: (p: T) => string): T[] {
  const all = photoIds(list, keyOf);
  return movePhotoList(list, all.indexOf(activeId), all.indexOf(overId));
}

/** Atzīmētās uz sākumu (to savstarpējā secība saglabājas). */
export function photosToFront<T>(list: readonly T[], picked: ReadonlySet<string>, keyOf: (p: T) => string): T[] {
  const all = photoIds(list, keyOf);
  return [...list.filter((_, i) => picked.has(all[i]!)), ...list.filter((_, i) => !picked.has(all[i]!))];
}

/** Lai pogas uz bildes nesāk vilkšanu. */
const stop = (e: SyntheticEvent) => e.stopPropagation();

function Tile<T>({
  id,
  photo,
  index,
  editable,
  selectMode,
  picked,
  broken,
  confirming,
  urlOf,
  onOpen,
  onTogglePick,
  onAskRemove,
  onConfirmRemove,
  onCancelRemove,
  onBroken,
}: {
  id: string;
  photo: T;
  index: number;
  editable: boolean;
  selectMode: boolean;
  picked: boolean;
  broken: boolean;
  confirming: boolean;
  urlOf: (p: T, size?: "thumb" | "full") => string;
  onOpen: (id: string) => void;
  onTogglePick: (id: string) => void;
  onAskRemove: (id: string) => void;
  onConfirmRemove: (id: string) => void;
  onCancelRemove: () => void;
  onBroken: () => void;
}) {
  const dragOn = editable && !selectMode && !confirming;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !dragOn });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`pd-ps-it${picked ? " sel" : ""}${isDragging ? " ghost" : ""}${dragOn ? " drag" : ""}`}
      {...attributes}
      {...(dragOn ? listeners : {})}
      role="listitem"
      aria-roledescription={dragOn ? "pārvietojama bilde" : undefined}
      aria-label={`Foto ${index + 1}${index === 0 ? " (vāks)" : ""}`}
      tabIndex={dragOn ? 0 : -1}
    >
      <button
        type="button"
        className="pd-ps-img"
        aria-label={selectMode ? `Foto ${index + 1}: atzīmēt` : `Foto ${index + 1}: atvērt`}
        onClick={() => (selectMode ? onTogglePick(id) : onOpen(id))}
      >
        {broken ? (
          <span className="pd-ps-broken">Bilde nav pieejama</span>
        ) : (
          <img src={urlOf(photo)} alt={`Foto ${index + 1}`} loading="lazy" draggable={false} onError={onBroken} />
        )}
      </button>
      {index === 0 ? <span className="pd-ps-cover">VĀKS</span> : <span className="pd-ps-n">{index + 1}</span>}
      {selectMode ? <span className={`pd-ps-ck${picked ? " on" : ""}`} aria-hidden /> : null}
      {editable && !selectMode && !confirming ? (
        <button
          type="button"
          className="pd-ps-x"
          aria-label={`Foto ${index + 1}: noņemt`}
          onMouseDown={stop}
          onTouchStart={stop}
          onKeyDown={stop}
          onClick={() => onAskRemove(id)}
        >
          ×
        </button>
      ) : null}
      {confirming ? (
        <div className="pd-ps-ask" role="alertdialog" aria-label={`Noņemt foto ${index + 1}?`} onMouseDown={stop} onTouchStart={stop} onKeyDown={stop}>
          <b>Noņemt?</b>
          <span>
            <button type="button" className="pd-btn bad s" onClick={() => onConfirmRemove(id)}>
              Noņemt
            </button>
            <button type="button" className="pd-btn s" onClick={onCancelRemove}>
              Atcelt
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Piedāvājuma bilžu kārtotājs (Nils 28.10; 21.11 - moderna vilkšana):
 * režģis ar numuriem, vilkšana (@dnd-kit: pele, pirksts ar īsu nospiešanu, tastatūra), «×» ar apstiprinājumu uz bildes,
 * «Atzīmēt vairākas» ātrai noņemšanai, klikšķis - liels skats ar ← →. Visas darbības pēc stabila id.
 */
export function PdPhotoSorter<T>({
  photos,
  editable,
  urlOf,
  keyOf,
  onChange,
}: {
  photos: T[];
  editable: boolean;
  urlOf: (p: T, size?: "thumb" | "full") => string;
  keyOf: (p: T) => string;
  onChange: (next: T[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [askId, setAskId] = useState<string | null>(null);
  const [askMany, setAskMany] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // QA 29.10: bilde, kas neielādējas (piem. izdzēsta Dropbox), - redzama kā «Bilde nav pieejama», lai to var noņemt.
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const markBroken = (k: string) => setBroken((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
  const draggedAt = useRef(0);

  const sensors = useSensors(
    // Pele: vilkšana pēc 6 px (klikšķis joprojām atver lielo skatu).
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Telefons: īsa nospiešana (200 ms), citādi pirksts ritina lapu.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const n = photos.length;
  const ids = photoIds(photos, keyOf);
  const idsSig = ids.join("\n");
  const shownCount = expanded || selectMode ? n : Math.min(n, COLLAPSED);
  const shownIds = ids.slice(0, shownCount);
  const viewIndex = viewId == null ? -1 : ids.indexOf(viewId);

  // Atzīmes / jautājums tikai esošām bildēm (pēc saglabāšanas saraksts var mainīties).
  useEffect(() => {
    const live = new Set(idsSig.split("\n"));
    setPicked((prev) => {
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
    setAskId((a) => (a && !live.has(a) ? null : a));
    setViewId((v) => (v && !live.has(v) ? null : v));
  }, [idsSig]);

  useEffect(() => {
    if (viewIndex < 0) return;
    const list = idsSig.split("\n");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewId(null);
      if (e.key === "ArrowRight") setViewId(list[Math.min(list.length - 1, viewIndex + 1)] ?? null);
      if (e.key === "ArrowLeft") setViewId(list[Math.max(0, viewIndex - 1)] ?? null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewIndex, idsSig]);

  if (!n) return null;

  const remove = (gone: ReadonlySet<string>) => {
    if (!gone.size) return;
    onChange(removePhotosById(photos, gone, keyOf));
    setPicked(new Set());
    setAskId(null);
    setAskMany(false);
  };
  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setAskId(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    draggedAt.current = Date.now();
    if (!e.over || e.active.id === e.over.id) return;
    onChange(movePhotoById(photos, String(e.active.id), String(e.over.id), keyOf));
  };
  const activeIndex = activeId == null ? -1 : ids.indexOf(activeId);
  const activePhoto = activeIndex >= 0 ? photos[activeIndex] : undefined;
  const viewPhoto = viewIndex >= 0 ? photos[viewIndex] : undefined;

  return (
    <div className="pd-ps">
      {editable ? (
        <div className="pd-ps-top">
          {selectMode ? (
            <button type="button" className="pd-btn" onClick={() => (setSelectMode(false), setPicked(new Set()), setAskMany(false))}>
              Gatavs
            </button>
          ) : (
            <button type="button" className="pd-btn" onClick={() => (setSelectMode(true), setAskId(null))}>
              Atzīmēt vairākas
            </button>
          )}
          {n > COLLAPSED && !selectMode ? (
            <button type="button" className="pd-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Saīsināt" : `Rādīt visas (${n})`}
            </button>
          ) : null}
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={shownIds} strategy={rectSortingStrategy}>
          <div className="pd-ps-grid" role="list">
            {shownIds.map((id, i) => (
              <Tile
                key={id}
                id={id}
                photo={photos[i]!}
                index={i}
                editable={editable}
                selectMode={selectMode}
                picked={picked.has(id)}
                broken={broken.has(keyOf(photos[i]!))}
                confirming={askId === id}
                urlOf={urlOf}
                onOpen={(x) => {
                  // Klikšķis tūlīt pēc vilkšanas neatver lielo skatu.
                  if (Date.now() - draggedAt.current < 250) return;
                  setViewId(x);
                }}
                onTogglePick={(x) =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(x)) next.delete(x);
                    else next.add(x);
                    return next;
                  })
                }
                onAskRemove={setAskId}
                onConfirmRemove={(x) => remove(new Set([x]))}
                onCancelRemove={() => setAskId(null)}
                onBroken={() => markBroken(keyOf(photos[i]!))}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {activePhoto ? (
            <div className="pd-ps-it pd-ps-lift">
              <span className="pd-ps-img">
                {broken.has(keyOf(activePhoto)) ? (
                  <span className="pd-ps-broken">Bilde nav pieejama</span>
                ) : (
                  <img src={urlOf(activePhoto)} alt="" draggable={false} />
                )}
              </span>
              {activeIndex === 0 ? <span className="pd-ps-cover">VĀKS</span> : <span className="pd-ps-n">{activeIndex + 1}</span>}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectMode ? (
        askMany ? (
          <div className="pd-ps-bar" role="alertdialog" aria-label="Apstiprināt noņemšanu">
            <b>Noņemt {picked.size} foto?</b>
            <button type="button" className="pd-btn bad" onClick={() => remove(picked)}>
              Noņemt
            </button>
            <button type="button" className="pd-btn" onClick={() => setAskMany(false)}>
              Atcelt
            </button>
          </div>
        ) : (
          <div className="pd-ps-bar">
            <b>{picked.size} atzīmētas</b>
            <button type="button" className="pd-btn bad" disabled={!picked.size} onClick={() => setAskMany(true)}>
              Noņemt
            </button>
            <button
              type="button"
              className="pd-btn"
              disabled={!picked.size}
              onClick={() => {
                onChange(photosToFront(photos, picked, keyOf));
                setPicked(new Set());
              }}
            >
              Uz sākumu
            </button>
            <button type="button" className="pd-btn" style={{ marginLeft: "auto" }} onClick={() => setPicked(new Set())}>
              Atcelt
            </button>
          </div>
        )
      ) : null}

      {viewPhoto && viewId ? (
        <div className="pd-ps-lb" role="dialog" aria-label={`Foto ${viewIndex + 1} no ${n}`} onClick={() => setViewId(null)}>
          <div className="pd-ps-lbin" onClick={(e) => e.stopPropagation()}>
            <img src={urlOf(viewPhoto, "full")} alt={`Foto ${viewIndex + 1}`} />
            <span className="pd-ps-n big">
              {viewIndex + 1} / {n}
            </span>
            {viewIndex > 0 ? (
              <button type="button" className="nav l" aria-label="Iepriekšējā" onClick={() => setViewId(ids[viewIndex - 1] ?? null)}>
                ‹
              </button>
            ) : null}
            {viewIndex < n - 1 ? (
              <button type="button" className="nav r" aria-label="Nākamā" onClick={() => setViewId(ids[viewIndex + 1] ?? null)}>
                ›
              </button>
            ) : null}
            <div className="pd-ps-lbacts">
              {editable && askId === viewId ? (
                <>
                  <b>Noņemt šo foto?</b>
                  <button
                    type="button"
                    className="pd-btn bad"
                    onClick={() => {
                      const next = ids[viewIndex + 1] ?? ids[viewIndex - 1] ?? null;
                      remove(new Set([viewId]));
                      setViewId(next);
                    }}
                  >
                    Noņemt
                  </button>
                  <button type="button" className="pd-btn" onClick={() => setAskId(null)}>
                    Atcelt
                  </button>
                </>
              ) : (
                <>
                  {editable && viewIndex > 0 ? (
                    <button type="button" className="pd-btn" onClick={() => onChange(movePhotoById(photos, viewId, ids[0]!, keyOf))}>
                      ★ Padarīt par vāku
                    </button>
                  ) : null}
                  {editable ? (
                    <button type="button" className="pd-btn bad" onClick={() => setAskId(viewId)}>
                      Noņemt
                    </button>
                  ) : null}
                  <span className="pd-mu" style={{ marginLeft: "auto" }}>
                    ← → pārslēgt · Esc aizvērt
                  </span>
                  <button type="button" className="pd-btn" onClick={() => setViewId(null)}>
                    Aizvērt
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
