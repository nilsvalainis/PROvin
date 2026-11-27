"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEALER_EXTRA_ACCEPT,
  DEALER_EXTRA_MAX_FILES,
  dealerExtraFileMime,
  dealerExtraFilesError,
  formatFileSize,
  heicToJpegName,
  isHeicMime,
} from "@/lib/dealer-send-extra-files";

export type DealerExtraItem = { id: string; file: File; previewUrl: string | null };

let seq = 0;
const nextId = () => `x${Date.now().toString(36)}${(seq++).toString(36)}`;

/** HEIC -> JPEG, ja pārlūks to prot atkodēt (Safari); citādi `null` (fails paliek kā ir). */
async function heicToJpeg(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob || blob.size === 0) return null;
    return new File([blob], heicToJpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function toItem(file: File): Promise<DealerExtraItem | null> {
  const mime = dealerExtraFileMime(file.name, file.type);
  if (!mime) return null;
  let f = file;
  if (isHeicMime(mime)) f = (await heicToJpeg(file)) ?? file;
  const isImage = (dealerExtraFileMime(f.name, f.type) ?? "").startsWith("image/");
  return { id: nextId(), file: f, previewUrl: isImage ? URL.createObjectURL(f) : null };
}

function Thumb({ item }: { item: DealerExtraItem }) {
  const [broken, setBroken] = useState(false);
  if (item.previewUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.previewUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded border border-slate-200 object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  const pdf = dealerExtraFileMime(item.file.name, item.file.type) === "application/pdf";
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50">
      <span className={`rounded px-1 py-px text-[9px] font-bold text-white ${pdf ? "bg-rose-600" : "bg-slate-500"}`}>
        {pdf ? "PDF" : "IMG"}
      </span>
    </span>
  );
}

/** «Pievienot failus» dīlera «Sūtīt klientam» logā (poga + vilkt-nomest, arī iPhone Safari). */
export function AdminDealerSendExtraFiles({
  items,
  onChange,
  disabled,
}: {
  items: DealerExtraItem[];
  onChange: (next: DealerExtraItem[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Atbrīvo sīktēlu URL, kad logs aizveras.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const it of itemsRef.current) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    },
    [],
  );

  const add = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setAdding(true);
    setNote(null);
    try {
      const bad = files.filter((f) => !dealerExtraFileMime(f.name, f.type));
      const room = Math.max(0, DEALER_EXTRA_MAX_FILES - items.length);
      const good = files.filter((f) => dealerExtraFileMime(f.name, f.type)).slice(0, room);
      const added = (await Promise.all(good.map(toItem))).filter((x): x is DealerExtraItem => x !== null);
      const msgs: string[] = [];
      if (bad.length > 0) msgs.push(`Neatbalstīts: ${bad.map((f) => f.name).join(", ")}. Atļauti PDF, JPG, PNG, HEIC, WEBP.`);
      if (files.length - bad.length > room) msgs.push(`Var pievienot līdz ${DEALER_EXTRA_MAX_FILES} failiem.`);
      setNote(msgs.length > 0 ? msgs.join(" ") : null);
      if (added.length > 0) onChange([...items, ...added]);
    } finally {
      setAdding(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
    onChange(items.filter((x) => x.id !== id));
    setNote(null);
  };

  const sizeErr = dealerExtraFilesError(items.map((x) => x.file));
  const total = items.reduce((s, x) => s + x.file.size, 0);
  const off = disabled || adding;

  return (
    <div
      data-dealer-send-extra-files
      className={`amx-card rounded-lg border px-3 py-2 max-md:px-3.5 ${drag ? "border-slate-500 bg-slate-50" : "border-slate-200"}`}
      onDragOver={(e) => {
        if (off) return;
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!off) void add(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="amx-tx text-[11.5px] text-slate-700 max-md:text-[14px]">
          Faili{items.length > 0 ? ` · ${items.length} · ${formatFileSize(total)}` : ""}
        </span>
        <button
          type="button"
          className="amx-btn amx-btn--sm min-h-9 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={off || items.length >= DEALER_EXTRA_MAX_FILES}
          onClick={() => inputRef.current?.click()}
        >
          {adding ? "Pievieno…" : "Pievienot failus"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DEALER_EXTRA_ACCEPT}
          className="hidden"
          onChange={(e) => void add(e.target.files)}
        />
      </div>

      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2">
              <Thumb item={it} />
              <span className="min-w-0 flex-1">
                <span className="amx-tx block truncate text-[12px] text-slate-800 max-md:text-[14px]">{it.file.name}</span>
                <span className="amx-mut block text-[11px] text-slate-500 max-md:text-[12.5px]">{formatFileSize(it.file.size)}</span>
              </span>
              <button
                type="button"
                className="amx-btn amx-btn--sm min-h-8 rounded-md border border-slate-300 bg-white px-2 text-[11.5px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={disabled}
                onClick={() => remove(it.id)}
              >
                Noņemt
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {note || sizeErr ? (
        <p className="amx-tx--red mt-1.5 text-[11.5px] text-rose-700 max-md:text-[13px]">{sizeErr ?? note}</p>
      ) : null}
    </div>
  );
}
