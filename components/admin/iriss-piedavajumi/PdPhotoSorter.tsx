"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

const COLLAPSED = 12;

/** Tīra loģika (testiem): pārvietot `from` uz `to` vietu. */
export function movePhotoList<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it!);
  return next;
}

/** Atzīmētās uz sākumu (to savstarpējā secība saglabājas). */
export function photosToFront<T>(list: readonly T[], picked: ReadonlySet<number>): T[] {
  return [...list.filter((_, i) => picked.has(i)), ...list.filter((_, i) => !picked.has(i))];
}

/**
 * Piedāvājuma bilžu kārtotājs (Nils 28.10, makets PdFoto variants A + ātrā noņemšana):
 * visas bildes režģī ar numuriem, velkot vai ar pogām (★ vāks, ‹ ›, ×), «Atzīmēt vairākas» ātrai noņemšanai,
 * «Atsaukt» pēdējai noņemšanai, klikšķis - liels skats ar ← →.
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
  urlOf: (p: T) => string;
  keyOf: (p: T) => string;
  onChange: (next: T[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [undo, setUndo] = useState<{ list: T[]; count: number } | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  const n = photos.length;
  const shown = expanded || selectMode ? photos : photos.slice(0, COLLAPSED);

  const remove = (idx: ReadonlySet<number>) => {
    if (!idx.size) return;
    setUndo({ list: photos, count: idx.size });
    onChange(photos.filter((_, i) => !idx.has(i)));
    setPicked(new Set());
  };
  const move = (from: number, to: number) => onChange(movePhotoList(photos, from, to));

  useEffect(() => {
    if (view == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setView(null);
      if (e.key === "ArrowRight") setView((v) => (v == null ? v : Math.min(n - 1, v + 1)));
      if (e.key === "ArrowLeft") setView((v) => (v == null ? v : Math.max(0, v - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, n]);

  if (!n) return null;

  return (
    <div className="pd-ps">
      {editable ? (
        <div className="pd-ps-top">
          {selectMode ? (
            <button type="button" className="pd-btn" onClick={() => (setSelectMode(false), setPicked(new Set()))}>
              Gatavs
            </button>
          ) : (
            <button type="button" className="pd-btn" onClick={() => setSelectMode(true)}>
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

      <div className="pd-ps-grid">
        {shown.map((p, i) => {
          const on = picked.has(i);
          return (
            <div
              key={keyOf(p)}
              className={`pd-ps-it${on ? " sel" : ""}${over === i ? " over" : ""}`}
              draggable={editable && !selectMode}
              onDragStart={() => {
                dragFrom.current = i;
              }}
              onDragOver={(e) => {
                if (dragFrom.current == null) return;
                e.preventDefault();
                setOver(i);
              }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDragEnd={() => {
                dragFrom.current = null;
                setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom.current != null) move(dragFrom.current, i);
                dragFrom.current = null;
                setOver(null);
              }}
            >
              <button
                type="button"
                className="pd-ps-img"
                aria-label={selectMode ? `Foto ${i + 1}: atzīmēt` : `Foto ${i + 1}: atvērt`}
                onClick={() => {
                  if (!selectMode) return setView(i);
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  });
                }}
              >
                <img src={urlOf(p)} alt={`Foto ${i + 1}`} loading="lazy" draggable={false} />
              </button>
              {i === 0 ? <span className="pd-ps-cover">VĀKS</span> : <span className="pd-ps-n">{i + 1}</span>}
              {selectMode ? <span className={`pd-ps-ck${on ? " on" : ""}`} aria-hidden /> : null}
              {editable && !selectMode ? (
                <span className="pd-ps-acts">
                  {i > 0 ? (
                    <button type="button" title="Padarīt par vāku" aria-label={`Foto ${i + 1}: vāks`} onClick={() => move(i, 0)}>
                      ★
                    </button>
                  ) : null}
                  {i > 0 ? (
                    <button type="button" aria-label={`Foto ${i + 1}: pa kreisi`} onClick={() => move(i, i - 1)}>
                      ‹
                    </button>
                  ) : null}
                  {i < n - 1 ? (
                    <button type="button" aria-label={`Foto ${i + 1}: pa labi`} onClick={() => move(i, i + 1)}>
                      ›
                    </button>
                  ) : null}
                  <button type="button" className="x" aria-label={`Foto ${i + 1}: noņemt`} onClick={() => remove(new Set([i]))}>
                    ×
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {selectMode ? (
        <div className="pd-ps-bar">
          <b>{picked.size} atzīmētas</b>
          <button type="button" className="pd-btn bad" disabled={!picked.size} onClick={() => remove(picked)}>
            Noņemt
          </button>
          <button
            type="button"
            className="pd-btn"
            disabled={!picked.size}
            onClick={() => {
              onChange(photosToFront(photos, picked));
              setPicked(new Set());
            }}
          >
            Uz sākumu
          </button>
          <button type="button" className="pd-btn" style={{ marginLeft: "auto" }} onClick={() => setPicked(new Set())}>
            Atcelt
          </button>
        </div>
      ) : null}
      {undo ? (
        <div className="pd-ps-bar">
          <span>Noņemtas {undo.count}</span>
          <button
            type="button"
            className="pd-btn"
            onClick={() => {
              onChange(undo.list);
              setUndo(null);
            }}
          >
            Atsaukt
          </button>
          <span className="pd-mu" style={{ marginLeft: "auto" }}>
            Nesaglabātas izmaiņas - spied «Saglabāt»
          </span>
        </div>
      ) : null}

      {view != null && photos[view] ? (
        <div className="pd-ps-lb" role="dialog" aria-label={`Foto ${view + 1} no ${n}`} onClick={() => setView(null)}>
          <div className="pd-ps-lbin" onClick={(e) => e.stopPropagation()}>
            <img src={urlOf(photos[view]!)} alt={`Foto ${view + 1}`} />
            <span className="pd-ps-n big">
              {view + 1} / {n}
            </span>
            {view > 0 ? (
              <button type="button" className="nav l" aria-label="Iepriekšējā" onClick={() => setView(view - 1)}>
                ‹
              </button>
            ) : null}
            {view < n - 1 ? (
              <button type="button" className="nav r" aria-label="Nākamā" onClick={() => setView(view + 1)}>
                ›
              </button>
            ) : null}
            <div className="pd-ps-lbacts">
              {editable && view > 0 ? (
                <button
                  type="button"
                  className="pd-btn"
                  onClick={() => {
                    move(view, 0);
                    setView(0);
                  }}
                >
                  ★ Padarīt par vāku
                </button>
              ) : null}
              {editable ? (
                <button
                  type="button"
                  className="pd-btn bad"
                  onClick={() => {
                    remove(new Set([view]));
                    setView(view >= n - 1 ? (n > 1 ? n - 2 : null) : view);
                  }}
                >
                  Noņemt
                </button>
              ) : null}
              <span className="pd-mu" style={{ marginLeft: "auto" }}>
                ← → pārslēgt · Esc aizvērt
              </span>
              <button type="button" className="pd-btn" onClick={() => setView(null)}>
                Aizvērt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
